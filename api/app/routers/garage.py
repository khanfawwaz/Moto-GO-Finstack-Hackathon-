from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import ApiError
from ..models import Activity, CareLog, CatalogueModel, Document, LoanSnapshot, User, Vehicle
from ..security import current_user
from ..services import core, garage
from ..services.garage import ser_vehicle

router = APIRouter(tags=["garage"])
THIS_YEAR = date.today().year


class VehicleIn(BaseModel):
    type: str = Field(pattern="^(car|bike|scooter)$")
    model_id: str | None = None
    free_text_model: str | None = Field(None, max_length=120)
    variant: str | None = Field(None, max_length=80)
    year: int = Field(ge=1950, le=THIS_YEAR)
    ownership: str = Field(pattern="^(current|past)$")
    city: str | None = Field(None, max_length=80)
    odometer: int | None = Field(None, ge=0, le=1_000_000)
    condition: str | None = Field(None, pattern="^(excellent|good|fair|poor)$")
    owners: int | None = Field(None, ge=1, le=20)
    accident_flag: bool | None = None
    modified_flag: bool | None = None
    rc_document_id: str | None = None


class VehiclePatch(BaseModel):
    variant: str | None = None
    city: str | None = None
    odometer: int | None = Field(None, ge=0, le=1_000_000)
    condition: str | None = Field(None, pattern="^(excellent|good|fair|poor)$")
    owners: int | None = Field(None, ge=1, le=20)
    accident_flag: bool | None = None
    modified_flag: bool | None = None
    year: int | None = Field(None, ge=1950, le=THIS_YEAR)
    delivery_status: str | None = Field(None, pattern="^(pending|delivered)$")


class LoanIn(BaseModel):
    status: str = Field(pattern="^(none|active|unknown)$")
    lender: str | None = Field(None, max_length=120)
    principal: int | None = Field(None, ge=0, le=100_000_000)
    statement_date: date | None = None
    document_id: str | None = None


class CareIn(BaseModel):
    kind: str = Field(min_length=2, max_length=40)
    date: date
    odometer: int = Field(ge=0, le=1_000_000)
    cost: int | None = Field(None, ge=0)
    notes: str | None = Field(None, max_length=300)
    next_due: date | None = None
    remind: bool = False
    document_id: str | None = None


def own_vehicle(db: Session, user: User, vid: str) -> Vehicle:
    v = db.get(Vehicle, vid)
    if not v or v.user_id != user.id:
        raise ApiError("not_found", "Vehicle not found.", 404)
    return v


def _own_doc(db: Session, user: User, doc_id: str | None, kind: str) -> Document | None:
    if not doc_id:
        return None
    d = db.get(Document, doc_id)
    if not d or d.owner_id != user.id or d.kind != kind:
        raise ApiError("validation_error", "That document isn't available. Upload it again.", 422, field="document_id")
    return d


@router.get("/garage")
def garage_home(user: User = Depends(current_user), db: Session = Depends(get_db)):
    vs = db.query(Vehicle).filter_by(user_id=user.id).order_by(Vehicle.created_at).all()
    items = [ser_vehicle(db, v) for v in vs]
    current = [i for i in items if i["ownership"] == "current"]
    known = [i for i in current if i["equity"]["known"]]
    total = None
    if known:
        total = {"low": sum(i["equity"]["low"] for i in known), "high": sum(i["equity"]["high"] for i in known),
                 "counted": len(known), "of": len(current)}
    return {"vehicles": items, "total_equity": total, "care_task": garage.care_task(db, user.id),
            "next_goal": garage.next_goal(db, user.id), "suggestions": garage.roadmap_suggestions(db, user.id),
            "collection": garage.collection_progress(db, user.id)}


@router.get("/vehicles")
def list_vehicles(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"items": [ser_vehicle(db, v) for v in db.query(Vehicle).filter_by(user_id=user.id).order_by(Vehicle.created_at)]}


