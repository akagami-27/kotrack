"""
Service for creating drink sessions.

This is the only place a DrinkSession + its SessionParticipant rows should
be constructed. It guarantees total_cost and amount_owed are always
computed by the backend and never taken from client input.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.models.drink_session import DEFAULT_PRICE_PER_PACKET, DrinkSession
from app.models.session_participant import SessionParticipant
from app.models.user import User
from app.services.financial import calculate_session_total, split_session_cost


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
    Create a drink session and its participant cost splits.

    All participant IDs and the creator are validated before creating
    financial records.

    `total_cost` and each participant's `amount_owed` are always computed
    server-side.
    """

    if not participant_user_ids:
        raise ValueError("A session must have at least one participant")

    if len(set(participant_user_ids)) != len(participant_user_ids):
        raise ValueError("Duplicate user_id in participant list")

    # Verify the creator exists and is active.
    creator = db.get(User, created_by)

    if creator is None:
        raise ValueError("Session creator does not exist")

    if not creator.is_active:
        raise ValueError("Session creator is inactive")

    # Load all requested participants in one query.
    stmt = select(User).where(User.id.in_(participant_user_ids))
    users = db.execute(stmt).scalars().all()

    users_by_id = {user.id: user for user in users}

    # Detect nonexistent users.
    missing_user_ids = [
        user_id
        for user_id in participant_user_ids
        if user_id not in users_by_id
    ]

    if missing_user_ids:
        raise ValueError(
            f"Participant users do not exist: {missing_user_ids}"
        )

    # Inactive users cannot participate in new sessions.
    inactive_user_ids = [
        user_id
        for user_id in participant_user_ids
        if not users_by_id[user_id].is_active
    ]

    if inactive_user_ids:
        raise ValueError(
            f"Participant users are inactive: {inactive_user_ids}"
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