from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"
    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED_LEGACY')", name="ck_password_reset_requests_status"),
        Index("uq_password_reset_open_request_per_user", "user_id", unique=True, postgresql_where=text("status IN ('PENDING', 'APPROVED')")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    used: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    approved_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    rejected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    rejected_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # State and short-lived browser continuity are stored server-side.
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="PENDING", server_default="PENDING"
    )
    reset_session_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    session_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(
        foreign_keys=[user_id],
    )

    approver: Mapped["User | None"] = relationship(
        foreign_keys=[approved_by],
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<PasswordResetRequest "
            f"id={self.id} "
            f"user_id={self.user_id} "
            f"used={self.used}>"
        )
