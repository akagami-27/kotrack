"""
Business logic for drink sessions.

This module is responsible for:

- Creating sessions
- Updating sessions
- Deleting sessions
- Validating session ownership
- Enforcing the 3-day user modification rule
- Recalculating total_cost
- Recalculating participant amount_owed

Financial values are NEVER trusted from client input.
"""

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.models.drink_session import (
    DEFAULT_PRICE_PER_PACKET,
    DrinkSession,
)
from app.models.enums import UserRole
from app.models.session_participant import SessionParticipant
from app.models.user import User
from app.services.financial import (
    calculate_session_total,
    split_session_cost,
)


USER_SESSION_EDIT_DAYS = 3


# ============================================================================
# HELPERS
# ============================================================================


def _validate_participants(
    db: DbSession,
    participant_user_ids: list[int],
) -> dict[int, User]:
    """
    Validate all participant users and return them indexed by ID.
    """

    if not participant_user_ids:
        raise ValueError(
            "A session must have at least one participant"
        )

    if len(set(participant_user_ids)) != len(
        participant_user_ids
    ):
        raise ValueError(
            "Duplicate user_id in participant list"
        )

    users = db.execute(
        select(User).where(
            User.id.in_(participant_user_ids)
        )
    ).scalars().all()

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

    return users_by_id


def _can_modify_session(
    *,
    session: DrinkSession,
    current_user: User,
) -> bool:
    """
    Determine whether the current user can modify a session.

    ADMIN:
        Can modify any session at any time.

    USER:
        Can modify only sessions they created,
        and only within 3 days of the session date.
    """

    # Admins can always modify sessions.
    if current_user.role == UserRole.ADMIN:
        return True

    # Normal users can only modify sessions they created.
    if session.created_by != current_user.id:
        return False

    today = datetime.now(timezone.utc).date()

    age_in_days = (
        today - session.session_date
    ).days

    return age_in_days <= USER_SESSION_EDIT_DAYS


# ============================================================================
# CREATE
# ============================================================================


def create_drink_session(
    db: DbSession,
    *,
    session_date: date,
    packets_used: Decimal,
    participant_user_ids: list[int],
    created_by: int,
    price_per_packet: Decimal = DEFAULT_PRICE_PER_PACKET,
    commit: bool = True,
) -> DrinkSession:
    """
    Create a drink session and calculate all financial values server-side.
    """

    if not participant_user_ids:
        raise ValueError(
            "A session must have at least one participant"
        )

    if len(set(participant_user_ids)) != len(
        participant_user_ids
    ):
        raise ValueError(
            "Duplicate user_id in participant list"
        )

    if packets_used <= 0:
        raise ValueError(
            "Packets used must be greater than zero"
        )

    if price_per_packet <= 0:
        raise ValueError(
            "Price per packet must be greater than zero"
        )

    creator = db.get(User, created_by)

    if creator is None:
        raise ValueError(
            "Session creator does not exist"
        )

    if not creator.is_active:
        raise ValueError(
            "Session creator is inactive"
        )

    _validate_participants(
        db,
        participant_user_ids,
    )

    total_cost = calculate_session_total(
        packets_used,
        price_per_packet,
    )

    split = split_session_cost(
        total_cost,
        participant_user_ids,
    )

    drink_session = DrinkSession(
        session_date=session_date,
        packets_used=Decimal(packets_used),
        price_per_packet=Decimal(price_per_packet),
        total_cost=total_cost,
        created_by=created_by,
    )

    drink_session.participants = [
        SessionParticipant(
            user_id=user_id,
            amount_owed=amount,
        )
        for user_id, amount in split.items()
    ]

    db.add(drink_session)

    if commit:
        db.commit()
        db.refresh(drink_session)
    else:
        db.flush()

    return drink_session


# ============================================================================
# UPDATE
# ============================================================================


def update_drink_session(
    db: DbSession,
    *,
    drink_session: DrinkSession,
    current_user: User,
    session_date: date | None = None,
    packets_used: Decimal | None = None,
    participant_user_ids: list[int] | None = None,
    price_per_packet: Decimal | None = None,
) -> DrinkSession:
    """
    Update an existing drink session.

    ADMIN:
        Can edit any session at any time.

    USER:
        Can edit only sessions they created,
        and only within 3 days of the session date.

    total_cost and participant amounts are always recalculated.
    """

    if not _can_modify_session(
        session=drink_session,
        current_user=current_user,
    ):
        raise PermissionError(
            "You do not have permission to edit this session"
        )

    # Keep existing values when fields are omitted.
    new_session_date = (
        session_date
        if session_date is not None
        else drink_session.session_date
    )

    new_packets_used = (
        Decimal(packets_used)
        if packets_used is not None
        else drink_session.packets_used
    )

    new_price_per_packet = (
        Decimal(price_per_packet)
        if price_per_packet is not None
        else drink_session.price_per_packet
    )

    if new_packets_used <= 0:
        raise ValueError(
            "Packets used must be greater than zero"
        )

    if new_price_per_packet <= 0:
        raise ValueError(
            "Price per packet must be greater than zero"
        )

    if participant_user_ids is None:
        participant_user_ids = [
            participant.user_id
            for participant in drink_session.participants
        ]

    _validate_participants(
        db,
        participant_user_ids,
    )

    # Recalculate all financial values server-side.
    total_cost = calculate_session_total(
        new_packets_used,
        new_price_per_packet,
    )

    split = split_session_cost(
        total_cost,
        participant_user_ids,
    )

    # Update session fields.
    drink_session.session_date = new_session_date
    drink_session.packets_used = new_packets_used
    drink_session.price_per_packet = new_price_per_packet
    drink_session.total_cost = total_cost

    # IMPORTANT:
    # Do NOT replace drink_session.participants with a new list.
    #
    # The database has a unique constraint on:
    #     (session_id, user_id)
    #
    # Replacing the relationship can make SQLAlchemy INSERT the new
    # participant before deleting the old one, causing a duplicate-key
    # error when an existing participant stays in the session.
    #
    # Instead:
    #   1. Update existing participants.
    #   2. Delete participants removed from the session.
    #   3. Insert only genuinely new participants.

    existing_participants = {
        participant.user_id: participant
        for participant in drink_session.participants
    }

    selected_user_ids = set(split.keys())

    # Update existing participants or mark removed participants for deletion.
    for user_id, participant in existing_participants.items():
        if user_id not in selected_user_ids:
            db.delete(participant)
        else:
            participant.amount_owed = split[user_id]

    # Add only participants that did not already exist.
    for user_id, amount in split.items():
        if user_id not in existing_participants:
            drink_session.participants.append(
                SessionParticipant(
                    user_id=user_id,
                    amount_owed=amount,
                )
            )

    db.flush()

    return drink_session


# ============================================================================
# DELETE
# ============================================================================


def delete_drink_session(
    db: DbSession,
    *,
    drink_session: DrinkSession,
    current_user: User,
) -> None:
    """
    Delete an existing drink session.

    ADMIN:
        Can delete any session at any time.

    USER:
        Can delete only sessions they created,
        and only within 3 days of the session date.
    """

    if not _can_modify_session(
        session=drink_session,
        current_user=current_user,
    ):
        raise PermissionError(
            "You do not have permission to delete this session"
        )

    db.delete(drink_session)
    db.flush()