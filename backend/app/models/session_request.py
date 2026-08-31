from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SessionRequest(Base):
    __tablename__ = "session_requests"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    requested_by: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    session_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    packets_used: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
    )

    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PENDING",
        server_default="PENDING",
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default="now()",
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    requester: Mapped["User"] = relationship(
        "User",
        foreign_keys=[requested_by],
    )

    reviewer: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[reviewed_by],
    )

    participants: Mapped[
        list["SessionRequestParticipant"]
    ] = relationship(
        "SessionRequestParticipant",
        back_populates="request",
        cascade="all, delete-orphan",
    )