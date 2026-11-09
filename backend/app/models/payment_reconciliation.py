"""
PaymentReconciliation — append-only audit record for each manual
reconciliation batch applied to a confirmed payment.

Each reconciliation groups one or more PaymentAllocation rows under a
single auditable event (who reconciled, which handler, when, notes).
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PaymentReconciliation(Base):
    __tablename__ = "payment_reconciliations"

    id: Mapped[int] = mapped_column(primary_key=True)

    # The confirmed payment being reconciled.
    payment_id: Mapped[int] = mapped_column(
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # The Admin whose sessions this reconciliation targets.
    # Determined at first reconciliation and cannot change.
    handler_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # The Admin or Super Admin who performed this reconciliation action.
    reconciled_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Optional free-text note attached to this reconciliation batch.
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # RELATIONSHIPS

    payment: Mapped["Payment"] = relationship(
        foreign_keys=[payment_id],
    )

    handler: Mapped["User"] = relationship(
        foreign_keys=[handler_id],
    )

    reconciler: Mapped["User"] = relationship(
        foreign_keys=[reconciled_by],
    )

    allocations: Mapped[list["PaymentAllocation"]] = relationship(
        back_populates="reconciliation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<PaymentReconciliation id={self.id} "
            f"payment_id={self.payment_id} "
            f"handler_id={self.handler_id} "
            f"reconciled_by={self.reconciled_by}>"
        )
