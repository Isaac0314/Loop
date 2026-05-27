"""Demo data, dated relative to today so the board always looks live on first
run. Inserted only when the database is empty."""
from __future__ import annotations

import datetime as dt

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Commitment, Milestone, Slip, Update


def _d(days: int) -> dt.date:
    return dt.date.today() + dt.timedelta(days=days)


def is_empty(db: Session) -> bool:
    return db.scalar(select(Commitment).limit(1)) is None


def seed(db: Session) -> None:
    if not is_empty(db):
        return

    items: list[Commitment] = []

    # Engineering - on track
    items.append(Commitment(
        title="Ship onboarding flow v2", team="Engineering", owner="Sam Park",
        start=_d(-10), deadline=_d(12),
        milestones=[
            Milestone(title="Spec sign-off", due=_d(-7), done=True, done_on=_d(-7)),
            Milestone(title="Build", due=_d(4), done=False),
            Milestone(title="Staging", due=_d(9), done=False),
            Milestone(title="Ship", due=_d(12), done=False),
        ],
        updates=[Update(text="Build ~60% done, on track for staging.", date=_d(-2))],
    ))

    # Engineering - at risk (deadline close + no recent update)
    items.append(Commitment(
        title="API rate-limiting", team="Engineering", owner="Priya Nair",
        start=_d(-14), deadline=_d(2),
        milestones=[
            Milestone(title="Design", due=_d(-9), done=True, done_on=_d(-9)),
            Milestone(title="Rollout", due=_d(2), done=False),
        ],
        updates=[Update(text="Design approved.", date=_d(-9))],
    ))

    # Commercial - at risk via repeated slips
    items.append(Commitment(
        title="Close pilot with Greenfield Estates", team="Commercial", owner="Marcus Lee",
        start=_d(-22), deadline=_d(-2),
        milestones=[
            Milestone(title="Proof of concept", due=_d(-16), done=True, done_on=_d(-16)),
            Milestone(title="Pilot", due=_d(-6), done=True, done_on=_d(-5)),
            Milestone(title="Contract", due=_d(1), done=False),
            Milestone(title="Signature", due=_d(4), done=False),
        ],
        updates=[Update(text="Legal reviewing the contract.", date=_d(-4))],
        slips=[
            Slip(from_date=_d(-2), to_date=_d(1), reason="legal review", date=_d(-9)),
            Slip(from_date=_d(1), to_date=_d(4), reason="counterparty delay", date=_d(-3)),
        ],
    ))

    # Founder's Office - missed
    items.append(Commitment(
        title="Send Q2 investor update", team="Founder's Office", owner="Dani Cohen",
        start=_d(-12), deadline=_d(-3),
        milestones=[Milestone(title="Draft numbers", due=_d(-3), done=False)],
        updates=[Update(text="Waiting on finance for the final figures.", date=_d(-6))],
    ))

    # Founder's Office - on track
    items.append(Commitment(
        title="Board pack", team="Founder's Office", owner="Dani Cohen",
        start=_d(-4), deadline=_d(16),
        milestones=[
            Milestone(title="Skeleton", due=_d(3), done=False),
            Milestone(title="Metrics", due=_d(9), done=False),
            Milestone(title="Review", due=_d(15), done=False),
        ],
        updates=[Update(text="Pulling last quarter's template.", date=_d(-1))],
    ))

    # Product - complete
    items.append(Commitment(
        title="Q3 roadmap sign-off", team="Product", owner="Lena Ortiz",
        start=_d(-18), deadline=_d(-1),
        milestones=[
            Milestone(title="Draft", due=_d(-12), done=True, done_on=_d(-12)),
            Milestone(title="Review", due=_d(-6), done=True, done_on=_d(-6)),
            Milestone(title="Sign-off", due=_d(-2), done=True, done_on=_d(-2)),
        ],
        updates=[Update(text="Signed off by the team.", date=_d(-2))],
    ))

    db.add_all(items)
    db.commit()
