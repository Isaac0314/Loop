"""Pydantic request/response models. Response models carry the *computed*
status fields (filled by the routers via status.py), never stored values."""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, Field


# ---- nested ----
class MilestoneOut(BaseModel):
    id: str
    title: str
    due: dt.date
    done: bool
    done_on: dt.date | None = None


class UpdateOut(BaseModel):
    id: str
    text: str
    date: dt.date


class SlipOut(BaseModel):
    id: str
    from_date: dt.date
    to_date: dt.date
    reason: str
    date: dt.date


class AgentEventOut(BaseModel):
    date: dt.date
    tier: str
    commitment_id: str
    message: str


class ActivityOut(BaseModel):
    """An agent event enriched with its commitment's title + owner, for the
    cross-commitment activity feed (the right rail)."""
    date: dt.date
    tier: str
    commitment_id: str
    title: str
    owner: str
    message: str


# ---- commitment ----
class CommitmentOut(BaseModel):
    id: str
    title: str
    team: str
    owner: str
    source: str
    start: dt.date
    deadline: dt.date
    eff_deadline: dt.date
    status: str
    days_left: int
    slip_count: int
    next_milestone: str | None = None
    last_reached: str | None = None
    milestones: list[MilestoneOut] = []
    updates: list[UpdateOut] = []
    slips: list[SlipOut] = []
    events: list[AgentEventOut] = []


class CommitmentCreate(BaseModel):
    title: str
    team: str = "General"
    owner: str = "Unassigned"
    source: str = "manual"
    start: dt.date | None = None
    deadline: dt.date | None = None
    milestones: list[str] = Field(default_factory=list)  # titles; due dates auto-spaced


class CommitmentPatch(BaseModel):
    title: str | None = None
    team: str | None = None
    owner: str | None = None
    deadline: dt.date | None = None


class MilestoneCreate(BaseModel):
    title: str
    due: dt.date | None = None


class MilestonePatch(BaseModel):
    done: bool


class UpdateCreate(BaseModel):
    text: str
    date: dt.date | None = None


class RescheduleIn(BaseModel):
    to: dt.date
    reason: str = "rescheduled"


# ---- agent ----
class BriefIn(BaseModel):
    as_of: dt.date | None = None


class AskIn(BaseModel):
    q: str
    as_of: dt.date | None = None


class SuggestIn(BaseModel):
    title: str
    team: str = ""
    start: dt.date | None = None
    deadline: dt.date | None = None


class Health(BaseModel):
    ok: bool = True
    model: str
    model_ask: str
    key: bool
    live: bool
