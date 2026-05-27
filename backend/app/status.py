"""The status + escalation engine: pure functions over a commitment.

This is the heart of the "code owns the facts" design. Status, effective
deadlines and the agent's escalation ladder are *computed* here, deterministically,
as of a reference date. The LLM is never asked to decide any of them, so it can
never hallucinate a status, a date, or an escalation.

Everything takes an `as_of` date, which is normally "today" but can be moved
forward to preview how the board evolves (the "skip a week" feature).
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from .models import Commitment, Milestone

APPROACH_DAYS = 3  # a deadline this close (or closer) counts as "approaching"
STALE_DAYS = 4     # no update in this many days counts as "quiet"


def first_name(owner: str) -> str:
    return (owner or "").split(" ")[0] or owner


def eff_deadline(c: Commitment, as_of: dt.date) -> dt.date:
    """The current deadline, accounting for any slips logged on/before as_of."""
    slips = [s for s in c.slips if s.date <= as_of]
    if slips:
        return max(slips, key=lambda s: s.date).to_date
    return c.deadline


def slip_count(c: Commitment, as_of: dt.date) -> int:
    return len([s for s in c.slips if s.date <= as_of])


def last_update_date(c: Commitment, as_of: dt.date) -> dt.date | None:
    dates = [u.date for u in c.updates if u.date <= as_of]
    return max(dates) if dates else None


def update_age(c: Commitment, as_of: dt.date) -> int:
    base = last_update_date(c, as_of) or c.start
    return (as_of - base).days


def is_complete(c: Commitment, as_of: dt.date) -> bool:
    if not c.milestones:
        return False
    return all(m.done and m.done_on and m.done_on <= as_of for m in c.milestones)


def status(c: Commitment, as_of: dt.date) -> str:
    """One of: complete | missed | at_risk | on_track."""
    if is_complete(c, as_of):
        return "complete"
    dl = eff_deadline(c, as_of)
    if as_of > dl:
        return "missed"
    days_left = (dl - as_of).days
    approaching_and_quiet = days_left <= APPROACH_DAYS and update_age(c, as_of) > STALE_DAYS
    if approaching_and_quiet or slip_count(c, as_of) >= 2:
        return "at_risk"
    return "on_track"


def next_milestone(c: Commitment, as_of: dt.date) -> Milestone | None:
    for m in sorted(c.milestones, key=lambda m: m.due):
        if not (m.done and m.done_on and m.done_on <= as_of):
            return m
    return None


def last_reached(c: Commitment, as_of: dt.date) -> Milestone | None:
    reached = [m for m in c.milestones if m.done and m.done_on and m.done_on <= as_of]
    return max(reached, key=lambda m: m.done_on) if reached else None


@dataclass
class AgentEvent:
    date: dt.date
    tier: str            # owner | fa | founder | log
    commitment_id: str
    message: str


def agent_events(c: Commitment, as_of: dt.date) -> list[AgentEvent]:
    """Derive the agent's escalation ladder for one commitment, as of `as_of`.

    The ladder: nudge the owner when a deadline approaches and they have gone
    quiet -> escalate to the Founder's Associate if the nudge is ignored ->
    escalate a miss to the founders. Repeated slips raise a pattern flag.
    Pure and deterministic: this is what the agent *did*, not what it guessed.
    """
    out: list[AgentEvent] = []
    first = first_name(c.owner)
    nudged = esc_fa = missed_fired = False
    nudge_date: dt.date | None = None
    seen = 0

    day = c.start
    while day <= as_of:
        st = status(c, day)
        dl = eff_deadline(c, day)

        for s in c.slips:
            if s.date == day:
                seen += 1
                tail = " First slip." if seen == 1 else ""
                out.append(AgentEvent(day, "log", c.id,
                    f"{c.title} moved {s.from_date:%d %b} to {s.to_date:%d %b}: {s.reason}.{tail}"))
                if seen >= 2:
                    out.append(AgentEvent(day, "fa", c.id,
                        f"{c.title} ({c.team}, {c.owner}) has slipped {seen} times, a pattern. "
                        f"Worth a direct ask to {first} on what's blocking."))

        if (st == "at_risk" and (dl - day).days <= APPROACH_DAYS
                and update_age(c, day) > STALE_DAYS and not nudged):
            nudged, nudge_date = True, day
            out.append(AgentEvent(day, "owner", c.id,
                f"@{first} - {c.title} is due {dl:%d %b} and I've had no update in "
                f"{update_age(c, day)} days. Quick read on where it stands?"))

        if st == "at_risk" and nudged and not esc_fa and nudge_date and (day - nudge_date).days >= 2:
            esc_fa = True
            out.append(AgentEvent(day, "fa", c.id,
                f"{c.title} ({c.team}, {c.owner}) is at risk, due {dl:%d %b}, "
                f"{update_age(c, day)} days quiet, no response to the nudge. Suggest a 10-min check-in."))

        if st == "missed" and not missed_fired:
            missed_fired = True
            out.append(AgentEvent(day, "founder", c.id,
                f"{c.title} missed its {dl:%d %b} deadline ({c.owner}). "
                f"Recommend a founder nudge to {first} and a revised date today."))

        day += dt.timedelta(days=1)

    return out
