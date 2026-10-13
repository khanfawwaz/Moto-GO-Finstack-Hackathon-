import re
from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import ApiError
from ..models import Activity, CatalogueModel, Goal, Profile, User, Vehicle
from ..scenarios import build_scenarios, equity_range
from ..security import current_user, optional_user
from ..services import core, garage
from ..services.garage import ACTIVITIES, SEGMENTS, ser_model

router = APIRouter(tags=["explore"])

# Friendly corrections keep the catalogue useful when a rider searches by the
# common spoken spelling rather than the manufacturer's exact styling.
SEARCH_CORRECTIONS = {
    "marathi": "maruti", "fesino": "fascino", "bespa": "vespa", "java": "jawa",
    "expulse": "xpulse", "tbs": "tvs", "icube": "iqube", "either": "ather",
    "uben": "oben", "roar": "rorr", "rb400": "rv400", "ultraviolet": "ultraviolette",
    "204b": "200 4v", "sd": "ktm 390", "splendor plus": "splendor+",
    "sp160": "sp 160", "sxl150": "sxl 150", "400x": "400 x",
}


@router.get("/catalogue/models")
def search_models(q: str = "", type: str | None = None, segment: str | None = None, ids: str | None = None,
                  limit: int = Query(80, le=200), db: Session = Depends(get_db)):
    qs = db.query(CatalogueModel)
    normalized_q = q.lower()
    for spoken, official in SEARCH_CORRECTIONS.items():
        normalized_q = re.sub(rf"\b{re.escape(spoken)}\b", official, normalized_q)
    if ids:
        qs = qs.filter(CatalogueModel.id.in_(ids.split(",")[:6]))
    if type:
        qs = qs.filter(CatalogueModel.type == type)
    if segment:
        qs = qs.filter(CatalogueModel.segment == segment)
    for tok in re.findall(r"[\w+]+", normalized_q)[:4]:
        like = f"%{tok}%"
        qs = qs.filter(or_(CatalogueModel.make.ilike(like), CatalogueModel.model.ilike(like), CatalogueModel.variant.ilike(like)))
    return {"items": [ser_model(m) for m in qs.order_by(CatalogueModel.make, CatalogueModel.model).limit(limit)]}


