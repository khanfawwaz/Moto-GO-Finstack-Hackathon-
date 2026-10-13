from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db, utcnow
from ..errors import ApiError
from ..models import (Activity, Application, ApplicationStep, CareLog, Consent, Goal, LoanSnapshot, Profile, User,
                      Valuation, Vehicle)
from ..security import current_user
from ..services import core
from .auth import ser_user

router = APIRouter(tags=["me"])
INTERESTS = {"commute", "touring", "adventure", "performance", "ev", "classics", "scooters", "cars"}
OWNERSHIP = {"own", "owned_before", "exploring"}


class MePatch(BaseModel):
    display_name: str | None = Field(None, min_length=2, max_length=40)
    city: str | None = Field(None, max_length=80)
    interests: list[str] | None = None
    ownership_tags: list[str] | None = None
    story_done: bool | None = None


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return ser_user(db, user)


@router.get("/insights")
def insights(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """A minimal financial profile from this user's saved applications, never identity documents."""
    profiles = []
    for application in db.query(Application).filter_by(user_id=user.id).order_by(Application.created_at.desc()):
        step = db.get(ApplicationStep, (application.id, "identity"))
        identity = (step.payload_json or {}) if step else {}
        kyc = db.get(ApplicationStep, (application.id, "kyc"))
        profiles.append({"application_id": application.id,
                         "declared_monthly_income": identity.get("income"),
                         "declared_existing_emis": identity.get("existing_emis"),
                         "employment": identity.get("employment"),
                         "identity_status": step.status if step else "not_started",
                         "kyc_status": kyc.status if kyc else "not_started"})
    return {"financial_profiles": profiles}


@router.patch("/me")
def patch_me(body: MePatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(Profile, user.id)
    if body.display_name:
        user.display_name = body.display_name.strip()
    if body.city is not None:
        p.city = body.city.strip() or None
    if body.interests is not None:
        if len(body.interests) > 3:
            raise ApiError("validation_error", "Pick up to 3 interests.", 422, field="interests")
        if not set(body.interests) <= INTERESTS:
            raise ApiError("validation_error", "Unknown interest.", 422, field="interests")
        p.interests = body.interests
    if body.ownership_tags is not None:
        if not set(body.ownership_tags) <= OWNERSHIP:
            raise ApiError("validation_error", "Unknown option.", 422, field="ownership_tags")
        p.ownership_tags = body.ownership_tags
    if body.story_done is not None:
        p.story_done = body.story_done
    db.commit()
    return ser_user(db, user)


def ser_consent(c: Consent) -> dict:
    return {"id": c.id, "type": c.type, "purpose": c.purpose, "recipient": c.recipient, "text_version": c.text_version,
            "granted_at": c.granted_at.isoformat(), "withdrawn_at": c.withdrawn_at.isoformat() if c.withdrawn_at else None,
            "application_id": c.application_id}


@router.get("/consents")
def consents(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(Consent).filter_by(user_id=user.id).order_by(Consent.granted_at.desc()).all()
    return {"items": [ser_consent(c) for c in rows]}


@router.post("/consents/{consent_id}/withdraw")
def withdraw(consent_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = db.get(Consent, consent_id)
    if not c or c.user_id != user.id:
        raise ApiError("not_found", "Consent not found.", 404)
    if c.type in ("terms", "adult"):
        raise ApiError("not_withdrawable", "To withdraw this, request account deletion instead.", 409)
    if not c.withdrawn_at:
        c.withdrawn_at = utcnow()
        if c.application_id:
            core.add_event(db, c.application_id, "consent.withdrawn", f"You withdrew your {c.type} consent")
        db.commit()
    return ser_consent(c)


@router.post("/me/marketing")
def marketing(opt_in: bool, user: User = Depends(current_user), db: Session = Depends(get_db)):
    last = (db.query(Consent).filter_by(user_id=user.id, type="marketing").order_by(Consent.granted_at.desc()).first())
    if opt_in and (not last or last.withdrawn_at):
        core.record_consent(db, user.id, "marketing", "Receive product updates", "Moto Go", "marketing-v1")
    if not opt_in and last and not last.withdrawn_at:
        last.withdrawn_at = utcnow()
    db.commit()
    return {"marketing_opt_in": opt_in}


def _rows(db, model, **flt):
    return [{c.name: (getattr(r, c.name).isoformat() if hasattr(getattr(r, c.name), "isoformat") else getattr(r, c.name))
             for c in model.__table__.columns} for r in db.query(model).filter_by(**flt)]


@router.get("/me/export")
def export(user: User = Depends(current_user), db: Session = Depends(get_db)):
    vehicles = db.query(Vehicle).filter_by(user_id=user.id).all()
    apps = db.query(Application).filter_by(user_id=user.id).all()
    return {
        "exported_at": utcnow().isoformat(),
        "user": {"display_name": user.display_name, "phone": user.phone, "email": user.email,
                 "created_at": user.created_at.isoformat()},
        "profile": _rows(db, Profile, user_id=user.id),
        "vehicles": _rows(db, Vehicle, user_id=user.id),
        "loan_snapshots": [x for v in vehicles for x in _rows(db, LoanSnapshot, vehicle_id=v.id)],
        "valuations": [x for v in vehicles for x in _rows(db, Valuation, vehicle_id=v.id)],
        "care_logs": _rows(db, CareLog, user_id=user.id),
        "activities": _rows(db, Activity, user_id=user.id),
        "goals": _rows(db, Goal, user_id=user.id),
        "consents": _rows(db, Consent, user_id=user.id),
        "applications": [{**a, "steps": [{"step": s.step_id, "status": s.status}
                                         for s in db.query(ApplicationStep).filter_by(application_id=a["id"])]}
                         for a in _rows(db, Application, user_id=user.id)],
        "note": "Identity numbers (PAN, account numbers) are encrypted and excluded from this export.",
    }


@router.post("/me/delete-request")
def delete_request(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not user.deletion_requested_at:
        user.deletion_requested_at = utcnow()
        db.commit()
    return {"requested_at": user.deletion_requested_at.isoformat(),
            "message": "We've logged your request. Support will confirm and delete your data, subject to the lender's retention rules for any application."}
