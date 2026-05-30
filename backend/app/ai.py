"""The LLM layer: Kimi (Moonshot) for prose and for parsing an instruction into
a structured action. The API key stays here, server-side. The model owns the
*language* (and intent parsing); it never owns the facts or executes anything.
Every caller has a deterministic fallback, so the app works if Kimi is down."""
from __future__ import annotations

import json
import re
import time

import httpx

from .config import settings

SYSTEM = """You are the Loop AI agent, an operations chief-of-staff for a startup Founder's Associate who oversees every team. Answer the user's question directly and concisely from the commitments data in the user message, using short bullets. ONLY when the question is about risk, what needs attention, status, or what to fix should you list problems MISSED first then AT RISK, each with a one-line observation and a concrete mitigation you will take (chase the owner for a revised date, schedule a follow-up task, or assign an owner). For any other question (who owns something, a team, a deadline, a count, a yes/no), answer only what was asked and do NOT append the risk list. Speak as the agent that takes these actions ('I'll chase...', 'I can schedule...'), not as someone instructing the user. Never invent commitments, owners, dates, or statuses that are not in the data."""

BRIEF_SYSTEM = """You are the Loop AI agent writing the Monday weekly brief for a Founder's Associate who oversees every team. Use ONLY the commitments data provided. Write tight Markdown, no preamble, in this exact order:
**By team** - group the commitments under each team, using the team name as a bold heading line (not a bullet). Under each team, one bullet per commitment in this shape: the commitment name, then what they're working on (its next milestone), the date that milestone is due, and the current state (on track / at risk / missed). Example: '**Investor data room**: working on Audit room, due 28 May, at risk.' Keep each bullet to one line so the reader can gauge the project at a glance. Do NOT include mitigations, slip history, or problem detail here - that belongs only under Needs attention, so nothing is repeated.
**Needs attention** - bullets, MISSED first then AT RISK; each is a one-line observation plus a concrete mitigation you (the agent) will take (chase the owner, schedule a task, or assign an owner).
Use owners' full names. Do not add any closing summary or 'Action' line. Never invent commitments, owners, dates, milestones, or statuses."""

MILESTONE_SYSTEM = """You break a startup commitment into 3-5 concrete, sequential milestones that reflect how the work actually progresses (e.g. sales: proof of concept -> pilot -> contract -> signature -> deployment; engineering: spec sign-off -> build -> staging -> ship). Return ONLY the milestone titles, one per line, in order. No numbering, no commentary, 2-4 words each."""

ACT_SYSTEM = """You are the Loop AI agent. The user typed one instruction in the Ask box. Decide whether it is an ACTION on a commitment or a QUESTION, and reply with ONLY one JSON object and nothing else (no markdown, no code fence).
The commitments and their exact titles are in the user message. For an action on a commitment, set "title" to the EXACT title from that list, resolving partial, misspelled, or fuzzy references.
Use exactly one of these shapes:
{"action":"reschedule","title":"<exact title>","date":"<date phrase: next week, friday, 2026-06-12, in 5 days>"}
{"action":"add_milestone","title":"<exact title>","milestone":"<the milestone name from the user's own words, e.g. 'Signature' or 'Legal review', 2-4 words, never a placeholder>","date":"<date phrase or empty>"}
{"action":"create","newTitle":"<short task title>","owner":"<first name or empty>","date":"<date phrase or empty>"}
{"action":"answer"} - use this for any question, or anything that is not one of the three actions above.
Never invent titles, owners, or dates not supported by the data."""

_live_cache: dict = {"t": 0.0, "live": None}


def has_key() -> bool:
    return bool(settings.kimi_api_key)


def is_live() -> bool:
    """Whether this host can actually reach Kimi (cached 60s)."""
    if not settings.kimi_api_key:
        return False
    now = time.time()
    if _live_cache["live"] is not None and now - _live_cache["t"] < 60:
        return _live_cache["live"]
    live = False
    try:
        r = httpx.get(
            settings.kimi_base.rstrip("/") + "/models",
            headers={"Authorization": f"Bearer {settings.kimi_api_key}"},
            timeout=4,
        )
        live = r.status_code == 200
    except Exception:
        live = False
    _live_cache.update(t=now, live=live)
    return live


def _chat(system: str, user: str, model: str, timeout: float = 60) -> str:
    if not settings.kimi_api_key:
        raise RuntimeError("KIMI_API_KEY not configured")
    r = httpx.post(
        settings.kimi_base.rstrip("/") + "/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.kimi_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 1,
        },
        timeout=timeout,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def brief(context: list, today: str) -> str:
    user = "Today is %s.\nCommitments (JSON):\n%s\n\nWrite the weekly brief now." % (
        today, json.dumps(context, ensure_ascii=False))
    return _chat(BRIEF_SYSTEM, user, settings.kimi_model)


def ask(context: list, today: str, q: str) -> str:
    user = "Today is %s.\nCommitments (JSON):\n%s\n\nQuestion: %s" % (
        today, json.dumps(context, ensure_ascii=False), q)
    return _chat(SYSTEM, user, settings.kimi_model_ask)


def suggest_milestones(title: str, team: str, start: str, deadline: str) -> list[str]:
    user = "Commitment: %s (team: %s). Timeframe: %s to %s. List the milestones." % (
        title, team, start, deadline)
    txt = _chat(MILESTONE_SYSTEM, user, settings.kimi_model)
    return [re.sub(r"^[-*\d.\s]+", "", ln).strip() for ln in txt.splitlines() if ln.strip()]


def classify(context: list, today: str, q: str) -> dict:
    """Parse an instruction into a structured action (or {'action':'answer'})."""
    user = "Today is %s.\nCommitments (JSON):\n%s\n\nInstruction: %s" % (
        today, json.dumps(context, ensure_ascii=False), q)
    txt = _chat(ACT_SYSTEM, user, settings.kimi_model).strip()
    a, b = txt.find("{"), txt.rfind("}")
    if a < 0 or b < a:
        raise ValueError("no JSON object in act response")
    return json.loads(txt[a:b + 1])
