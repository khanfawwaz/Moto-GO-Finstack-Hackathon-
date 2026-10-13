"""Finance orchestration: application lifecycle, steps, requirements loop, offers, signing, disbursal."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from .. import adapters, crypto
from ..adapters.base import ProviderPending
from ..config import any_mock
from ..db import utcnow
from ..doc_kinds import KINDS
from ..errors import ApiError
from ..finance_config import LENDER, STEP_ORDER, STEP_SCREEN, get_step_spec
from ..forms import validate
from ..models import (Activity, Application, ApplicationStep, CatalogueModel, Document, Goal, LoanSnapshot, Offer, Requirement,
                      User, Vehicle)
from ..state_machine import SIDE_EXITS, TERMINAL, InvalidTransition, check
from . import core

# Which document kinds can satisfy a requirement (primary kind first)
ACCEPTS = {
    "salary_slip": ["salary_slip", "bank_statement"],
    "address_proof": ["address_proof"],
    "pan_card": ["pan_card"],
    "selfie": ["selfie"],
}


# ---------------------------------------------------------------- lookups
def get_app(db: Session, user_id: str, app_id: str) -> Application:
    app = db.get(Application, app_id)
    if not app or app.user_id != user_id:
        raise ApiError("not_found", "Application not found.", 404)
    return app


def steps_map(db: Session, app_id: str) -> dict[str, ApplicationStep]:
    return {s.step_id: s for s in db.query(ApplicationStep).filter_by(application_id=app_id)}


def open_reqs(db: Session, app_id: str, category: str | None = None) -> list[Requirement]:
    q = db.query(Requirement).filter_by(application_id=app_id, status="open")
    if category:
        q = q.filter_by(category=category)
    return q.order_by(Requirement.created_at).all()


def _submitted(steps: dict, name: str) -> bool:
    return name in steps and steps[name].status == "submitted"


def compute_step(db: Session, app: Application) -> str:
    s = app.state
    if s in SIDE_EXITS:
        return "recovery"
    if s == "disbursed":
        return "handoff"
    if s in ("signed", "disbursal_pending"):
        return "disbursal"
    if s == "mandate_pending":
        return "esign" if app.mandate_active else "mandate"
    if s == "accepted":
        return "mandate"
    if s == "offered":
        return "offers"
    if open_reqs(db, app.id):
        return "remediation"
    if s in ("underwriting", "more_info"):
        return "status"
    steps = steps_map(db, app.id)
    for st in STEP_ORDER:
        if not _submitted(steps, st):
            return st
    return "status"


def refresh_step(db: Session, app: Application) -> None:
    app.current_step = compute_step(db, app)
    app.updated_at = utcnow()


# ---------------------------------------------------------------- serialisation
def mask_payload(spec: dict, payload: dict) -> dict:
    sens = {f["name"] for f in spec["fields"] if f.get("sensitive")}
    return {k: (crypto.mask(v) if k in sens and isinstance(v, str) and v else v) for k, v in payload.items()}


def ser_req(r: Requirement) -> dict:
    return {"id": r.id, "kind": r.kind, "category": r.category, "reason": r.reason, "alternatives": r.alternatives,
            "status": r.status, "accepts": ACCEPTS.get(r.kind, [r.kind]),
            "label": KINDS.get(r.kind, {}).get("label", r.kind), "created_at": r.created_at.isoformat()}


def ser_doc(d: Document) -> dict:
    ex = {k: v for k, v in (d.extracted_json or {}).items() if k != "checks"}
    return {"id": d.id, "kind": d.kind, "filename": d.filename, "status": d.status, "reason": d.reason,
            "size": d.size, "mime": d.mime, "requirement_id": d.requirement_id, "extracted": ex,
            "created_at": d.created_at.isoformat()}


def ser_offer(o: Offer) -> dict:
    return {"id": o.id, "lender": o.lender, "amount": o.amount, "tenure": o.tenure, "rate": o.rate, "apr": o.apr,
            "emi": o.emi, "fees": o.fees, "total": o.total, "conditional": o.conditional, "conditions": o.conditions,
            "expires_at": o.expires_at.isoformat(), "kfs_version": o.kfs_version}


def serialize(db: Session, app: Application) -> dict:
    steps = steps_map(db, app.id)
    model = db.get(CatalogueModel, app.model_id) if app.model_id else None
    return {
        "id": app.id, "state": app.state, "current_step": app.current_step, "lender": {"id": LENDER["id"], "name": LENDER["name"]},
        "product": app.product, "amount": app.amount, "tenure": app.tenure, "quote": app.quote,
        "contribution": app.contribution, "model": {"id": model.id, "label": f"{model.make} {model.model}"} if model else None,
        "steps": {k: v.status for k, v in steps.items()}, "requirements": [ser_req(r) for r in
                                                                             db.query(Requirement).filter_by(application_id=app.id).order_by(Requirement.created_at)],
        "exit_reason": app.exit_reason, "accepted_offer_id": app.accepted_offer_id, "mandate_active": app.mandate_active,
        "vehicle_id": app.vehicle_id, "demo": any_mock(), "created_at": app.created_at.isoformat(),
        "updated_at": app.updated_at.isoformat(),
    }


# ---------------------------------------------------------------- transitions / providers
def transition(db: Session, app: Application, new: str, summary: str, *, provider: str | None = None) -> None:
    try:
        check(app.state, new)
    except InvalidTransition as e:
        raise ApiError("invalid_transition", f"This action isn't available right now ({e}).", 409)
    app.state = new
    core.add_event(db, app.id, f"state.{new}", summary, state=new, provider=provider)
    refresh_step(db, app)


def provider_call(db: Session, app: Application, provider: str, op: str, request: dict, fn):
    """Run an adapter call; log request/response hashes to events; ProviderPending is a normal result."""
    idem = core.sha({"a": app.id, "op": op, "r": app.underwriting_round})[:32]
    try:
        res = fn(idem)
    except Exception as e:  # noqa: BLE001
        if e.__class__.__name__ == "ProviderNotConfigured":
            raise ApiError("provider_unavailable", "This service isn't connected yet.", 503, retryable=False)
        raise
    shown = {"pending": res.ref} if isinstance(res, ProviderPending) else res
    core.add_event(db, app.id, f"provider.{op}", f"{provider}: {op}" + (" (pending)" if isinstance(res, ProviderPending) else ""),
                   provider=provider, idempotency_key=idem, payload={"req": request, "res": shown})
    return res


def _terminal_guard(app: Application) -> None:
    if app.state in TERMINAL:
        raise ApiError("application_closed", "This application is closed.", 409)


def _ensure_req(db: Session, app: Application, kind: str, category: str, reason: str, alternatives: list[str]) -> None:
    exists = db.query(Requirement).filter_by(application_id=app.id, kind=kind, status="open").first()
    if exists:
        return
    db.add(Requirement(application_id=app.id, kind=kind, category=category, reason=reason, alternatives=alternatives))
    core.add_event(db, app.id, "requirement.created", f"Needed: {KINDS.get(kind, {}).get('label', kind)}")
    core.track("requirement_created", app=app.id, kind=kind)


# ---------------------------------------------------------------- create
def create_application(db: Session, user: User, values: dict, goal_id: str | None) -> Application:
    spec = get_step_spec("intake")
    clean, errors = validate(spec, values)
    if errors:
        raise ApiError("validation_error", errors[0]["message"], field=errors[0]["field"], extra={"errors": errors}, status=422)
    if clean["applicant_type"] not in LENDER["supported_applicants"]:
        raise ApiError("unsupported_applicant", f"{LENDER['name']} can't finance this applicant type yet. Your garage and plans are unaffected.", 422)
    model = db.get(CatalogueModel, clean["model_id"])
    if not model or model.type not in LENDER["supported_vehicle_types"]:
        raise ApiError("unsupported_vehicle", "Only two-wheelers can be financed for now.", 422, field="model_id")
    if goal_id:
        goal = db.get(Goal, goal_id)
        if not goal or goal.user_id != user.id or goal.target_model_id != model.id:
            raise ApiError("validation_error", "Choose the vehicle from your ownership plan.", 422, field="model_id")
        from . import garage
        vehicle = db.get(Vehicle, goal.sell_current) if goal.sell_current else None
        if vehicle and (vehicle.user_id != user.id or vehicle.ownership != "current"):
            raise ApiError("validation_error", "The vehicle selected for sale is no longer in your garage.", 422)
        v = garage.ser_vehicle(db, vehicle) if vehicle else None
        if goal.sell_current and (not v or not v["valuation"] or not v["equity"]["known"]):
            raise ApiError("validation_error", "Update the sale vehicle's valuation and loan balance first.", 422)
        clean["ownership_context"] = {"target_model_id": model.id, "cash_down_payment": goal.savings,
                                      "sale_vehicle_id": vehicle.id if vehicle else None,
                                      "valuation": v["valuation"] if v else None, "equity": v["equity"] if v else None,
                                      "loan_payoff": v["loan"]["principal"] if v and v["loan"]["status"] == "active" else 0 if v and v["loan"]["status"] == "none" else None,
                                      "test_drive_completed": bool(db.query(Activity).filter_by(user_id=user.id, model_id=model.id, kind="test_driven").first())}
    app = Application(user_id=user.id, goal_id=goal_id, lender_id=LENDER["id"], model_id=model.id,
                      amount=clean["amount"], tenure=int(clean["tenure"]), quote=clean["quote"],
                      contribution=clean["contribution"], state="draft", current_step="identity")
    db.add(app)
    db.flush()
    db.add(ApplicationStep(application_id=app.id, step_id="intake", status="submitted", payload_json=clean))
    core.add_event(db, app.id, "application.created", "Application started")
    core.track("finance_started", app=app.id)
    refresh_step(db, app)
    return app


# ---------------------------------------------------------------- steps
def _file_checker(db: Session, app: Application, user_id: str):
    def check_file(field: dict, doc_id: str) -> str | None:
        d = db.get(Document, doc_id)
        if not d or d.owner_id != user_id or d.application_id != app.id:
            return "Upload this document again"
        if field.get("doc_kind") and d.kind != field["doc_kind"] and not (
                field["doc_kind"] == "salary_slip" and d.kind == "bank_statement"):
            return "This isn't the right kind of document"
        if d.status in ("uploading", "processing"):
            return "Wait for the upload to finish processing"
        if d.status == "rejected":
            return d.reason or "This file was rejected. Upload another."
        return None
    return check_file


def _gate(db: Session, app: Application, step: str, steps: dict) -> None:
    if step in ("mandate", "esign"):
        if step == "mandate" and app.state not in ("accepted", "mandate_pending"):
            raise ApiError("step_out_of_order", "Accept an offer first.", 409)
        if step == "esign" and not app.mandate_active:
            raise ApiError("step_out_of_order", "Your repayment mandate must be active first.", 409)
        return
    if app.state not in ("draft", "consented", "identity_pending", "evidence_pending"):
        raise ApiError("step_closed", "This step can no longer be edited.", 409)
    idx = STEP_ORDER.index(step)
    for prev in STEP_ORDER[:idx]:
        if not _submitted(steps, prev):
            raise ApiError("step_out_of_order", "Please finish the earlier steps first.", 409)
    if step in ("bureau", "evidence", "work", "vehicle") and open_reqs(db, app.id, "identity"):
        raise ApiError("requirements_open", "Please resolve the pending items first.", 409)


def get_step(db: Session, user: User, app: Application, step: str) -> dict:
    spec = get_step_spec(step)
    if not spec or step == "intake":
        raise ApiError("not_found", "Unknown step.", 404)
    row = db.get(ApplicationStep, (app.id, step))
    payload = mask_payload(spec, row.payload_json) if row else {}
    spec["status"] = row.status if row else "empty"
    spec["values"] = payload
    spec["demo"] = any_mock()
    return spec


def save_step(db: Session, user: User, app: Application, step: str, values: dict, submit: bool) -> dict:
    spec = get_step_spec(step)
    if not spec or step == "intake":
        raise ApiError("not_found", "Unknown step.", 404)
    _terminal_guard(app)
    steps = steps_map(db, app.id)
    if submit:
        _gate(db, app, step, steps)
    row = steps.get(step) or ApplicationStep(application_id=app.id, step_id=step, status="draft", payload_json={})
    db.add(row)
    sens = {f["name"] for f in spec["fields"] if f.get("sensitive")}
    existing = dict(row.payload_json or {})

    if not submit:
        merged = dict(existing)
        for k, v in values.items():
            if k in {f["name"] for f in spec["fields"]} and not crypto.is_masked(v):
                merged[k] = crypto.encrypt(v) if k in sens and isinstance(v, str) and v else v
        row.payload_json = merged
        if row.status != "submitted":
            row.status = "draft"
        db.flush()
        return {"application": serialize(db, app), "status": row.status, "redirect": None}

    # restore masked sensitive values before validating
    vals = dict(values)
    for k in sens:
        if crypto.is_masked(vals.get(k)) and existing.get(k):
            vals[k] = crypto.decrypt(existing[k])
    clean, errors = validate(spec, vals, _file_checker(db, app, user.id))
    if errors:
        raise ApiError("validation_error", errors[0]["message"], field=errors[0]["field"], extra={"errors": errors}, status=422)
    stored = {k: (crypto.encrypt(v) if k in sens else v) for k, v in clean.items()}
    row.payload_json = stored
    row.status = "submitted"
    db.flush()
    core.track("step_submitted", app=app.id, step=step)

    for f in spec["fields"]:
        c = f.get("consent")
        if c and clean.get(f["name"]) is True:
            core.record_consent(db, user.id, c["type"], c["purpose"], c["recipient"], c["version"], app.id)

    redirect = HOOKS[step](db, app, user, clean, row) if step in HOOKS else None
    refresh_step(db, app)
    db.flush()
    return {"application": serialize(db, app), "status": row.status, "redirect": redirect}


# --- per-step hooks (run after a valid submit)
def _h_identity(db, app, user, clean, row):
    if app.state == "draft":
        transition(db, app, "consented", "Application consent recorded")


def _h_kyc(db, app, user, clean, row):
    core.require_consent(db, app.id, "kyc")
    ident = db.get(ApplicationStep, (app.id, "identity"))
    pan = crypto.decrypt(ident.payload_json["pan"])
    res = provider_call(db, app, "kyc", "kyc.verify", {"method": clean["kyc_method"]},
                        lambda idem: adapters.get("kyc").verify(pan=pan, legal_name=ident.payload_json["legal_name"],
                                                                method=clean["kyc_method"], idempotency_key=idem))
    if app.state == "consented":
        transition(db, app, "identity_pending", "Identity check started")
    if isinstance(res, ProviderPending):
        return None
    if res["status"] == "name_mismatch":
        _ensure_req(db, app, "pan_card", "identity", "The name on your KYC record doesn't match the legal name you entered.",
                    ["Upload a clear copy of your PAN card", "Go back and correct your legal name"])
    if clean["kyc_method"] == "video_kyc":
        _ensure_req(db, app, "selfie", "identity", "Video KYC needs a live selfie to match your ID.",
                    ["Take a selfie in good light", "Choose a different KYC method"])
    return None


def _h_bureau(db, app, user, clean, row):
    core.require_consent(db, app.id, "bureau")
    ident = db.get(ApplicationStep, (app.id, "identity"))
    pan = crypto.decrypt(ident.payload_json["pan"])
    res = provider_call(db, app, "bureau", "bureau.pull", {}, lambda idem: adapters.get("bureau").pull(pan=pan, idempotency_key=idem))
    if not isinstance(res, ProviderPending):
        row.payload_json = {**row.payload_json, "report_ref": res["report_ref"]}
    if app.state == "identity_pending":
        transition(db, app, "evidence_pending", "Credit report fetched (sample)")


def _h_evidence(db, app, user, clean, row):
    if clean["route"] != "aa":
        return None
    core.require_consent(db, app.id, "aa")
    res = provider_call(db, app, "aa", "aa.initiate", {}, lambda idem: adapters.get("aa").initiate(
        application_id=app.id, return_url=f"/finance/{app.id}/return?step=evidence", idempotency_key=idem))
    row.status = "pending_provider"
    row.payload_json = {**row.payload_json, "consent_handle": res["consent_handle"]}
    return {"provider": "aa", "url": res["redirect_url"], "demo": adapters.is_mock("aa")}


def _h_vehicle(db, app, user, clean, row):
    steps = steps_map(db, app.id)
    steps["vehicle"] = row
    if all(_submitted(steps, s) for s in STEP_ORDER) and app.state == "evidence_pending" and not open_reqs(db, app.id):
        start_underwriting(db, app)


def _h_mandate(db, app, user, clean, row):
    core.require_consent(db, app.id, "mandate")
    ifsc = clean["ifsc"]
    res = provider_call(db, app, "mandate", "mandate.register", {"ifsc": ifsc}, lambda idem: adapters.get("mandate").register(
        application_id=app.id, ifsc=ifsc, idempotency_key=idem))
    if app.state == "accepted":
        transition(db, app, "mandate_pending", "Mandate sent to your bank")
    if isinstance(res, ProviderPending):
        row.status = "pending_provider"
        core.run_job(db, job_mandate_active, app.id, delay=3.0)
    else:
        job_mandate_active(db, app.id)


def _h_esign(db, app, user, clean, row):
    res = provider_call(db, app, "esign", "esign.initiate", {}, lambda idem: adapters.get("esign").initiate(
        application_id=app.id, return_url=f"/finance/{app.id}/return?step=esign", idempotency_key=idem))
    row.status = "pending_provider"
    row.payload_json = {**row.payload_json, "ref": res["ref"]}
    return {"provider": "esign", "url": res["redirect_url"], "demo": adapters.is_mock("esign")}


HOOKS = {"identity": _h_identity, "kyc": _h_kyc, "bureau": _h_bureau, "evidence": _h_evidence,
         "vehicle": _h_vehicle, "mandate": _h_mandate, "esign": _h_esign}


# ---------------------------------------------------------------- underwriting loop
def start_underwriting(db: Session, app: Application) -> None:
    app.underwriting_round += 1
    transition(db, app, "underwriting", f"Sent to {LENDER['name']} for review (round {app.underwriting_round})")
    core.run_job(db, job_underwrite, app.id, delay=core.mock_delay() if adapters.is_mock("lender") else 0)


def job_underwrite(db: Session, app_id: str) -> None:
    app = db.get(Application, app_id)
    if not app or app.state != "underwriting":
        return
    try:
        core.require_consent(db, app.id, "bureau")
        core.require_consent(db, app.id, "application")
    except ApiError:
        transition(db, app, "cancelled", "Stopped because a consent was withdrawn")
        app.exit_reason = "You withdrew a consent, so the lender can't continue with this application."
        return
    payload = {"amount": app.amount, "tenure": app.tenure, "quote": app.quote}
    res = provider_call(db, app, "lender", "lender.decide", {"round": app.underwriting_round},
                        lambda idem: adapters.get("lender").decide(application=payload, round=app.underwriting_round, idempotency_key=idem))
    if isinstance(res, ProviderPending):
        core.add_event(db, app.id, "lender.pending", "The lender is still reviewing. Nothing for you to do.")
        return
    apply_decision(db, app, res)


def apply_decision(db: Session, app: Application, res: dict) -> None:
    d = res["decision"]
    if d == "approved":
        db.query(Offer).filter_by(application_id=app.id).delete()
        payload = {"amount": app.amount, "tenure": app.tenure}
        for o in adapters.get("lender").offers(application=payload):
            db.add(Offer(application_id=app.id, lender=LENDER["name"], amount=o["amount"], tenure=o["tenure"], rate=o["rate"],
                         apr=o["apr"], emi=o["emi"], fees=o["fees"], total=o["total"], conditional=o["conditional"],
                         conditions=o["conditions"], expires_at=utcnow() + timedelta(days=7)))
        db.flush()
        transition(db, app, "offered", "Offers are ready to compare", provider="lender")
    elif d == "more_info":
        for r in res["requirements"]:
            _ensure_req(db, app, r["kind"], "underwriting", r["reason"], r["alternatives"])
        transition(db, app, "more_info", "The lender needs a few more items", provider="lender")
    elif d == "declined":
        app.exit_reason = " ".join(res.get("reasons", [])) or "The lender could not approve this request."
        transition(db, app, "declined", "The lender declined this request", provider="lender")


def on_document_result(db: Session, doc: Document, summary: str, alternatives: list[str]) -> None:
    app = db.get(Application, doc.application_id)
    if not app:
        return
    core.add_event(db, app.id, "document.result", summary)
    if doc.requirement_id:
        req = db.get(Requirement, doc.requirement_id)
        if req and req.status == "open":
            if doc.status == "verified":
                req.status = "resolved"
                core.add_event(db, app.id, "requirement.resolved", f"Resolved: {KINDS.get(req.kind, {}).get('label', req.kind)}")
            else:
                req.reason = doc.reason or req.reason
                if alternatives:
                    req.alternatives = alternatives
    reevaluate(db, app)


def reevaluate(db: Session, app: Application) -> None:
    if app.state == "more_info" and not open_reqs(db, app.id, "underwriting"):
        start_underwriting(db, app)
    refresh_step(db, app)


# ---------------------------------------------------------------- offers / KFS
def kfs_for(db: Session, app: Application, o: Offer) -> dict:
    return {
        "version": o.kfs_version, "lender": LENDER["name"], "offer": ser_offer(o),
        "sections": [
            {"title": "Loan", "rows": [["Loan amount", o.amount], ["Tenure (months)", o.tenure],
                                        ["Interest rate (nominal, reducing balance)", f"{o.rate}% a year"], ["EMI", o.emi]]},
            {"title": "Costs", "rows": [["Processing and other fees (deducted up front)", o.fees],
                                        ["Annual percentage rate (APR), includes fees", f"{o.apr}% a year"],
                                        ["Total you repay (EMIs + fees)", o.total]]},
            {"title": "Your rights", "rows": [
                ["Cooling-off period", f"{LENDER['cooling_off_days']} days to exit by repaying principal and proportionate interest (sample)"],
                ["Grievance officer", LENDER["grievance_officer"]],
                ["How money moves", "The loan is paid directly to the dealer. Moto Go never holds your funds."],
                ["Document retention", LENDER["retention"]]]},
        ],
        "note": "Sample Key Facts Statement for demonstration. Real lenders must provide their own KFS before you accept.",
    }


def accept_offer(db: Session, user: User, app: Application, offer_id: str, kfs_version: str, acknowledged: bool) -> None:
    _terminal_guard(app)
    if app.state != "offered":
        raise ApiError("invalid_state", "There is no offer to accept right now.", 409)
    o = db.get(Offer, offer_id)
    if not o or o.application_id != app.id:
        raise ApiError("not_found", "Offer not found.", 404)
    if o.expires_at < utcnow():
        raise ApiError("offer_expired", "This offer has expired.", 410)
    if not acknowledged:
        raise ApiError("kfs_required", "Please acknowledge the Key Facts Statement first.", 422, field="acknowledged")
    if kfs_version != o.kfs_version:
        raise ApiError("kfs_version_mismatch", "The Key Facts Statement changed. Please read it again.", 409)
    core.record_consent(db, user.id, "kfs", "Acknowledge the Key Facts Statement for the selected offer", LENDER["name"], o.kfs_version, app.id)
    app.accepted_offer_id, app.amount, app.tenure = o.id, o.amount, o.tenure
    core.track("offer_selected", app=app.id)
    transition(db, app, "accepted", "Offer accepted after Key Facts Statement")


# ---------------------------------------------------------------- mandate / sign / disbursal
def job_mandate_active(db: Session, app_id: str) -> None:
    app = db.get(Application, app_id)
    if not app or app.state != "mandate_pending" or app.mandate_active:
        return
    app.mandate_active = True
    step = db.get(ApplicationStep, (app.id, "mandate"))
    if step:
        step.status = "submitted"
    core.add_event(db, app.id, "mandate.active", "Repayment mandate is active", provider="mandate")
    refresh_step(db, app)


def complete_provider(db: Session, app: Application, provider: str, ref: str | None = None) -> None:
    """Applied when a provider redirect returns or a signed webhook arrives."""
    if provider == "aa":
        step = db.get(ApplicationStep, (app.id, "evidence"))
        if not step or step.status == "submitted":
            return
        data = adapters.get("aa").fetch(consent_handle=step.payload_json.get("consent_handle", ""))
        step.payload_json = {**step.payload_json, "aa_summary_months": data["transactions_months"]}
        step.status = "submitted"
        core.add_event(db, app.id, "aa.complete", "Bank data linked (sample, 6 months)", provider="aa")
    elif provider == "esign":
        if app.state != "mandate_pending" or not app.mandate_active:
            raise ApiError("invalid_state", "Signing isn't available yet.", 409)
        step = db.get(ApplicationStep, (app.id, "esign"))
        res = adapters.get("esign").complete(application_id=app.id, ref=ref or (step.payload_json.get("ref") if step else "x"))
        if step:
            step.status = "submitted"
            step.payload_json = {**step.payload_json, "signed_ref": res["signed_ref"]}
        core.track("signed", app=app.id)
        transition(db, app, "signed", "Agreement signed (sample e-sign)", provider="esign")
        transition(db, app, "disbursal_pending", "Waiting for the lender to pay the dealer")
        core.run_job(db, job_disburse, app.id, delay=5.0)
    elif provider == "mandate":
        job_mandate_active(db, app.id)
    elif provider == "lender.disbursal":
        job_disburse(db, app.id)
    refresh_step(db, app)


def job_disburse(db: Session, app_id: str) -> None:
    app = db.get(Application, app_id)
    if not app or app.state != "disbursal_pending":
        return
    transition(db, app, "disbursed", "Loan paid to the dealer (sample). Delivery is a separate step.", provider="lender")
    core.track("disbursal_confirmed", app=app.id)
    handoff_to_garage(db, app)


def handoff_to_garage(db: Session, app: Application) -> None:
    if app.vehicle_id:
        return
    m = db.get(CatalogueModel, app.model_id)
    city = (db.get(ApplicationStep, (app.id, "intake")).payload_json or {}).get("city")
    v = Vehicle(user_id=app.user_id, model_id=m.id if m else None, type=m.type if m else "bike", variant=m.variant if m else None,
                year=date.today().year, ownership="current", city=city, delivery_status="pending", source="finance_handoff")
    db.add(v)
    db.flush()
    db.add(LoanSnapshot(vehicle_id=v.id, status="active", lender=LENDER["name"], principal=app.amount,
                        statement_date=date.today(), source="finance_handoff"))
    app.vehicle_id = v.id
    core.add_event(db, app.id, "garage.handoff", "Added to your Garage as 'delivery pending'")


def cancel(db: Session, app: Application) -> None:
    _terminal_guard(app)
    transition(db, app, "cancelled", "You cancelled this application")
    app.exit_reason = "You cancelled this application."
