"""API tests against a throwaway SQLite DB. Works with or without a Kimi key
(the agent endpoints fall back to deterministic output)."""
import datetime as dt
import os
import tempfile

# Point at a clean temp DB *before* the app imports its config.
_db = os.path.join(tempfile.gettempdir(), "loop_pytest.db")
if os.path.exists(_db):
    os.remove(_db)
os.environ["DATABASE_URL"] = "sqlite:///" + _db.replace("\\", "/")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # context manager runs lifespan (init + seed)
        yield c


def test_health(client):
    j = client.get("/api/health").json()
    assert "model" in j and "live" in j and "key" in j


def test_seed_and_list(client):
    data = client.get("/api/commitments").json()
    assert len(data) >= 5
    statuses = {c["status"] for c in data}
    assert "missed" in statuses
    assert "at_risk" in statuses


def test_as_of_changes_status(client):
    # A far-future as_of pushes more items past their deadline.
    today = client.get("/api/commitments").json()
    future = client.get("/api/commitments", params={"as_of": str(dt.date.today() + dt.timedelta(days=60))}).json()
    missed_now = sum(c["status"] == "missed" for c in today)
    missed_future = sum(c["status"] == "missed" for c in future)
    assert missed_future >= missed_now


def test_create_and_reschedule(client):
    due = str(dt.date.today() + dt.timedelta(days=10))
    created = client.post("/api/commitments", json={
        "title": "Test deal", "team": "Commercial", "owner": "Jo Lin", "deadline": due})
    assert created.status_code == 201
    cid = created.json()["id"]

    nd = str(dt.date.today() + dt.timedelta(days=20))
    res = client.post(f"/api/commitments/{cid}/reschedule", json={"to": nd, "reason": "test"})
    assert res.status_code == 200
    assert res.json()["slip_count"] == 1


def test_act_returns_action(client):
    r = client.post("/api/act", json={"q": "what is at risk this week?"})
    assert r.status_code == 200
    assert "action" in r.json()


def test_activity_feed(client):
    acts = client.get("/api/activity").json()
    assert isinstance(acts, list) and acts
    # the missed Q2 investor update escalates to the founders
    assert "founder" in {a["tier"] for a in acts}
    # newest first
    dates = [a["date"] for a in acts]
    assert dates == sorted(dates, reverse=True)


def test_demo_reset_restores_scenario(client):
    client.post("/api/commitments", json={
        "title": "scratch", "team": "X", "owner": "Y Z",
        "deadline": str(dt.date.today() + dt.timedelta(days=5))})
    assert len(client.get("/api/commitments").json()) >= 7
    assert client.post("/api/demo/reset").json()["ok"] is True
    assert len(client.get("/api/commitments").json()) == 6
