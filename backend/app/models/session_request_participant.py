from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SessionRequestParticipant(Base):
    __tablename__ = "session_request_participants"

    __table_args__ = (
        UniqueConstraint(
            "request_id",
            "user_id",
            name="uq_session_request_participant",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    request_id: Mapped[int] = mapped_column(
        ForeignKey(
            "session_requests.id",
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

    request: Mapped["SessionRequest"] = relationship(
        back_populates="participants",
    )

    user: Mapped["User"] = relationship(
        back_populates="session_request_participations",
        foreign_keys=[user_id],
    )

    @property
    def user_name(self) -> str:
        """
        Return the name of the participant's user.

        This is used by SessionRequestParticipantRead,
        which expects a user_name field.
        """
        return self.user.name

    def __repr__(self) -> str:
        return (
            f"<SessionRequestParticipant "
            f"request_id={self.request_id} "
            f"user_id={self.user_id}>"
        )