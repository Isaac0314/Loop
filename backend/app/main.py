"""FastAPI application: creates tables, seeds demo data on first run, mounts
the routers, and enables CORS for the Vite frontend."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import SessionLocal, init_db
from .routers import agent, commitments
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    yield


app = FastAPI(title="LightWork Ops API", version="0.1.0", lifespan=lifespan)

_origins = ["*"] if settings.cors_origins.strip() == "*" else [
    o.strip() for o in settings.cors_origins.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(commitments.router)
app.include_router(agent.router)


@app.get("/", tags=["meta"])
def root():
    return {"name": "LightWork Ops API", "docs": "/docs", "health": "/api/health"}
