"""
Drink session API endpoints.

Session costs are always calculated server-side.
Clients cannot supply or modify total_cost or amount_owed.

Direct session creation is ADMIN-only.
Normal users must submit a session request instead.

Access rules:
- ADMIN users can view all drink sessions.
- Normal users can only view sessions they participated in.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import get_current_user, require_admin
from app.db.session import get_db
from app.models.drink_session import (
    DEFAULT_PRICE_PER_PACKET,
    DrinkSession,
)
from app.models.enums import UserRole
from app.models.session_participant import SessionParticipant
from app.models.user import User
from app.schemas.drink_session import (
    DrinkSessionCreate,
    DrinkSessionRead,
)
from app.services.session_service import create_drink_session


router = APIRouter(
    prefix="/api/sessions",
    tags=["Drink Sessions"],
)


# ---------------------------------------------------------------------------
# CREATE SESSION
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=DrinkSessionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    session_data: DrinkSessionCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create a new drink session directly.

    Only ADMIN users can create sessions directly.
    Normal users must use /api/session-requests instead.
    """

    users = db.scalars(
        select(User).where(
            User.id.in_(session_data.participant_user_ids)
        )
    ).all()

    found_user_ids = {
        user.id
        for user in users
    }

    missing_user_ids = (
        set(session_data.participant_user_ids)
        - found_user_ids
    )

    if missing_user_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"User(s) not found: "
                f"{sorted(missing_user_ids)}"
            ),
        )

    price_per_packet = (
        session_data.price_per_packet
        if session_data.price_per_packet is not None
        else DEFAULT_PRICE_PER_PACKET
    )

    try:
        drink_session = create_drink_session(
            db,
            session_date=session_data.session_date,
            packets_used=session_data.packets_used,
            participant_user_ids=session_data.participant_user_ids,
            created_by=current_user.id,
            price_per_packet=price_per_packet,
        )

        # The service commits and refreshes the session.
        # Explicitly load participants + users before Pydantic serialization.
        drink_session = db.scalar(
            select(DrinkSession)
            .options(
                selectinload(DrinkSession.participants)
                .selectinload(SessionParticipant.user)
            )
            .where(
                DrinkSession.id == drink_session.id
            )
        )

        return drink_session

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# ---------------------------------------------------------------------------
# LIST SESSIONS
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=list[DrinkSessionRead],
)
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return drink sessions.

    ADMIN:
        Can see every session.

    USER:
        Can only see sessions where they are a participant.
    """

    # -----------------------------------------------------------------------
    # ADMIN: see everything
    # -----------------------------------------------------------------------

    if current_user.role == UserRole.ADMIN:
        stmt = (
            select(DrinkSession)
            .options(
                selectinload(DrinkSession.participants)
                .selectinload(SessionParticipant.user)
            )
            .order_by(
                DrinkSession.session_date.desc()
            )
        )

        return list(
            db.scalars(stmt).unique().all()
        )

    # -----------------------------------------------------------------------
    # USER: only sessions they participated in
    # -----------------------------------------------------------------------

    stmt = (
        select(DrinkSession)
        .options(
            selectinload(DrinkSession.participants)
            .selectinload(SessionParticipant.user)
        )
        .join(
            SessionParticipant,
            SessionParticipant.session_id
            == DrinkSession.id,
        )
        .where(
            SessionParticipant.user_id
            == current_user.id
        )
        .order_by(
            DrinkSession.session_date.desc()
        )
    )

    return list(
        db.scalars(stmt).unique().all()
    )


# ---------------------------------------------------------------------------
# GET SINGLE SESSION
# ---------------------------------------------------------------------------

@router.get(
    "/{session_id}",
    response_model=DrinkSessionRead,
)
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return a single drink session.

    ADMIN:
        Can view any session.

    USER:
        Can only view a session if they participated in it.
    """

    stmt = (
        select(DrinkSession)
        .options(
            selectinload(DrinkSession.participants)
            .selectinload(SessionParticipant.user)
        )
        .where(
            DrinkSession.id == session_id
        )
    )

    drink_session = db.scalar(stmt)

    if drink_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drink session not found",
        )

    # ADMIN can view any session.
    if current_user.role == UserRole.ADMIN:
        return drink_session

    # USER must be a participant.
    participant = db.scalar(
        select(SessionParticipant).where(
            SessionParticipant.session_id == session_id,
            SessionParticipant.user_id == current_user.id,
        )
    )

    if participant is None:
        # Deliberately return 404 instead of 403.
        # This prevents users from discovering sessions
        # that they are not allowed to access.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drink session not found",
        )

    return drink_session