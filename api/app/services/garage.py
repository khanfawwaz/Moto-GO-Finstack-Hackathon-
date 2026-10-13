"""Garage, valuation, equity, collection (XP) helpers."""
from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from .. import adapters
from ..errors import ApiError
from ..models import Activity, CareLog, CatalogueModel, Goal, LoanSnapshot, Valuation, Vehicle
from ..scenarios import equity_range

SEGMENTS = [("commute", "Commute"), ("touring", "Touring"), ("adventure", "Adventure"),
            ("performance", "Performance"), ("ev", "Electric")]

# (kind, category) -> xp. Saving and past-ownership earn none; repeats earn none (deduplicated by constraint).
XP_RULES = {"spotted": 50, "test_driven": 250, "saved": 0}
ACTIVITIES = {
    "spotted": ("spotted", ""), "ridden": ("experienced", "ridden"), "driven": ("experienced", "driven"),
    "rented": ("experienced", "rented"), "test_driven": ("test_driven", ""), "past_owned": ("experienced", "past_owned"),
    "saved": ("saved", ""),
    "short_rental": ("experienced", "short_rental"), "long_rental": ("experienced", "long_rental"),
    "intent_test_drive": ("journey", "test_drive"), "intent_short_rental": ("journey", "short_rental"),
    "intent_long_rental": ("journey", "long_rental"), "intent_own": ("journey", "own"),
}


def model_label(m: CatalogueModel | None, v: Vehicle | None = None) -> str:
    if m:
        return f"{m.make} {m.model}"
    return (v.free_text_model if v else None) or "Unknown vehicle"


def ser_model(m: CatalogueModel) -> dict:
    return {"id": m.id, "type": m.type, "make": m.make, "model": m.model, "variant": m.variant, "label": f"{m.make} {m.model}",
            "segment": m.segment, "price_low": m.price_low, "price_high": m.price_high, "specs": m.specs,
            "source": m.source, "as_of": m.as_of.isoformat()}


def latest_loan(db: Session, vehicle_id: str) -> LoanSnapshot | None:
    return db.query(LoanSnapshot).filter_by(vehicle_id=vehicle_id).order_by(LoanSnapshot.created_at.desc()).first()


def latest_valuation(db: Session, vehicle_id: str) -> Valuation | None:
    return db.query(Valuation).filter_by(vehicle_id=vehicle_id).order_by(Valuation.created_at.desc()).first()


def run_valuation(db: Session, v: Vehicle) -> Valuation:
    m = db.get(CatalogueModel, v.model_id) if v.model_id else None
    if not m:
        raise ApiError("valuation_unavailable", "We can only value models from the catalogue. Pick your model from the list.", 422)
    est = adapters.get("valuation").estimate(
        price_low=m.price_low, price_high=m.price_high, year=v.year, odometer=v.odometer, condition=v.condition,
        owners=v.owners, accident=v.accident_flag, modified=v.modified_flag, city=v.city)
    val = Valuation(vehicle_id=v.id, low=est["low"], mid=est["mid"], high=est["high"], confidence=est["confidence"],
                    source=est["source"], as_of=est["as_of"])
    db.add(val)
    db.flush()
    return val


