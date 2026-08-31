from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    avatar_data: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            native_enum=True,
        ),
        nullable=False,
        default=UserRole.USER,
        server_default=UserRole.USER.value,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    created_sessions: Mapped[list["DrinkSession"]] = relationship(
        back_populates="creator",
        foreign_keys="DrinkSession.created_by",
    )

    participations: Mapped[list["SessionParticipant"]] = relationship(
        back_populates="user",
        foreign_keys="SessionParticipant.user_id",
        cascade="all, delete-orphan",
    )

    payments: Mapped[list["Payment"]] = relationship(
        back_populates="user",
        foreign_keys="Payment.user_id",
        cascade="all, delete-orphan",
    )

    session_request_participations: Mapped[
        list["SessionRequestParticipant"]
    ] = relationship(
        back_populates="user",
        foreign_keys="SessionRequestParticipant.user_id",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<User id={self.id} "
            f"name={self.name!r} "
            f"role={self.role}>"
        )