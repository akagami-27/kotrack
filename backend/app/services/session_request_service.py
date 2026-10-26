"""
Business logic for drink session requests.

Normal users can submit and view their own requests.
Admins can review only requests assigned to them; super admins can review all.

Actual drink-session costs are calculated by
create_drink_session() when an admin approves a request.
"""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from app.models.session_request import SessionRequest
from app.models.session_request_participant import (
    SessionRequestParticipant,
)
from app.models.user import User
from app.services.session_service import create_drink_session
from app.services.session_handler_service import validate_session_handler


def create_session_request(
    db: Session,
    *,
    requested_by: int,
    session_date,
    packets_used: Decimal,
    participant_user_ids: list[int],
    handler_id: int | None = None,
    note: str | None = None,
) -> SessionRequest:
    """
    Create a new pending session request.

    The transaction is committed here because this operation is a
    complete standalone user request.
    """

    if not participant_user_ids:
        raise ValueError(
            "A session request must have at least one participant"
        )

    if len(set(participant_user_ids)) != len(participant_user_ids):
        raise ValueError(
            "Duplicate user_id in participant list"
        )

    if packets_used <= 0:
        raise ValueError(
            "Packets used must be greater than zero"
        )

    requester = db.get(User, requested_by)

    if requester is None:
        raise ValueError(
            "Requesting user does not exist"
        )

    if not requester.is_active:
        raise ValueError(
            "Requesting user is inactive"
        )

    validate_session_handler(db, handler_id)

    stmt = select(User).where(
        User.id.in_(participant_user_ids)
    )

    users = db.execute(stmt).scalars().all()

    users_by_id = {
        user.id: user
        for user in users
    }

    missing_user_ids = [
        user_id
        for user_id in participant_user_ids
        if user_id not in users_by_id
    ]

    if missing_user_ids:
        raise ValueError(
            f"Participant users do not exist: {missing_user_ids}"
        )

    inactive_user_ids = [
        user_id
        for user_id in participant_user_ids
        if not users_by_id[user_id].is_active
    ]

    if inactive_user_ids:
        raise ValueError(
            f"Participant users are inactive: {inactive_user_ids}"
        )

    session_request = SessionRequest(
        requested_by=requested_by,
        session_date=session_date,
        packets_used=packets_used,
        note=note,
        status="PENDING",
        handler_id=handler_id,
    )

    session_request.participants = [
        SessionRequestParticipant(
            user_id=user_id,
        )
        for user_id in participant_user_ids
    ]

    db.add(session_request)
    db.commit()
    db.refresh(session_request)

    return session_request


def get_session_requests(
    db: Session,
    *,
    status_filter: str | None = None,
    handler_id: int | None = None,
) -> list[SessionRequest]:
    """Return session requests, optionally filtered by status."""

    stmt = select(SessionRequest).order_by(
        SessionRequest.created_at.desc()
    )

    if status_filter is not None:
        stmt = stmt.where(
            SessionRequest.status == status_filter
        )

    if handler_id is not None:
        stmt = stmt.where(SessionRequest.handler_id == handler_id)

    return list(
        db.execute(stmt).scalars().all()
    )


def get_session_request(
    db: Session,
    *,
    request_id: int,
) -> SessionRequest | None:
    """Return a single session request."""

    return db.get(
        SessionRequest,
        request_id,
    )


def approve_session_request(
    db: Session,
    *,
    request: SessionRequest,
    admin_user_id: int,
):
    """
    Approve a pending request and create the actual DrinkSession.

    Everything happens inside one database transaction.

    If session creation fails, neither the DrinkSession nor the
    APPROVED request is committed.
    """

    if request.status != "PENDING":
        raise ValueError(
            "Only pending requests can be approved"
        )

    admin = db.get(User, admin_user_id)

    if admin is None:
        raise ValueError(
            "Administrator does not exist"
        )

    if not admin.is_active:
        raise ValueError(
            "Administrator is inactive"
        )

    if admin.role == UserRole.ADMIN and request.handler_id != admin.id:
        raise PermissionError(
            "You can approve only requests assigned to you"
        )
    if admin.role not in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        raise ValueError("Only administrators can approve session requests")

    participant_user_ids = [
        participant.user_id
        for participant in request.participants
    ]

    if not participant_user_ids:
        raise ValueError(
            "Session request has no participants"
        )

    try:
        handler_id = request.handler_id
        try:
            validate_session_handler(db, handler_id)
        except ValueError:
            # Requests may outlive an administrator's eligibility. Keep
            # approval usable and clear the stale assignment safely.
            handler_id = None
            request.handler_id = None

        drink_session = create_drink_session(
            db,
            session_date=request.session_date,
            packets_used=request.packets_used,
            participant_user_ids=participant_user_ids,
            created_by=admin_user_id,
            handler_id=handler_id,
            commit=False,
        )

        request.status = "APPROVED"
        request.reviewed_by = admin_user_id
        request.reviewed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(request)
        db.refresh(drink_session)

        return request

    except Exception:
        db.rollback()
        raise


def reject_session_request(
    db: Session,
    *,
    request: SessionRequest,
    admin_user_id: int,
) -> SessionRequest:
    """Reject a pending session request."""

    if request.status != "PENDING":
        raise ValueError(
            "Only pending requests can be rejected"
        )

    admin = db.get(User, admin_user_id)

    if admin is None:
        raise ValueError(
            "Administrator does not exist"
        )

    if not admin.is_active:
        raise ValueError(
            "Administrator is inactive"
        )

    if admin.role == UserRole.ADMIN and request.handler_id != admin.id:
        raise PermissionError(
            "You can reject only requests assigned to you"
        )
    if admin.role not in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        raise ValueError("Only administrators can reject session requests")

    request.status = "REJECTED"
    request.reviewed_by = admin_user_id
    request.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(request)

    return request
