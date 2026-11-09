
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_payment_allocation_amount_positive",
        ),
        CheckConstraint(
            "allocation_type IN ('MANUAL', 'FIFO')",
            name="ck_payment_allocation_type",
        ),
        # NOTE: The unique constraint (payment_id, session_participant_id)
        # was intentionally dropped to allow multiple partial reconciliations
        # targeting the same session participant over time.
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    payment_id: Mapped[int] = mapped_column(
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    session_participant_id: Mapped[int] = mapped_column(
        ForeignKey("session_participants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Links this allocation to a PaymentReconciliation audit batch.
    # Nullable to remain compatible with legacy FIFO-generated allocations
    # that pre-date the reconciliation audit table.
    reconciliation_id: Mapped[int | None] = mapped_column(
        ForeignKey("payment_reconciliations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    allocation_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="MANUAL",
        server_default="MANUAL",
    )

    allocated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    payment: Mapped["Payment"] = relationship(
        back_populates="allocations",
    )

    session_participant: Mapped["SessionParticipant"] = relationship(
        back_populates="payment_allocations",
    )

    allocator: Mapped["User | None"] = relationship(
        foreign_keys=[allocated_by],
    )

    reconciliation: Mapped["PaymentReconciliation | None"] = relationship(
        back_populates="allocations",
        foreign_keys=[reconciliation_id],
    )
