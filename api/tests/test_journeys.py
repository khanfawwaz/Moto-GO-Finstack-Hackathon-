from datetime import date

from app.db import SessionLocal
from app.models import ApplicationStep


def test_dream_suggestions_are_one_premium_bike_and_car(api):
    api.login("9812345760")
    vehicle = api.post("/vehicles", {"type": "scooter", "model_id": "suzuki-access-125", "year": 2021, "ownership": "current"}).json()
    suggestions = api.get("/garage").json()["suggestions"]
    assert [m["type"] for m in suggestions] == ["bike", "car"]
    assert all(m["price_low"] >= 2 * vehicle["valuation"]["high"] for m in suggestions)
    assert suggestions[0]["price_low"] >= 300_000
    assert suggestions[1]["price_low"] >= 1_200_000
    api.post("/activities", {"model_id": suggestions[0]["id"], "activity": "saved"})
    updated = api.get("/garage").json()["suggestions"]
    assert [m["type"] for m in updated] == ["bike", "car"]
    assert suggestions[0]["id"] not in [m["id"] for m in updated]


def test_dream_suggestions_never_fall_back_to_a_cheaper_bike(api):
    api.login("9812345761")
    expensive = api.post("/vehicles", {"type": "car", "model_id": "mini-cooper-s", "year": date.today().year, "ownership": "current"}).json()
    api.post("/vehicles", {"type": "scooter", "model_id": "suzuki-access-125", "year": 2021, "ownership": "current"})
    suggestions = api.get("/garage").json()["suggestions"]
    assert len(suggestions) <= 2
    assert all(m["price_low"] >= 2 * expensive["valuation"]["high"] for m in suggestions)
    assert all(m["id"] != "mini-cooper-s" for m in suggestions)