@router.post("/vehicles", status_code=201)
def add_vehicle(body: VehicleIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = None
    if body.model_id:
        m = db.get(CatalogueModel, body.model_id)
        if not m:
            raise ApiError("validation_error", "Unknown model.", 422, field="model_id")
        if m.type != body.type:
            raise ApiError("validation_error", "That model is a different vehicle type.", 422, field="type")
    elif not (body.free_text_model or "").strip():
        raise ApiError("validation_error", "Pick a model or type its name.", 422, field="model_id")
    if body.rc_document_id:
        _own_doc(db, user, body.rc_document_id, "rc")
    first = db.query(Vehicle).filter_by(user_id=user.id).count() == 0
    v = Vehicle(user_id=user.id, model_id=m.id if m else None,
                free_text_model=None if m else body.free_text_model.strip(), type=body.type,
                variant=body.variant or (m.variant if m else None), year=body.year, ownership=body.ownership,
                city=body.city, odometer=body.odometer, condition=body.condition, owners=body.owners,
                accident_flag=body.accident_flag, modified_flag=body.modified_flag, rc_document_id=body.rc_document_id)
    db.add(v)
    db.flush()
    if body.rc_document_id:
        d = db.get(Document, body.rc_document_id)
        d.vehicle_id = v.id
    if m and body.ownership == "current":
        valuation = garage.run_valuation(db, v)
        # Owning a vehicle is a meaningful garage milestone. It is awarded once per
        # model, using the highest estimate for this make, year and condition.
        already_awarded = db.query(Activity).filter_by(
            user_id=user.id, model_id=m.id, kind="owned", category="garage"
        ).first()
        if not already_awarded:
            db.add(Activity(user_id=user.id, model_id=m.id, kind="owned", category="garage",
                            xp=garage.ownership_points(valuation.high), provenance="ownership_v2"))
    core.track("vehicle_added", vehicle=v.id)
    if first:
        core.track("garage_created", user=user.id)
    db.commit()
    return ser_vehicle(db, v)


@router.get("/vehicles/{vid}")
def get_vehicle(vid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = own_vehicle(db, user, vid)
    out = ser_vehicle(db, v)
    out["care"] = care_list(db, v)
    return out


@router.patch("/vehicles/{vid}")
def patch_vehicle(vid: str, body: VehiclePatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = own_vehicle(db, user, vid)
    for k, val in body.model_dump(exclude_unset=True).items():
        setattr(v, k, val)
    db.commit()
    return ser_vehicle(db, v)


@router.delete("/vehicles/{vid}", status_code=204)
def delete_vehicle(vid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = own_vehicle(db, user, vid)
    for model in (LoanSnapshot, CareLog):
        db.query(model).filter_by(vehicle_id=v.id).delete()
    from ..models import Valuation

    db.query(Valuation).filter_by(vehicle_id=v.id).delete()
    db.delete(v)
    db.commit()


@router.put("/vehicles/{vid}/loan")
def put_loan(vid: str, body: LoanIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = own_vehicle(db, user, vid)
    principal, sdate, source = body.principal, body.statement_date, "user_entered"
    doc = _own_doc(db, user, body.document_id, "loan_statement")
    if body.status == "active":
        if doc and doc.status == "verified":
            ex = doc.extracted_json or {}
            if principal is None and ex.get("principal") is not None:
                principal, source = int(ex["principal"]), "statement_parsed"
            if sdate is None and ex.get("statement_date"):
                sdate = date.fromisoformat(ex["statement_date"])
        if not (body.lender or "").strip():
            raise ApiError("validation_error", "Enter your lender's name.", 422, field="lender")
        if principal is None or principal <= 0:
            raise ApiError("validation_error", "Enter the outstanding principal.", 422, field="principal")
        if sdate is None:
            raise ApiError("validation_error", "Enter the statement date.", 422, field="statement_date")
        if sdate > date.today():
            raise ApiError("validation_error", "The statement date can't be in the future.", 422, field="statement_date")
    else:
        principal, sdate = None, None
    db.add(LoanSnapshot(vehicle_id=v.id, status=body.status, lender=body.lender if body.status == "active" else None,
                        principal=principal, statement_date=sdate, source=source, document_id=body.document_id))
    if doc:
        doc.vehicle_id = v.id
    db.commit()
    return ser_vehicle(db, v)


@router.post("/vehicles/{vid}/valuation")
def post_valuation(vid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = own_vehicle(db, user, vid)
    garage.run_valuation(db, v)
    db.commit()
    return ser_vehicle(db, v)


def care_list(db: Session, v: Vehicle) -> list[dict]:
    rows = db.query(CareLog).filter_by(vehicle_id=v.id).order_by(CareLog.date.desc()).all()
    return [{"id": c.id, "kind": c.kind, "date": c.date.isoformat(), "odometer": c.odometer, "cost": c.cost, "notes": c.notes,
             "next_due": c.next_due.isoformat() if c.next_due else None, "remind": c.remind, "document_id": c.document_id}
            for c in rows]


@router.get("/vehicles/{vid}/care")
def get_care(vid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"items": care_list(db, own_vehicle(db, user, vid))}


@router.post("/vehicles/{vid}/care", status_code=201)
def add_care(vid: str, body: CareIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = own_vehicle(db, user, vid)
    if body.date > date.today():
        raise ApiError("validation_error", "The service date can't be in the future.", 422, field="date")
    if body.next_due and body.next_due < body.date:
        raise ApiError("validation_error", "The next due date must be after the service date.", 422, field="next_due")
    doc = _own_doc(db, user, body.document_id, "care_bill")
    db.add(CareLog(vehicle_id=v.id, user_id=user.id, kind=body.kind, date=body.date, odometer=body.odometer, cost=body.cost,
                   notes=body.notes, next_due=body.next_due, remind=body.remind, document_id=body.document_id))
    if doc:
        doc.vehicle_id = v.id
    db.commit()
    return {"items": care_list(db, v)}


@router.delete("/care/{cid}", status_code=204)
def delete_care(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = db.get(CareLog, cid)
    if not c or c.user_id != user.id:
        raise ApiError("not_found", "Entry not found.", 404)
    db.delete(c)
    db.commit()
