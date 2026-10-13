import hashlib
import hmac
import json


def test_otp_signup_and_returning_user(api):
    r = api.post("/auth/otp/request", {"identifier": "9811122233"})
    assert r.status_code == 200 and r.json()["demo_hint"]
    # missing display name for a new user
    r = api.post("/auth/otp/verify", {"identifier": "9811122233", "code": "123456", "adult": True, "accept_terms": True})
    assert r.status_code == 422 and r.json()["field"] == "display_name"
    r = api.post("/auth/otp/verify", {"identifier": "9811122233", "code": "123456", "display_name": "Asha",
                                      "adult": True, "accept_terms": True, "marketing_opt_in": False})
    assert r.status_code == 200 and r.json()["is_new"] is True
    types = {c["type"] for c in api.get("/consents").json()["items"]}
    assert types == {"terms", "adult"}  # marketing is off by default, separate consent
    # returning user: detected after OTP, session restored
    api.c.cookies.clear()
    api.post("/auth/otp/request", {"identifier": "98111 22233"})
    r = api.post("/auth/otp/verify", {"identifier": "9811122233", "code": "123456"})
    assert r.json()["is_new"] is False
    assert api.get("/me").json()["display_name"] == "Asha"


def test_otp_lockout_and_rules(api):
    assert api.post("/auth/otp/request", {"identifier": "12345"}).status_code == 422
    assert api.post("/auth/otp/request", {"identifier": "9822233344"}).status_code == 200
    assert api.post("/auth/otp/request", {"identifier": "9822233344"}).json()["code"] == "resend_too_soon"
    for left in (2, 1):
        r = api.post("/auth/otp/verify", {"identifier": "9822233344", "code": "000000"})
        assert r.json()["code"] == "otp_invalid" and str(left) in r.json()["message"]
    assert api.post("/auth/otp/verify", {"identifier": "9822233344", "code": "000000"}).status_code == 423
    assert api.post("/auth/otp/verify", {"identifier": "9822233344", "code": "123456"}).status_code == 423


def test_requires_auth_and_csrf(api):
    assert api.get("/garage").status_code == 401
    api.login()
    assert api.c.post("/api/v1/auth/logout").status_code == 403  # no CSRF header
    assert api.post("/auth/logout").status_code == 200


def test_garage_equity_and_unknown_debt(api):
    api.login("9999900001")
    g = api.get("/garage").json()
    v = g["vehicles"][0]
    assert v["equity"]["known"] and v["valuation"]["confidence"] == "high"
    assert v["equity"]["high"] == v["valuation"]["high"] - 18000
    # add a vehicle without loan info -> equity unknown, never zero-debt
    r = api.post("/vehicles", {"type": "bike", "model_id": "honda-shine-125", "year": 2022, "ownership": "current"})
    assert r.status_code == 201
    nv = r.json()
    assert nv["valuation"]["confidence"] == "low" and nv["equity"] == {**nv["equity"], "known": False, "reason": "loan_unknown"}
    g = api.get("/garage").json()
    assert g["total_equity"]["counted"] == 1 and g["total_equity"]["of"] == 2
    # loan rules
    bad = api.put(f"/vehicles/{nv['id']}/loan", {"status": "active", "lender": "X Bank", "principal": 5000, "statement_date": "2999-01-01"})
    assert bad.status_code == 422 and bad.json()["field"] == "statement_date"
    ok = api.put(f"/vehicles/{nv['id']}/loan", {"status": "none"}).json()
    assert ok["equity"]["known"] is True


def test_free_text_vehicle_has_no_valuation(api):
    api.login("9999900002")
    r = api.post("/vehicles", {"type": "bike", "free_text_model": "Old Rajdoot", "year": 1975, "ownership": "past"})
    assert r.status_code == 201 and r.json()["valuation"] is None and not r.json()["verified_model"]
    assert api.post("/vehicles", {"type": "bike", "year": 2020, "ownership": "current"}).status_code == 422
    assert api.post("/vehicles", {"type": "bike", "free_text_model": "x", "year": 1900, "ownership": "current"}).status_code == 422