@router.get("/collection")
def collection(user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    badges = garage.badges_by_model(db, user.id if user else None)
    models = db.query(CatalogueModel).order_by(CatalogueModel.price_low).all()
    return {"models": [{**ser_model(m), "badges": sorted(badges.get(m.id, []))} for m in models],
            "segments": [{"id": s, "label": l} for s, l in SEGMENTS],
            "progress": garage.collection_progress(db, user.id if user else None), "guest": user is None}


@router.get("/passport/{model_id}")
def passport(model_id: str, user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    m = db.get(CatalogueModel, model_id)
    if not m:
        raise ApiError("not_found", "Model not found.", 404)
    badges = sorted(garage.badges_by_model(db, user.id if user else None).get(m.id, []))
    interests = []
    if user:
        p = db.get(Profile, user.id)
        interests = p.interests if p else []
    fits = m.segment in interests or (m.type + "s") in interests
    ev = m.segment == "ev"
    km = 8000
    eff = m.specs.get("eff", "")
    kmpl = float(re.findall(r"[\d.]+", eff)[0]) if re.findall(r"[\d.]+", eff) else None
    fuel = round(km / kmpl * 105) if kmpl else (round(km * 0.9) if ev else None)
    insurance = round(m.price_low * (0.03 if m.type == "car" else 0.025))
    return {
        "model": ser_model(m), "badges": badges,
        "fit": {"matches_interests": fits, "reason": (f"You chose {m.segment} as an interest." if fits else
                                                     "Not matched to your interests yet. Fit uses only the interests you chose.")},
        "ownership_cost": {"assumptions": [f"{km:,} km a year", "Fuel ₹105/litre" if not ev else "Home charging ₹0.9/km",
                                           "Insurance about 2.5-3% of price", "Illustrative only, not a quote"],
                           "yearly_running": fuel, "yearly_insurance": insurance},
        "experiences": [{"kind": "test_drive", "title": "Test ride/drive"}, {"kind": "rental", "title": "Rent for a weekend"}],
        "sponsored": False, "credit_note": "Saving or logging a model never shares anything with a lender.",
    }


class ActivityIn(BaseModel):
    model_id: str
    activity: str = Field(pattern="^(spotted|ridden|driven|rented|test_driven|past_owned|saved|short_rental|long_rental|intent_test_drive|intent_short_rental|intent_long_rental|intent_own)$")
    occurred_on: date | None = None
    notes: str | None = Field(None, max_length=300)
    rating: int | None = Field(None, ge=1, le=5)


@router.post("/activities")
def log_activity(body: ActivityIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(CatalogueModel, body.model_id):
        raise ApiError("not_found", "Model not found.", 404)
    if body.occurred_on and body.occurred_on > date.today():
        raise ApiError("validation_error", "The date can't be in the future.", 422, field="occurred_on")
    kind, cat = ACTIVITIES[body.activity]
    existing = db.query(Activity).filter_by(user_id=user.id, model_id=body.model_id, kind=kind, category=cat).first()
    if existing:  # deduplicated: no repeat discovery XP
        return {"duplicate": True, "xp_awarded": 0, "progress": garage.collection_progress(db, user.id)}
    xp = garage.experience_points(kind, cat)
    db.add(Activity(user_id=user.id, model_id=body.model_id, kind=kind, category=cat, occurred_on=body.occurred_on,
                    notes=body.notes, rating=body.rating, xp=xp))
    if kind == "saved":
        core.track("model_saved", model=body.model_id)
    db.commit()
    return {"duplicate": False, "xp_awarded": xp, "progress": garage.collection_progress(db, user.id)}


@router.delete("/activities/saved/{model_id}", status_code=204)
def unsave(model_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(Activity).filter_by(user_id=user.id, model_id=model_id, kind="saved").delete()
    db.commit()


@router.get("/dream-garage")
def dream_garage(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ids = [a.model_id for a in db.query(Activity).filter_by(user_id=user.id, kind="saved").order_by(Activity.created_at)]
    ms = {m.id: m for m in db.query(CatalogueModel).filter(CatalogueModel.id.in_(ids or ["-"]))}
    return {"items": [ser_model(ms[i]) for i in ids if i in ms]}


# ---------------- Road-to goals ----------------
class GoalIn(BaseModel):
    target_model_id: str
    price_assumption: int | None = Field(None, ge=0, le=50_000_000)
    target_date: date | None = None
    savings: int = Field(0, ge=0, le=50_000_000)
    monthly: int = Field(0, ge=0, le=5_000_000)
    sell_current: str | None = None


class ScenarioIn(BaseModel):
    sell_current: str | None = None
    savings: int | None = Field(None, ge=0)
    monthly: int | None = Field(None, ge=0)
    price: int | None = Field(None, ge=0)
    acquisition_costs: int = Field(0, ge=0)
    sale_costs: int = Field(3000, ge=0)
    rate_pct: float = Field(11.5, ge=0, le=40)
    sell: bool | None = None


def ser_goal(db: Session, g: Goal) -> dict:
    m = db.get(CatalogueModel, g.target_model_id)
    return {"id": g.id, "target_model": ser_model(m) if m else None, "price_assumption": g.price_assumption,
            "target_date": g.target_date.isoformat() if g.target_date else None, "savings": g.savings,
            "monthly": g.monthly, "sell_current": g.sell_current}


def _own_goal(db, user, gid) -> Goal:
    g = db.get(Goal, gid)
    if not g or g.user_id != user.id:
        raise ApiError("not_found", "Goal not found.", 404)
    return g


def _check_sell(db, user, vid):
    if vid:
        v = db.get(Vehicle, vid)
        if not v or v.user_id != user.id or v.ownership != "current":
            raise ApiError("validation_error", "Pick one of your current vehicles.", 422, field="sell_current")


@router.get("/goals")
def list_goals(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"items": [ser_goal(db, g) for g in db.query(Goal).filter_by(user_id=user.id).order_by(Goal.created_at.desc())]}


@router.post("/goals", status_code=201)
def create_goal(body: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.get(CatalogueModel, body.target_model_id)
    if not m:
        raise ApiError("validation_error", "Unknown model.", 422, field="target_model_id")
    _check_sell(db, user, body.sell_current)
    g = Goal(user_id=user.id, target_model_id=m.id, price_assumption=body.price_assumption or (m.price_low + m.price_high) // 2,
             target_date=body.target_date, savings=body.savings, monthly=body.monthly, sell_current=body.sell_current)
    db.add(g)
    core.track("goal_created", goal=g.id)
    db.commit()
    return ser_goal(db, g)


@router.patch("/goals/{gid}")
def patch_goal(gid: str, body: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = _own_goal(db, user, gid)
    data = body.model_dump(exclude_unset=True)
    if "sell_current" in data:
        _check_sell(db, user, data["sell_current"])
    for k, v in data.items():
        if k == "price_assumption" and v is None:
            continue
        setattr(g, k, v)
    db.commit()
    return ser_goal(db, g)


@router.delete("/goals/{gid}", status_code=204)
def delete_goal(gid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own_goal(db, user, gid))
    db.commit()


@router.post("/goals/{gid}/scenarios")
def scenarios(gid: str, body: ScenarioIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = _own_goal(db, user, gid)
    sale_est = settlement = None
    sell_vehicle = None
    use_sell = body.sell if body.sell is not None else bool(g.sell_current)
    vehicle_id = body.sell_current or g.sell_current
    _check_sell(db, user, vehicle_id)
    if use_sell and vehicle_id:
        v = db.get(Vehicle, vehicle_id)
        if v:
            s = garage.ser_vehicle(db, v)
            sell_vehicle = {"id": v.id, "label": s["label"], "equity": s["equity"], "valuation": s["valuation"]}
            if s["valuation"] and s["loan"]["status"] in ("none", "active") and (s["loan"]["status"] == "none" or s["loan"]["principal"] is not None):
                sale_est, settlement = s["valuation"]["mid"], s["loan"]["principal"] or 0
    cash = g.savings if body.savings is None else body.savings
    res = build_scenarios(price=g.price_assumption if body.price is None else body.price, savings=cash,
                          monthly=g.monthly if body.monthly is None else body.monthly,
                          acquisition_costs=body.acquisition_costs, sale_estimate=sale_est, settlement=settlement,
                          sale_costs=body.sale_costs, rate_pct=body.rate_pct)
    if sale_est is not None:
        financed = build_scenarios(price=g.price_assumption if body.price is None else body.price,
                                  savings=cash + sale_est - (settlement or 0) - body.sale_costs,
                                  monthly=0, acquisition_costs=body.acquisition_costs, rate_pct=body.rate_pct)
        res["scenarios"][-1] = financed["scenarios"][-1]
        res["scenarios"][-1]["assumptions"].append(f"Sale estimate {sale_est}, loan payoff {settlement or 0}, sale costs {body.sale_costs}")
    res["sell_vehicle"] = sell_vehicle
    res["goal"] = ser_goal(db, g)
    res["demo_note"] = "Illustrative maths on your own assumptions. It does not predict what a lender would offer."
    return res
