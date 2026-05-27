"""Service layer: the only place that mutates commitments. Both the REST CRUD
routes and the agent's `act` endpoint call these, so an AI-driven action and a
button click go through identical, validated code paths. The model proposes;
this layer disposes."""
from __future__ import annotations

import datetime as dt
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import status as st
from .models import Commitment, Milestone, Slip, Update

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
_DATE_FORMATS = ("%Y-%m-%d", "%d %b %Y", "%d %B %Y", "%d %b", "%d %B",
                 "%b %d", "%B %d", "%d/%m/%Y", "%m/%d/%Y")


def parse_date(s: str | None, as_of: dt.date) -> dt.date | None:
    """Turn a natural date phrase into a date, relative to `as_of`.
    Handles ISO dates, today/tomorrow, 'in N days/weeks', '+Nd', 'next week',
    'end of month', weekday names, and a few common written formats."""
    s = (s or "").strip().lower().rstrip(".?!")
    if not s:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        try:
            return dt.date.fromisoformat(s)
        except ValueError:
            pass
    if s == "today":
        return as_of
    if s == "tomorrow":
        return as_of + dt.timedelta(days=1)
    m = re.match(r"in\s+(\d+)\s*(day|week)", s)
    if m:
        return as_of + dt.timedelta(days=int(m[1]) * (7 if m[2] == "week" else 1))
    m = re.fullmatch(r"\+?(\d+)\s*d", s)
    if m:
        return as_of + dt.timedelta(days=int(m[1]))
    if "next week" in s:
        return as_of + dt.timedelta(days=7)
    if "end of month" in s:
        first_next = (as_of.replace(day=1) + dt.timedelta(days=32)).replace(day=1)
        return first_next - dt.timedelta(days=1)
    for i, wd in enumerate(WEEKDAYS):
        if wd in s:
            for n in range(1, 8):
                d = as_of + dt.timedelta(days=n)
                if d.weekday() == i:
                    return d
    for fmt in _DATE_FORMATS:
        try:
            d = dt.datetime.strptime(s, fmt).date()
            return d.replace(year=as_of.year) if "%Y" not in fmt else d
        except ValueError:
            continue
    return None


def find_by_title(db: Session, title: str) -> Commitment | None:
    """Exact title match, else a loose contains match on title words."""
    if not title:
        return None
    rows = list(db.scalars(select(Commitment)))
    for c in rows:
        if c.title == title:
            return c
    t = title.lower()
    words = [w for w in re.split(r"\s+", t) if len(w) > 3]
    for c in rows:
        ct = c.title.lower()
        if t in ct or any(w in ct for w in words):
            return c
    return None


def create_commitment(db, *, title, team="General", owner="Unassigned",
                      source="manual", start=None, deadline=None,
                      milestone_titles=None) -> Commitment:
    today = dt.date.today()
    start = start or today
    deadline = deadline or (start + dt.timedelta(days=14))
    c = Commitment(title=title.strip(), team=team or "General",
                   owner=owner or "Unassigned", source=source,
                   start=start, deadline=deadline)
    titles = [t.strip() for t in (milestone_titles or []) if t.strip()]
    span = max(1, (deadline - start).days)
    for k, mt in enumerate(titles):
        due = start + dt.timedelta(days=round(span * (k + 1) / (len(titles) + 1)))
        c.milestones.append(Milestone(title=mt, due=due, done=False))
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def add_milestone(db, c: Commitment, title: str, due: dt.date | None) -> Milestone:
    as_of = dt.date.today()
    m = Milestone(title=title.strip(), due=due or st.eff_deadline(c, as_of), done=False)
    c.milestones.append(m)
    db.commit()
    db.refresh(m)
    return m


def toggle_milestone(db, m: Milestone, as_of: dt.date) -> Milestone:
    m.done = not m.done
    m.done_on = as_of if m.done else None
    db.commit()
    db.refresh(m)
    return m


def log_update(db, c: Commitment, text: str, date: dt.date | None) -> Update:
    u = Update(text=text.strip(), date=date or dt.date.today())
    c.updates.append(u)
    db.commit()
    db.refresh(u)
    return u


def reschedule(db, c: Commitment, to: dt.date, reason: str, as_of: dt.date) -> Slip:
    s = Slip(from_date=st.eff_deadline(c, as_of), to_date=to,
             reason=reason or "rescheduled", date=as_of)
    c.slips.append(s)
    db.commit()
    db.refresh(s)
    return s