def value_points(maximum_value: int | None) -> int:
    """One collection point for each ₹1,000 of the best current value estimate."""
    return max(1, maximum_value // 1_000) if maximum_value is not None else 0


def ownership_points(maximum_value: int | None) -> int:
    return 2000 + 10 * value_points(maximum_value)


def experience_points(kind: str, category: str = "") -> int:
    if kind == "experienced":
        return 500 if category in {"rented", "short_rental", "long_rental"} else 250 if category in {"ridden", "driven"} else 0
    return XP_RULES.get(kind, 0)


def ser_loan(l: LoanSnapshot | None) -> dict:
    if not l:
        return {"status": "unknown", "lender": None, "principal": None, "statement_date": None, "source": "not_provided"}
    return {"status": l.status, "lender": l.lender, "principal": l.principal,
            "statement_date": l.statement_date.isoformat() if l.statement_date else None, "source": l.source,
            "document_id": l.document_id}


def ser_vehicle(db: Session, v: Vehicle) -> dict:
    m = db.get(CatalogueModel, v.model_id) if v.model_id else None
    val, loan = latest_valuation(db, v.id), latest_loan(db, v.id)
    loan_d = ser_loan(loan)
    eq = equity_range(val.low if val else None, val.high if val else None, loan_d["status"], loan_d["principal"])
    eq["confidence"] = None
    if eq["known"] and val:
        # confidence is capped by the weakest input: self-entered loan data is medium at best
        eq["confidence"] = "medium" if (loan_d["source"] == "user_entered" and val.confidence == "high") else val.confidence
    nxt = (db.query(CareLog).filter(CareLog.vehicle_id == v.id, CareLog.next_due.isnot(None))
           .order_by(CareLog.next_due).first())
    return {
        "id": v.id, "type": v.type, "model": ser_model(m) if m else None, "label": model_label(m, v),
        "verified_model": bool(m), "free_text_model": v.free_text_model, "variant": v.variant, "year": v.year,
        "ownership": v.ownership, "city": v.city, "odometer": v.odometer, "condition": v.condition, "owners": v.owners,
        "accident_flag": v.accident_flag, "modified_flag": v.modified_flag, "rc_document_id": v.rc_document_id,
        "delivery_status": v.delivery_status, "source": v.source,
        "valuation": ({"low": val.low, "mid": val.mid, "high": val.high, "confidence": val.confidence, "source": val.source,
                       "as_of": val.as_of.isoformat()} if val else None),
        "loan": loan_d, "equity": eq,
        "next_care": ({"kind": nxt.kind, "due": nxt.next_due.isoformat()} if nxt else None),
        "reminders": [{"kind": c.kind, "due": c.next_due.isoformat()} for c in
                      db.query(CareLog).filter(CareLog.vehicle_id == v.id, CareLog.next_due.isnot(None), CareLog.remind.is_(True)).order_by(CareLog.next_due)],
    }


def xp_total(db: Session, user_id: str) -> int:
    activities = db.query(Activity).filter_by(user_id=user_id).all()
    # Apply the current reward scale to old logs too, without database rewrites.
    total = sum((a.xp if a.provenance == "ownership_v2" else 2000 + 10 * a.xp) if a.kind == "owned"
                else experience_points(a.kind, a.category) for a in activities)
    # Existing garages predate the ownership milestone. Count those current
    # vehicles too, without double-counting the new activity record.
    rewarded_models = {a.model_id for a in activities if a.kind == "owned" and a.category == "garage"}
    for v in db.query(Vehicle).filter_by(user_id=user_id, ownership="current"):
        if v.model_id in rewarded_models:
            continue
        val = latest_valuation(db, v.id)
        m = db.get(CatalogueModel, v.model_id) if v.model_id else None
        total += ownership_points(val.high if val else (m.price_high if m else None))
        if v.model_id:
            rewarded_models.add(v.model_id)
    return total


def level_for(xp: int) -> dict:
    lvl = 1 + xp // 1000
    return {"level": lvl, "xp": xp, "next_at": lvl * 1000, "title": ["Pit Lane Rookie", "Road Explorer", "Weekend Driver", "Road Captain",
                                                                  "Apex Hunter", "Garage Legend"][min(lvl - 1, 5)]}


def badges_by_model(db: Session, user_id: str | None) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    if not user_id:
        return out
    for a in db.query(Activity).filter_by(user_id=user_id):
        # Keep the meaningful experience on the card: "Drove" is more useful
        # than a catch-all "Experienced" label when scanning Explore.
        key = f"intent_{a.category}" if a.kind == "journey" else a.category if a.kind == "experienced" and a.category else a.kind
        out.setdefault(a.model_id, set()).add(key)
    for v in db.query(Vehicle).filter(Vehicle.user_id == user_id, Vehicle.model_id.isnot(None)):
        out.setdefault(v.model_id, set()).add("owned" if v.ownership == "current" else "owned_past")
    return out


def collection_progress(db: Session, user_id: str | None) -> dict:
    models = db.query(CatalogueModel).all()
    badges = badges_by_model(db, user_id)
    discovered = {mid for mid, b in badges.items() if b & {"spotted", "experienced", "driven", "ridden", "rented", "short_rental", "long_rental", "test_driven", "owned", "owned_past", "past_owned"}}
    segs = []
    for sid, label in SEGMENTS:
        ids = [m.id for m in models if m.segment == sid]
        segs.append({"id": sid, "label": label, "total": len(ids), "discovered": len([i for i in ids if i in discovered])})
    xp = xp_total(db, user_id) if user_id else 0
    return {"discovered": len(discovered), "total": len(models), "segments": segs, **level_for(xp)}


def next_goal(db: Session, user_id: str) -> dict | None:
    g = db.query(Goal).filter_by(user_id=user_id).order_by(Goal.created_at.desc()).first()
    if not g:
        return None
    m = db.get(CatalogueModel, g.target_model_id)
    return {"id": g.id, "label": model_label(m), "price_assumption": g.price_assumption,
            "target_date": g.target_date.isoformat() if g.target_date else None, "savings": g.savings, "monthly": g.monthly}


def roadmap_suggestions(db: Session, user_id: str) -> list[dict]:
    """One aspirational bike and car, never a cheaper fallback or an owned model."""
    current = db.query(Vehicle).filter_by(user_id=user_id, ownership="current").all()
    excluded = {v.model_id for v in current if v.model_id}
    excluded.update(a.model_id for a in db.query(Activity).filter_by(user_id=user_id, kind="saved"))
    excluded.update(g.target_model_id for g in db.query(Goal).filter_by(user_id=user_id))
    values = []
    for vehicle in current:
        valuation = latest_valuation(db, vehicle.id)
        model = db.get(CatalogueModel, vehicle.model_id) if vehicle.model_id else None
        if valuation:
            values.append(valuation.high)
        elif model:
            values.append(model.price_high)
    baseline = max(values, default=0)
    suggestions = []
    for kind, floor in (("bike", 300_000), ("car", 1_200_000)):
        candidate = (db.query(CatalogueModel)
                     .filter(CatalogueModel.type == kind,
                             CatalogueModel.price_low >= max(baseline * 2, floor),
                             CatalogueModel.id.notin_(excluded))
                     .order_by(CatalogueModel.price_low, CatalogueModel.id).first())
        if candidate:
            suggestions.append(ser_model(candidate))
    return suggestions


def care_task(db: Session, user_id: str) -> dict | None:
    row = (db.query(CareLog, Vehicle).join(Vehicle, Vehicle.id == CareLog.vehicle_id)
           .filter(CareLog.user_id == user_id, CareLog.next_due.isnot(None), Vehicle.ownership == "current")
           .order_by(CareLog.next_due).first())
    if not row:
        return None
    c, v = row
    m = db.get(CatalogueModel, v.model_id) if v.model_id else None
    return {"vehicle_id": v.id, "vehicle": model_label(m, v), "kind": c.kind, "due": c.next_due.isoformat(),
            "overdue": c.next_due < date.today()}
