from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import PaymentStatus


class Payment(Base):
    __tablename__ = "payments"

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_payment_amount_positive",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    status: Mapped[PaymentStatus] = mapped_column(
        Enum(
            PaymentStatus,
            name="payment_status",
            native_enum=True,
        ),
        nullable=False,
        default=PaymentStatus.PENDING,
        server_default=PaymentStatus.PENDING.value,
        index=True,
    )

    # ========================================================================
    # RECEIPT / PAYMENT PROOF
    # ========================================================================

    receipt_data: Mapped[bytes | None] = mapped_column(
        LargeBinary,
        nullable=True,
    )

    receipt_filename: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    receipt_content_type: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    receipt_file_size: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    receipt_sha256: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )

    receipt_uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ========================================================================
    # PAYMENT CONFIRMATION
    # ========================================================================

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    confirmed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ========================================================================
    # RELATIONSHIPS
    # ========================================================================

    user: Mapped["User"] = relationship(
        back_populates="payments",
        foreign_keys=[user_id],
    )

    confirmer: Mapped["User | None"] = relationship(
        foreign_keys=[confirmed_by],
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Payment id={self.id} "
            f"user_id={self.user_id} "
            f"amount={self.amount} "
            f"status={self.status}>"
        )