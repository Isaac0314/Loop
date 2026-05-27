"""Unit tests for the status + escalation engine (pure functions, no DB)."""
import datetime as dt

from app import status as st
from app.models import Commitment, Milestone, Slip, Update

AS_OF = dt.date(2026, 6, 1)


def d(n: int) -> dt.date:
    return AS_OF + dt.timedelta(days=n)


def test_missed_when_past_deadline():
    c = Commitment(title="X", team="T", owner="A B", start=d(-10), deadline=d(-1))
    assert st.status(c, AS_OF) == "missed"


def test_complete_when_all_milestones_done():
    c = Commitment(title="X", team="T", owner="A B", start=d(-10), deadline=d(5),
                   milestones=[Milestone(title="m", due=d(-2), done=True, done_on=d(-2))])
    assert st.status(c, AS_OF) == "complete"


def test_on_track_default():
    c = Commitment(title="X", team="T", owner="A B", start=d(-2), deadline=d(20),
                   updates=[Update(text="u", date=d(-1))])
    assert st.status(c, AS_OF) == "on_track"


def test_at_risk_on_repeated_slips():
    c = Commitment(title="X", team="T", owner="A B", start=d(-20), deadline=d(5),
                   slips=[Slip(from_date=d(-2), to_date=d(2), reason="x", date=d(-8)),
                          Slip(from_date=d(2), to_date=d(5), reason="y", date=d(-4))])
    assert st.slip_count(c, AS_OF) == 2
    assert st.status(c, AS_OF) == "at_risk"


def test_at_risk_when_close_and_stale():
    c = Commitment(title="X", team="T", owner="A B", start=d(-14), deadline=d(2),
                   updates=[Update(text="u", date=d(-8))])  # last update 8 days ago
    assert st.status(c, AS_OF) == "at_risk"


def test_eff_deadline_follows_latest_slip():
    c = Commitment(title="X", team="T", owner="A B", start=d(-20), deadline=d(0),
                   slips=[Slip(from_date=d(0), to_date=d(7), reason="x", date=d(-3))])
    assert st.eff_deadline(c, AS_OF) == d(7)


def test_agent_events_escalate_a_miss():
    c = Commitment(title="X", team="T", owner="Dani Cohen", start=d(-12), deadline=d(-3),
                   milestones=[Milestone(title="m", due=d(-3), done=False)])
    tiers = {e.tier for e in st.agent_events(c, AS_OF)}
    assert "founder" in tiers  # a missed item gets escalated to the founders