def test_ownership_isolation(api):
    api.login("9999900001")
    vid = api.get("/garage").json()["vehicles"][0]["id"]
    api.post("/auth/logout")
    api.login("9999900002")
    assert api.get(f"/vehicles/{vid}").status_code == 404


def test_collection_xp_rules_and_dedup(api):
    api.login("9999900002")
    p0 = api.get("/collection").json()["progress"]["xp"]
    r = api.post("/activities", {"model_id": "royal-enfield-hunter-350", "activity": "spotted"}).json()
    assert r["xp_awarded"] == 50 and not r["duplicate"]
    assert api.post("/activities", {"model_id": "royal-enfield-hunter-350", "activity": "spotted"}).json()["duplicate"]
    assert api.post("/activities", {"model_id": "royal-enfield-hunter-350", "activity": "rented"}).json()["xp_awarded"] == 500
    assert api.post("/activities", {"model_id": "royal-enfield-hunter-350", "activity": "saved"}).json()["xp_awarded"] == 0
    assert api.post("/activities", {"model_id": "royal-enfield-hunter-350", "activity": "past_owned"}).json()["xp_awarded"] == 0
    assert api.get("/collection").json()["progress"]["xp"] == p0 + 550
    assert len(api.get("/dream-garage").json()["items"]) == 1
    assert api.delete("/activities/saved/royal-enfield-hunter-350").status_code == 204


def test_goal_and_scenarios(api):
    api.login("9999900001")
    vid = api.get("/garage").json()["vehicles"][0]["id"]
    g = api.post("/goals", {"target_model_id": "royal-enfield-hunter-350", "savings": 20000, "monthly": 8000, "sell_current": vid}).json()
    s = api.post(f"/goals/{g['id']}/scenarios", {}).json()
    assert [x["id"] for x in s["scenarios"]] == ["save", "used", "sell_buy", "finance"]
    assert not s["scenarios"][2].get("unavailable")
    keep = api.post(f"/goals/{g['id']}/scenarios", {"sell": False}).json()
    assert keep["scenarios"][2].get("unavailable")


def test_rc_upload_and_loan_statement_parse(api):
    api.login("9999900002")
    v = api.post("/vehicles", {"type": "scooter", "model_id": "honda-activa-6g", "year": 2020, "ownership": "current"}).json()
    doc = api.upload("loan_statement", "statement.pdf")
    assert doc["status"] == "verified"
    r = api.put(f"/vehicles/{v['id']}/loan", {"status": "active", "lender": "Sample Bank", "document_id": doc["id"]}).json()
    assert r["loan"]["source"] == "statement_parsed" and r["loan"]["principal"] == 18000


def test_upload_pipeline_states(api):
    api.login("9999900002")
    assert api.upload("care_bill", "blurry_bill.pdf")["status"] == "rejected"
    d = api.upload("care_bill", "bill.pdf")
    assert d["status"] == "verified"
    bad = api.upload("care_bill", "fake.pdf", data=b"not a pdf at all")
    assert bad["status"] == "rejected" and "match" in bad["reason"]
    r = api.post("/documents/presign", {"kind": "bank_statement", "mime": "image/png", "size": 10, "sha256": "0" * 64})
    assert r.status_code == 422
    r = api.post("/documents/presign", {"kind": "rc", "mime": "application/pdf", "size": 11 * 1024 * 1024, "sha256": "0" * 64})
    assert r.status_code == 422


def test_webhook_signature_and_replay(api):
    api.login("9999900001")
    body = json.dumps({"event_id": "e1", "type": "mandate.active", "application_id": "nope"}).encode()
    assert api.c.post("/api/v1/webhooks/lender", content=body, headers={"x-signature": "bad"}).status_code == 401
    sig = hmac.new(b"test-hook", body, hashlib.sha256).hexdigest()
    assert api.c.post("/api/v1/webhooks/lender", content=body, headers={"x-signature": sig}).status_code == 404