def test_ownership_rewards_are_large_and_not_duplicated(api):
    api.login("9812345710")
    before = api.get("/me").json()["xp"]
    body = {"type": "scooter", "model_id": "honda-activa-6g", "year": 2022, "ownership": "current"}
    vehicle = api.post("/vehicles", body).json()
    reward = 2000 + 10 * max(1, vehicle["valuation"]["high"] // 1000)
    user = api.get("/me").json()
    assert user["xp"] == before + reward and user["level"] >= 3
    assert user["next_at"] > user["xp"] and user["title"] != "Pit Lane Rookie"
    assert api.post("/vehicles", body).status_code == 201
    assert api.get("/me").json()["xp"] == user["xp"]
    model = "royal-enfield-hunter-350"
    assert api.post("/activities", {"model_id": model, "activity": "rented"}).json()["xp_awarded"] == 500
    assert api.post("/activities", {"model_id": model, "activity": "test_driven"}).json()["xp_awarded"] == 250
    assert api.get("/me").json()["xp"] == user["xp"] + 750
    assert api.post("/activities", {"model_id": model, "activity": "rented"}).json()["xp_awarded"] == 0


def test_insights_are_authenticated_and_account_scoped(api):
    assert api.get("/insights").status_code == 401
    api.login("9812345711")
    values = {"model_id": "royal-enfield-hunter-350", "new_or_used": "new", "city": "Bengaluru", "quote": 160000,
              "amount": 120000, "contribution": 40000, "tenure": "36", "applicant_type": "salaried", "adult": True}
    response = api.post("/applications", {"values": values})
    assert response.status_code == 201, response.text
    app_id = response.json()["id"]
    initial = api.get("/insights").json()["financial_profiles"][0]
    assert initial["application_id"] == app_id and initial["declared_monthly_income"] is None
    identity = {"legal_name": "Test Driver", "dob": "1995-04-12", "address": "12 MG Road, Bengaluru", "pincode": "560001",
                "pan": "ABCDE1234F", "employment": "private_salaried", "income": 55000, "existing_emis": 4000, "application_consent": True}
    r = api.put(f"/applications/{app_id}/steps/identity", {"values": identity, "submit": False})
    assert r.status_code == 200, r.text
    summary = api.get("/insights").json()["financial_profiles"][0]
    assert summary["declared_monthly_income"] == 55000 and summary["declared_existing_emis"] == 4000
    assert "pan" not in summary and "address" not in summary
    api.post("/auth/logout")
    api.login("9812345712")
    assert api.get("/insights").json()["financial_profiles"] == []


def test_intent_and_completed_experience_are_separate(api):
    api.login("9812345701")
    model = "royal-enfield-hunter-350"
    response = api.post("/activities", {"model_id": model, "activity": "intent_test_drive"})
    assert response.status_code == 200
    assert response.json()["xp_awarded"] == 0
    badges = api.get(f"/passport/{model}").json()["badges"]
    assert "intent_test_drive" in badges and "test_driven" not in badges
    assert api.post("/activities", {"model_id": model, "activity": "test_driven"}).json()["xp_awarded"] == 250
    assert api.post("/activities", {"model_id": model, "activity": "test_driven"}).json()["duplicate"]
    assert "test_driven" in api.get(f"/passport/{model}").json()["badges"]
    for activity in ("intent_short_rental", "intent_long_rental", "short_rental", "long_rental", "intent_own"):
        assert api.post("/activities", {"model_id": model, "activity": activity}).status_code == 200


def test_live_sale_selection_and_finance_context(api):
    api.login("9812345702")
    model = "royal-enfield-hunter-350"
    v = api.post("/vehicles", {"type": "scooter", "model_id": "honda-activa-6g", "year": 2022, "ownership": "current"}).json()
    api.put(f"/vehicles/{v['id']}/loan", {"status": "none"})
    goal = api.post("/goals", {"target_model_id": model, "price_assumption": 160000, "savings": 20000}).json()
    path = f"/goals/{goal['id']}/scenarios"
    keep = api.post(path, {"sell": False}).json()["scenarios"][-1]["loan"]
    selling = api.post(path, {"sell": True, "sell_current": v["id"]}).json()
    assert selling["sell_vehicle"]["id"] == v["id"]
    assert selling["scenarios"][-1]["loan"] < keep
    assert api.post(path, {"sell": True, "sell_current": "not-yours"}).status_code == 422
    assert api.patch(f"/goals/{goal['id']}", {"target_model_id": model, "sell_current": v["id"]}).status_code == 200
    api.post("/activities", {"model_id": model, "activity": "test_driven"})
    values = {"model_id": model, "new_or_used": "new", "city": "Bengaluru", "quote": 160000,
              "amount": 120000, "contribution": 40000, "tenure": "24", "applicant_type": "salaried", "adult": True}
    response = api.post("/applications", {"goal_id": goal["id"], "values": values})
    assert response.status_code == 201, response.text
    with SessionLocal() as db:
        context = db.get(ApplicationStep, (response.json()["id"], "intake")).payload_json["ownership_context"]
        assert context["sale_vehicle_id"] == v["id"] and context["loan_payoff"] == 0
        assert context["cash_down_payment"] == 20000 and context["test_drive_completed"]
    api.post("/auth/logout")
    api.login("9812345703")
    assert api.post("/applications", {"goal_id": goal["id"], "values": values}).status_code == 422


def test_garage_keeps_service_and_insurance_reminders(api):
    api.login("9812345704")
    v = api.post("/vehicles", {"type": "scooter", "model_id": "honda-activa-6g", "year": 2022, "ownership": "current"}).json()
    for kind in ("General service", "Insurance renewal"):
        response = api.post(f"/vehicles/{v['id']}/care", {"kind": kind, "date": date.today().isoformat(), "odometer": 1000, "next_due": "2030-01-01", "remind": True})
        assert response.status_code == 201
    vehicle = next(vv for vv in api.get("/garage").json()["vehicles"] if vv["id"] == v["id"])
    assert {r["kind"] for r in vehicle["reminders"]} == {"General service", "Insurance renewal"}
