# Loop AI

**A founder's-office operations agent that tracks commitments across teams, computes their status deterministically, and uses an LLM only to write the words.**

![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

Loop AI answers a founder's recurring question, *"what did we commit to, and what's slipping?"*, and then does something about it: it nudges owners, escalates patterns, drafts the messages, and writes a weekly brief.

The interesting part is the architecture, not the to-do list.

---

## The design thesis

> **Code owns the facts. The LLM owns the language.**

Every fact a founder would act on (a status, an effective deadline, a slip count, whether an item should escalate to the founders) is computed by a small, pure, fully-tested Python engine (`backend/app/status.py`). The language model is **never** asked to decide any of them, so it can never hallucinate a status, invent a date, or quietly escalate the wrong thing.

The LLM does two things it is genuinely good at:

1. **Writing**: turning the computed snapshot into a readable weekly brief and grounded answers.
2. **Parsing intent**: turning *"push the Greenfield pilot to next Friday"* into a strict JSON action that the **service layer executes**. The model proposes; the code disposes.

And because the facts are code, the whole thing **degrades gracefully**: with no API key the brief, the "ask", and the actions all fall back to deterministic output. The app still runs, still computes, still escalates. You only lose the prose polish.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full write-up.

---

## Screenshots

<!-- To add a screenshot to this README: run the app (one command, below), grab the
     dashboard, save it as docs/screenshot.png, and uncomment the line beneath. -->
<!-- ![Loop AI dashboard](docs/screenshot.png) -->

The dashboard is a calm, Linear/Attio-flavoured board: a **weekly brief** hero, a sortable **commitments list** (and a **Gantt timeline**), and an **agent activity rail** showing every nudge and escalation the agent has taken, each with copy-ready Slack/email drafts.

---

## Features

- **Deterministic status engine**: `on_track | at_risk | missed | complete`, plus effective deadlines, slip counts, and the escalation ladder, all computed as of any reference date.
- **Time-travel (`as_of`)**: preview how the board evolves a week or a month out, server-side, without mutating anything. ("Skip a week".)
- **Weekly Ops Brief**: grouped by team with a missed-first "needs attention" section. Live via Kimi, or deterministic fallback.
- **Ask and Act**: one endpoint (`/api/act`) classifies a natural-language instruction and either answers the question or executes the mutation (reschedule / add milestone / create) through the typed service layer.
- **Agent activity rail**: owner nudges, FA escalations, and founder escalations, each derived deterministically from the data, with ready-to-send message drafts.
- **Full CRUD** over commitments, milestones, updates, and reschedules (slips).
- **Runs with zero config**: SQLite plus deterministic AI fallbacks out of the box; Postgres- and Kimi-ready when you want them.

---

## Quickstart

### Option A: Docker (one command)

```bash
docker compose up --build
# open http://localhost:8080
```

The Kimi key is optional. To enable live AI, pass it through:

```bash
KIMI_API_KEY=sk-... docker compose up --build
```

### Option B: run the two services directly

**Backend** (FastAPI, port 8000):

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows
#                       source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend** (React + Vite, port 5173, proxies `/api` to the backend):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. On first run the backend seeds a realistic six-commitment demo scenario.

---

## Configuration

All backend settings are environment variables (see `backend/.env.example`). Everything is optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./loop_ai.db` | SQLite by default; point at Postgres for production. |
| `KIMI_API_KEY` | _(empty)_ | Moonshot/Kimi key. Empty means deterministic fallbacks. **Stays server-side; never sent to the browser.** |
| `KIMI_MODEL` | `moonshot-v1-32k` | Model for the brief and parsing. |
| `CORS_ORIGINS` | `*` | Comma-separated allow-list; lock down in production. |

---

## API reference

All routes are under `/api`. Reads accept an optional `?as_of=YYYY-MM-DD` for time-travel.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Model name, key present, and live-reachability. |
| `GET` | `/commitments` | List, with computed status, sorted missed-first. |
| `POST` | `/commitments` | Create (optional milestone titles, auto-spaced). |
| `GET` | `/commitments/{id}` | One commitment plus its agent event ladder. |
| `PATCH` / `DELETE` | `/commitments/{id}` | Update / delete. |
| `POST` | `/commitments/{id}/milestones` · `/updates` · `/reschedule` | Add a milestone / log an update / push the deadline (logs a slip). |
| `PATCH` | `/commitments/{id}/milestones/{mid}` | Toggle a milestone done. |
| `GET` | `/activity` | Cross-commitment escalation feed. |
| `POST` | `/brief` | Weekly brief (live or deterministic). |
| `POST` | `/ask` | Grounded Q&A over the board. |
| `POST` | `/act` | Classify an instruction, then answer or execute an action. |
| `POST` | `/suggest-milestones` | AI milestone suggestions for a new commitment. |
| `POST` | `/demo/reset` | Wipe and re-seed the demo scenario. |

Interactive docs (Swagger) are at `/docs` when the backend is running.

---

## Project structure

```
loop-ai/
├── backend/                 FastAPI + SQLAlchemy 2.0 + Pydantic v2
│   ├── app/
│   │   ├── status.py        the deterministic engine (the heart)
│   │   ├── service.py       mutations + natural-language date parsing
│   │   ├── ai.py            Kimi client + prompts (parse/write only)
│   │   ├── models.py        ORM;  schemas.py  Pydantic I/O
│   │   └── routers/         commitments.py, agent.py
│   └── tests/               pytest: engine + API (no key required)
├── frontend/                React + Vite + TypeScript
│   └── src/
│       ├── api/             typed client mirroring the schemas
│       ├── store/           context store; mutate-then-refetch
│       ├── lib/             formatting, filtering, markdown
│       └── components/      Header, Brief, Table, Timeline, Feed, Drawers
├── docs/ARCHITECTURE.md
└── docker-compose.yml
```

---

## Testing

```bash
cd backend && pytest -q          # engine + API tests (run with or without a key)
cd frontend && npm run build     # tsc typecheck + production bundle
```

CI runs both on every push (`.github/workflows/ci.yml`).

---

## Roadmap

This is a deliberately lean v1. Natural next steps:

- **Auth and multi-tenant**: users, workspaces, per-team access.
- **Real-time**: websocket push so the board and feed update live.
- **A real scheduler**: fire the Monday brief and the nudges on a cron, not on demand.
- **Migrations**: Alembic in place of `create_all`.
- **Real integrations**: post the drafted nudges to Slack/email instead of copy-to-clipboard.

---

## License

[MIT](LICENSE) © 2026 Isaac Luo
