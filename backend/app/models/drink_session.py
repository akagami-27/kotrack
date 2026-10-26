from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

DEFAULT_PRICE_PER_PACKET = Decimal("25.00")


class DrinkSession(Base):
    __tablename__ = "drink_sessions"

    __table_args__ = (
    CheckConstraint("packets_used > 0", name="ck_drink_session_packets_positive"),
    CheckConstraint(
        "price_per_packet > 0",
        name="ck_drink_session_price_positive",
    ),
    CheckConstraint(
        "total_cost >= 0",
        name="ck_drink_session_total_nonnegative",
    ),
)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Supports fractional packets such as 0.5, 1, 1.5, 2.
    packets_used: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)

    price_per_packet: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=DEFAULT_PRICE_PER_PACKET,
        server_default=str(DEFAULT_PRICE_PER_PACKET),
    )

    # Always computed and set by the backend (see app/services/financial.py).
    # Never trust a value supplied by a client for this column.
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Preserve the actor's authority at creation across later role changes.
    creator_role_at_creation: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    handler_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    creator: Mapped["User"] = relationship(
        back_populates="created_sessions", foreign_keys=[created_by]
    )

    handler: Mapped["User | None"] = relationship(
        "User", foreign_keys=[handler_id]
    )

    participants: Mapped[list["SessionParticipant"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def handler_name(self) -> str | None:
        return self.handler.name if self.handler is not None else None

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<DrinkSession id={self.id} date={self.session_date} "
            f"packets={self.packets_used} total={self.total_cost}>"
        )
