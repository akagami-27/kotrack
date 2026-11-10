
"""
Import all ORM model modules so SQLAlchemy registers their tables
on Base.metadata before Alembic runs migrations.
"""

from app.models import (
    drink_session,
    inter_handler_settlement,
    password_reset,
    payment,
    payment_allocation,
    session_participant,
    session_request,
    session_request_participant,
    user,
)

__all__ = [
    "drink_session",
    "inter_handler_settlement",
    "password_reset",
    "payment",
    "payment_allocation",
    "session_participant",
    "session_request",
    "session_request_participant",
    "user",
]
