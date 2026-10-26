"""
Drink session API endpoints.

Session costs are always calculated server-side.

Access rules:

ADMIN:
    - View all sessions
    - Create sessions
    - Edit any session
    - Delete any session

USER:
    - View sessions they participated in
    - Cannot directly create sessions
    - Edit their own created sessions within 3 days
    - Delete their own created sessions within 3 days
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import (
    get_current_user,
    require_admin,
)
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
    DrinkSessionUpdate,
)
from app.services.session_service import (
    create_drink_session,
    delete_drink_session,
    update_drink_session,
)
from app.services.session_access import visible_sessions_for


router = APIRouter(
    prefix="/api/sessions",
    tags=["Drink Sessions"],
)


# ============================================================================
# CREATE SESSION
# ============================================================================


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
    Normal users must use /api/session-requests.
    """

    users = db.scalars(
        select(User).where(
            User.id.in_(
                session_data.participant_user_ids
            )
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
            participant_user_ids=(
                session_data.participant_user_ids
            ),
            created_by=current_user.id,
            price_per_packet=price_per_packet,
            handler_id=session_data.handler_id,
        )

        drink_session = db.scalar(
            select(DrinkSession)
            .options(
                selectinload(DrinkSession.handler),
                selectinload(
                    DrinkSession.participants
                ).selectinload(
                    SessionParticipant.user
                )
            )
            .where(
                DrinkSession.id
                == drink_session.id
            )
        )

        return drink_session

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# ============================================================================
# LIST SESSIONS
# ============================================================================


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

    SUPER_ADMIN:
        All sessions.

    ADMIN:
        Only sessions assigned to the authenticated administrator.

    USER:
        Only sessions they participated in.
    """

    stmt = (
        select(DrinkSession)
        .options(
            selectinload(DrinkSession.handler),
            selectinload(
                DrinkSession.participants
            ).selectinload(
                SessionParticipant.user
            )
        )
        .where(
            visible_sessions_for(current_user)
        )
        .order_by(
            DrinkSession.session_date.desc()
        )
    )

    return list(
        db.scalars(stmt).unique().all()
    )


# ============================================================================
# GET SINGLE SESSION
# ============================================================================


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

    SUPER_ADMIN:
        Can view any session.

    ADMIN:
        Can view only sessions assigned to the authenticated administrator.

    USER:
        Can only view sessions they participated in.
    """

    stmt = (
        select(DrinkSession)
        .options(
            selectinload(DrinkSession.handler),
            selectinload(
                DrinkSession.participants
            ).selectinload(
                SessionParticipant.user
            )
        )
        .where(
            DrinkSession.id == session_id,
            visible_sessions_for(current_user),
        )
    )

    drink_session = db.scalar(stmt)

    if drink_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drink session not found",
        )

    return drink_session


# ============================================================================
# UPDATE SESSION
# ============================================================================


@router.patch(
    "/{session_id}",
    response_model=DrinkSessionRead,
)
def update_session(
    session_id: int,
    session_data: DrinkSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update an existing drink session.

    SUPER_ADMIN:
        Can edit any session at any time.

    ADMIN:
        Can edit only sessions assigned to the authenticated administrator.

    USER:
        Can edit only sessions they created,
        and only within 3 days of the session date.

    Financial values are recalculated server-side.
    """

    stmt = (
        select(DrinkSession)
        .options(
            selectinload(DrinkSession.handler),
            selectinload(
                DrinkSession.participants
            ).selectinload(
                SessionParticipant.user
            )
        )
        .where(
            DrinkSession.id == session_id
        )
    )

    if current_user.role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        stmt = stmt.where(visible_sessions_for(current_user))
    drink_session = db.scalar(stmt)

    if drink_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drink session not found",
        )

    try:
        drink_session = update_drink_session(
            db,
            drink_session=drink_session,
            current_user=current_user,
            session_date=session_data.session_date,
            packets_used=session_data.packets_used,
            participant_user_ids=(
                session_data.participant_user_ids
            ),
            price_per_packet=(
                session_data.price_per_packet
            ),
            handler_id=session_data.handler_id,
            update_handler=(
                "handler_id" in session_data.model_fields_set
            ),
        )

        db.commit()

        # Reload relationships after commit so the response
        # contains the current participant data.
        drink_session = db.scalar(
            select(DrinkSession)
            .options(
                selectinload(DrinkSession.handler),
                selectinload(
                    DrinkSession.participants
                ).selectinload(
                    SessionParticipant.user
                )
            )
            .where(
                DrinkSession.id == session_id
            )
        )

        return drink_session

    except PermissionError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# ============================================================================
# DELETE SESSION
# ============================================================================


@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete an existing drink session.

    SUPER_ADMIN:
        Can delete any session at any time.

    ADMIN:
        Can delete only sessions assigned to the authenticated administrator.

    USER:
        Can delete only sessions they created,
        and only within 3 days of the session date.
    """

    stmt = select(DrinkSession).where(DrinkSession.id == session_id)
    if current_user.role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        stmt = stmt.where(visible_sessions_for(current_user))
    drink_session = db.scalar(stmt)

    if drink_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drink session not found",
        )

    try:
        delete_drink_session(
            db,
            drink_session=drink_session,
            current_user=current_user,
        )

        db.commit()

        return None

    except PermissionError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
