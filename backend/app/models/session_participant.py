from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SessionParticipant(Base):
    __tablename__ = "session_participants"

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "user_id",
            name="uq_session_participant",
        ),
        CheckConstraint(
            "amount_owed >= 0",
            name="ck_session_participant_amount_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    session_id: Mapped[int] = mapped_column(
        ForeignKey(
            "drink_sessions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Always computed by the backend.
    amount_owed: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    session: Mapped["DrinkSession"] = relationship(
        back_populates="participants",
    )

    user: Mapped["User"] = relationship(
        back_populates="participations",
        foreign_keys=[user_id],
    )

    @property
    def user_name(self) -> str:
        """Return the participant's current user name."""
        return self.user.name

    def __repr__(self) -> str:
        return (
            f"<SessionParticipant "
            f"session_id={self.session_id} "
            f"user_id={self.user_id} "
            f"amount_owed={self.amount_owed}>"
        )