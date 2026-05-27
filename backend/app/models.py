"""ORM models. A commitment is the unit of work; milestones, updates and slips
hang off it. Status is never stored, it is computed (see status.py)."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def uid() -> str:
    return uuid.uuid4().hex[:12]


class Commitment(Base):
    __tablename__ = "commitments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String)
    team: Mapped[str] = mapped_column(String, default="General")
    owner: Mapped[str] = mapped_column(String, default="Unassigned")
    source: Mapped[str] = mapped_column(String, default="manual")  # manual | agent
    start: Mapped[dt.date] = mapped_column(Date)
    deadline: Mapped[dt.date] = mapped_column(Date)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())

    milestones: Mapped[list[Milestone]] = relationship(
        back_populates="commitment",
        cascade="all, delete-orphan",
        order_by="Milestone.due",
    )
    updates: Mapped[list[Update]] = relationship(
        back_populates="commitment",
        cascade="all, delete-orphan",
        order_by="Update.date",
    )
    slips: Mapped[list[Slip]] = relationship(
        back_populates="commitment",
        cascade="all, delete-orphan",
        order_by="Slip.date",
    )


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    commitment_id: Mapped[str] = mapped_column(
        ForeignKey("commitments.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String)
    due: Mapped[dt.date] = mapped_column(Date)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    done_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)

    commitment: Mapped[Commitment] = relationship(back_populates="milestones")


class Update(Base):
    __tablename__ = "updates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    commitment_id: Mapped[str] = mapped_column(
        ForeignKey("commitments.id", ondelete="CASCADE")
    )
    text: Mapped[str] = mapped_column(String)
    date: Mapped[dt.date] = mapped_column(Date)

    commitment: Mapped[Commitment] = relationship(back_populates="updates")


class Slip(Base):
    __tablename__ = "slips"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    commitment_id: Mapped[str] = mapped_column(
        ForeignKey("commitments.id", ondelete="CASCADE")
    )
    from_date: Mapped[dt.date] = mapped_column(Date)
    to_date: Mapped[dt.date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(String, default="")
    date: Mapped[dt.date] = mapped_column(Date)  # when the slip was logged

    commitment: Mapped[Commitment] = relationship(back_populates="slips")
