"""Agent endpoints: health, the weekly brief, grounded Ask, AI-driven actions
(`/act`), and milestone suggestions. The LLM parses; the service layer executes;
deterministic fallbacks keep everything working if Kimi is unreachable."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import ai, service
from .. import status as st
from ..config import settings
from ..database import get_db
from ..models import Commitment
from ..schemas import ActivityOut, AskIn, BriefIn, Health, SuggestIn
from ..seed import seed
from .commitments import _as_of, serialize

router = APIRouter(prefix="/api", tags=["agent"])


def _context(db: Session, as_of: dt.date) -> list[dict]:
    """Compact, computed snapshot of every commitment for the model."""
    ctx = []
    for c in db.scalars(select(Commitment)):
        nm, lr, dl = st.next_milestone(c, as_of), st.last_reached(c, as_of), st.eff_deadline(c, as_of)
        ctx.append({
            "title": c.title, "team": c.team, "owner": c.owner,
            "status": st.status(c, as_of), "deadline": dl.strftime("%d %b %Y"),
            "due_in_days": (dl - as_of).days, "slips": st.slip_count(c, as_of),
            "next_milestone": nm.title if nm else "none",
            "reached": lr.title if lr else "none",
            "milestones": [{"title": m.title, "due": m.due.strftime("%d %b"),
                            "done": bool(m.done and m.done_on and m.done_on <= as_of)}
                           for m in c.milestones],
        })
    return ctx


def _det_brief(db: Session, as_of: dt.date) -> str:
    rows = list(db.scalars(select(Commitment)))
    by: dict[str, list[Commitment]] = {}
    for c in rows:
        by.setdefault(c.team, []).append(c)
    lines = ["**By team**"]
    for team, cs in by.items():
        lines.append(f"**{team}**")
        for c in cs:
            nm = st.next_milestone(c, as_of)
            lines.append(f"- **{c.title}**: working on {nm.title if nm else 'wrap-up'}, "
                         f"due {st.eff_deadline(c, as_of):%d %b}, {st.status(c, as_of).replace('_', ' ')}.")
    risk = sorted([c for c in rows if st.status(c, as_of) in ("missed", "at_risk")],
                  key=lambda c: 0 if st.status(c, as_of) == "missed" else 1)
    lines.append("\n**Needs attention**")
    if risk:
        for c in risk:
            lines.append(f"- **{c.title}** ({c.owner}): {st.status(c, as_of).replace('_', ' ')}. "
                         f"I'll chase {st.first_name(c.owner)} for an update.")
    else:
        lines.append("- Nothing missed or at risk.")
    return "\n".join(lines)


def _det_ask(db: Session, as_of: dt.date) -> str:
    rows = list(db.scalars(select(Commitment)))
    risk = sorted([c for c in rows if st.status(c, as_of) in ("missed", "at_risk")],
                  key=lambda c: 0 if st.status(c, as_of) == "missed" else 1)
    if not risk:
        return "Nothing's missed or at risk right now."
    return "\n".join(f"- **{c.title}** ({c.owner}): {st.status(c, as_of).replace('_', ' ')}. "
                     f"I'll chase {st.first_name(c.owner)}." for c in risk)


@router.get("/health", response_model=Health)
def health():
    return Health(model=settings.kimi_model, model_ask=settings.kimi_model_ask,
                  key=ai.has_key(), live=ai.is_live())


@router.post("/brief")
def brief(body: BriefIn, db: Session = Depends(get_db)):
    ao = _as_of(body.as_of)
    try:
        return {"answer": ai.brief(_context(db, ao), ao.strftime("%d %b %Y")), "live": True}
    except Exception:
        return {"answer": _det_brief(db, ao), "live": False}


@router.post("/ask")
def ask(body: AskIn, db: Session = Depends(get_db)):
    ao = _as_of(body.as_of)
    try:
        return {"answer": ai.ask(_context(db, ao), ao.strftime("%d %b %Y"), body.q)}
    except Exception:
        return {"answer": _det_ask(db, ao)}


@router.post("/act")
def act(body: AskIn, db: Session = Depends(get_db)):
    """Parse the instruction via Kimi; if it's an action, execute it through the
    service layer; otherwise answer the question."""
    ao = _as_of(body.as_of)
    try:
        r = ai.classify(_context(db, ao), ao.strftime("%d %b %Y"), body.q)
    except Exception:
        return {"action": "answer", "answer": _det_ask(db, ao)}

    action = (r or {}).get("action")
    if action == "reschedule":
        c = service.find_by_title(db, r.get("title", ""))
        d = service.parse_date(r.get("date", ""), ao)
        if c and d:
            service.reschedule(db, c, d, "rescheduled via agent", ao)
            return {"action": "reschedule",
                    "message": f'Done: moved "{c.title}" to {d:%d %b} and logged the slip.',
                    "commitment": serialize(c, ao)}
        return {"action": "error",
                "message": "I couldn't match that to a commitment, or read the date."}
    if action == "add_milestone":
        c = service.find_by_title(db, r.get("title", ""))
        if c:
            m = service.add_milestone(db, c, r.get("milestone") or "Next step",
                                      service.parse_date(r.get("date", ""), ao))
            return {"action": "add_milestone",
                    "message": f'Added milestone "{m.title}" to "{c.title}".',
                    "commitment": serialize(c, ao)}
        return {"action": "error", "message": "I couldn't match that to a commitment."}
    if action == "create":
        c = service.create_commitment(
            db, title=r.get("newTitle") or body.q, team="Founder's Office",
            owner=r.get("owner") or "Unassigned", source="agent",
            start=ao, deadline=service.parse_date(r.get("date", ""), ao))
        return {"action": "create", "message": f'Created "{c.title}".',
                "commitment": serialize(c, ao)}

    try:
        return {"action": "answer", "answer": ai.ask(_context(db, ao), ao.strftime("%d %b %Y"), body.q)}
    except Exception:
        return {"action": "answer", "answer": _det_ask(db, ao)}


@router.post("/suggest-milestones")
def suggest(body: SuggestIn):
    try:
        return {"milestones": ai.suggest_milestones(
            body.title, body.team, str(body.start or ""), str(body.deadline or ""))}
    except Exception:
        return {"milestones": []}


@router.get("/activity", response_model=list[ActivityOut])
def activity(as_of: dt.date | None = Query(None), db: Session = Depends(get_db)):
    """Every commitment's escalation ladder, flattened into one feed (newest
    first). The ladder itself is computed deterministically in status.py."""
    ao = _as_of(as_of)
    out: list[ActivityOut] = []
    for c in db.scalars(select(Commitment)):
        for e in st.agent_events(c, ao):
            out.append(ActivityOut(date=e.date, tier=e.tier, commitment_id=c.id,
                                   title=c.title, owner=c.owner, message=e.message))
    out.sort(key=lambda e: e.date, reverse=True)
    return out


@router.post("/demo/reset")
def demo_reset(db: Session = Depends(get_db)):
    """Wipe and re-seed the demo scenario. Handy for kicking the tyres; in a
    real deployment you'd protect or remove this."""
    for c in db.scalars(select(Commitment)).all():
        db.delete(c)  # cascades to milestones / updates / slips
    db.commit()
    seed(db)
    return {"ok": True}
