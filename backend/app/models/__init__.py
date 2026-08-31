"""
Import every model module here so that:

1. Alembic autogenerate can discover all tables via Base.metadata.
2. SQLAlchemy relationship() string references resolve correctly.
"""

from app.db.base import Base
from app.models.enums import PaymentStatus, UserRole
from app.models.user import User
from app.models.drink_session import DrinkSession
from app.models.session_participant import SessionParticipant
from app.models.payment import Payment
from app.models.session_request import SessionRequest
from app.models.session_request_participant import SessionRequestParticipant
from app.models.password_reset import PasswordResetRequest


__all__ = [
    "Base",
    "UserRole",
    "PaymentStatus",
    "User",
    "PasswordResetRequest",
    "DrinkSession",
    "SessionParticipant",
    "Payment",
    "SessionRequest",
    "SessionRequestParticipant",
]