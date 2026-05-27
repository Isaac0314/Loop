"""REST CRUD for commitments and their milestones / updates / slips.
Every response carries the computed status (status.py); `as_of` lets a client
preview a future date (the 'skip a week' feature) without mutating anything."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import service
from .. import status as st
from ..database import get_db
from ..models import Commitment, Milestone
from ..schemas import (
    AgentEventOut, CommitmentCreate, CommitmentOut, CommitmentPatch,
    MilestoneCreate, MilestoneOut, MilestonePatch, RescheduleIn, SlipOut,
    UpdateCreate, UpdateOut,
)

router = APIRouter(prefix="/api/commitments", tags=["commitments"])

_ORDER = {"missed": 0, "at_risk": 1, "on_track": 2, "complete": 3}


def _as_of(as_of: dt.date | None) -> dt.date:
    return as_of or dt.date.today()


def serialize(c: Commitment, as_of: dt.date, events: bool = False) -> CommitmentOut:
    nm, lr, dl = st.next_milestone(c, as_of), st.last_reached(c, as_of), st.eff_deadline(c, as_of)
    out = CommitmentOut(
        id=c.id, title=c.title, team=c.team, owner=c.owner, source=c.source,
        start=c.start, deadline=c.deadline, eff_deadline=dl,
        status=st.status(c, as_of), days_left=(dl - as_of).days,
        slip_count=st.slip_count(c, as_of),
        next_milestone=nm.title if nm else None,
        last_reached=lr.title if lr else None,
        milestones=[MilestoneOut(id=m.id, title=m.title, due=m.due, done=m.done, done_on=m.done_on) for m in c.milestones],
        updates=[UpdateOut(id=u.id, text=u.text, date=u.date) for u in c.updates],
        slips=[SlipOut(id=s.id, from_date=s.from_date, to_date=s.to_date, reason=s.reason, date=s.date) for s in c.slips],
    )
    if events:
        out.events = [AgentEventOut(date=e.date, tier=e.tier, commitment_id=e.commitment_id, message=e.message)
                      for e in st.agent_events(c, as_of)]
    return out


def _get(db: Session, cid: str) -> Commitment:
    c = db.get(Commitment, cid)
    if not c:
        raise HTTPException(404, "commitment not found")
    return c


@router.get("", response_model=list[CommitmentOut])
def list_commitments(as_of: dt.date | None = Query(None), db: Session = Depends(get_db)):
    ao = _as_of(as_of)
    out = [serialize(c, ao) for c in db.scalars(select(Commitment))]
    out.sort(key=lambda o: (_ORDER.get(o.status, 9), o.eff_deadline))
    return out


@router.post("", response_model=CommitmentOut, status_code=201)
def create(body: CommitmentCreate, db: Session = Depends(get_db)):
    c = service.create_commitment(
        db, title=body.title, team=body.team, owner=body.owner, source=body.source,
        start=body.start, deadline=body.deadline, milestone_titles=body.milestones)
    return serialize(c, dt.date.today())


@router.get("/{cid}", response_model=CommitmentOut)
def get_one(cid: str, as_of: dt.date | None = Query(None), db: Session = Depends(get_db)):
    return serialize(_get(db, cid), _as_of(as_of), events=True)


@router.patch("/{cid}", response_model=CommitmentOut)
def patch(cid: str, body: CommitmentPatch, db: Session = Depends(get_db)):
    c = _get(db, cid)
    for field in ("title", "team", "owner", "deadline"):
        v = getattr(body, field)
        if v is not None:
            setattr(c, field, v)
    db.commit()
    db.refresh(c)
    return serialize(c, dt.date.today())


@router.delete("/{cid}", status_code=204)
def delete(cid: str, db: Session = Depends(get_db)):
    db.delete(_get(db, cid))
    db.commit()


@router.post("/{cid}/milestones", response_model=CommitmentOut)
def add_milestone(cid: str, body: MilestoneCreate, db: Session = Depends(get_db)):
    c = _get(db, cid)
    service.add_milestone(db, c, body.title, body.due)
    return serialize(c, dt.date.today())


@router.patch("/{cid}/milestones/{mid}", response_model=CommitmentOut)
def set_milestone(cid: str, mid: str, body: MilestonePatch, db: Session = Depends(get_db)):
    c = _get(db, cid)
    m = db.get(Milestone, mid)
    if not m or m.commitment_id != cid:
        raise HTTPException(404, "milestone not found")
    m.done = body.done
    m.done_on = dt.date.today() if body.done else None
    db.commit()
    return serialize(c, dt.date.today())


@router.post("/{cid}/updates", response_model=CommitmentOut)
def add_update(cid: str, body: UpdateCreate, db: Session = Depends(get_db)):
    c = _get(db, cid)
    service.log_update(db, c, body.text, body.date)
    return serialize(c, dt.date.today())


@router.post("/{cid}/reschedule", response_model=CommitmentOut)
def reschedule(cid: str, body: RescheduleIn, db: Session = Depends(get_db)):
    c = _get(db, cid)
    service.reschedule(db, c, body.to, body.reason, dt.date.today())
    return serialize(c, dt.date.today())
