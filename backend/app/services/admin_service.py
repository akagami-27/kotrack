"""
Admin dashboard business logic.

Provides aggregated statistics for the administrator dashboard.

All financial values are calculated from the source records:
    SessionParticipant.amount_owed
    Payment.amount where status == CONFIRMED

No balance is stored directly on the User model.

Payment records are not allocated to individual sessions or handlers.
Consequently, handler-specific collected payments and outstanding balances
cannot be calculated reliably from the current schema.
"""

from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.drink_session import DrinkSession
from app.models.enums import PaymentStatus, UserRole
from app.models.payment import Payment
from app.models.session_participant import SessionParticipant
from app.models.session_request import SessionRequest
from app.models.user import User
from app.services.payment_access import handled_payment_user_ids


ZERO = Decimal("0.00")


def _handled_participant_ids(handler_id: int):
    return (
        select(SessionParticipant.user_id)
        .join(
            DrinkSession,
            DrinkSession.id == SessionParticipant.session_id,
        )
        .where(DrinkSession.handler_id == handler_id)
    )


def get_admin_summary(
    db: Session,
    handler_id: int | None = None,
) -> dict:
    """
    Return high-level statistics for the admin dashboard.

    Regular admins receive the existing scoped summary.
    Super Admin analytics use handler_id=None for system-wide statistics.
    """

    session_scope = (
        []
        if handler_id is None
        else [
            or_(
                DrinkSession.handler_id.is_(None),
                DrinkSession.handler_id == handler_id,
            )
        ]
    )

    user_scope = (
        []
        if handler_id is None
        else [
            User.id.in_(
                select(SessionParticipant.user_id)
                .join(
                    DrinkSession,
                    DrinkSession.id == SessionParticipant.session_id,
                )
                .where(
                    or_(
                        DrinkSession.handler_id.is_(None),
                        DrinkSession.handler_id == handler_id,
                    )
                )
                .distinct()
            )
        ]
    )

    payment_scope = (
        []
        if handler_id is None
        else [
            Payment.user_id.in_(
                handled_payment_user_ids(handler_id)
            )
        ]
    )

    total_users = db.scalar(
        select(func.count(User.id)).where(
            User.is_active.is_(True),
            *user_scope,
        )
    ) or 0

    total_sessions = db.scalar(
        select(func.count(DrinkSession.id)).where(
            *session_scope,
        )
    ) or 0

    total_packets = db.scalar(
        select(
            func.coalesce(
                func.sum(DrinkSession.packets_used),
                ZERO,
            )
        ).where(*session_scope)
    ) or ZERO

    if handler_id is None:
        total_session_value_query = select(
            func.coalesce(
                func.sum(DrinkSession.total_cost),
                ZERO,
            )
        )
    else:
        total_session_value_query = (
            select(
                func.coalesce(
                    func.sum(SessionParticipant.amount_owed),
                    ZERO,
                )
            )
            .join(
                DrinkSession,
                DrinkSession.id == SessionParticipant.session_id,
            )
            .where(
                DrinkSession.handler_id == handler_id,
                SessionParticipant.user_id.in_(
                    handled_payment_user_ids(handler_id)
                ),
            )
        )

    total_session_value = (
        db.scalar(total_session_value_query) or ZERO
    )

    total_confirmed_payments = db.scalar(
        select(
            func.coalesce(
                func.sum(Payment.amount),
                ZERO,
            )
        ).where(
            Payment.status == PaymentStatus.CONFIRMED,
            *payment_scope,
        )
    ) or ZERO

    total_outstanding = (
        Decimal(total_session_value)
        - Decimal(total_confirmed_payments)
    )

    pending_payments = db.scalar(
        select(func.count(Payment.id)).where(
            Payment.status == PaymentStatus.PENDING,
            *payment_scope,
        )
    ) or 0

    pending_request_scope = (
        []
        if handler_id is None
        else [
            or_(
                SessionRequest.handler_id.is_(None),
                SessionRequest.handler_id == handler_id,
            )
        ]
    )

    pending_session_requests = db.scalar(
        select(func.count(SessionRequest.id)).where(
            SessionRequest.status == "PENDING",
            *pending_request_scope,
        )
    ) or 0

    return {
        "total_users": int(total_users),
        "total_sessions": int(total_sessions),
        "total_packets": Decimal(total_packets),
        "total_session_value": Decimal(total_session_value),
        "total_confirmed_payments": Decimal(
            total_confirmed_payments
        ),
        "total_outstanding": total_outstanding,
        "pending_payments": int(pending_payments),
        "pending_session_requests": int(
            pending_session_requests
        ),
    }


def get_session_financial_breakdown(
    db: Session,
    super_admin_id: int,
) -> dict:
    """
    Return non-overlapping session statistics for the Super Admin dashboard.

    Categories:
        - Sessions assigned to the current Super Admin.
        - Sessions assigned to regular admins.
        - Unassigned sessions.
        - All sessions system-wide.

    Financial figures represent session values, not reconciled outstanding
    balances. Payments cannot be attributed to individual sessions or
    handlers because the current Payment model has no such allocation.
    """

    def aggregate_sessions(*conditions) -> dict:
        row = db.execute(
            select(
                func.count(
                    DrinkSession.id
                ).label("total_sessions"),
                func.coalesce(
                    func.sum(DrinkSession.packets_used),
                    ZERO,
                ).label("total_packets"),
                func.coalesce(
                    func.sum(DrinkSession.total_cost),
                    ZERO,
                ).label("total_session_value"),
            ).where(*conditions)
        ).one()

        return {
            "total_sessions": int(row.total_sessions),
            "total_packets": Decimal(row.total_packets),
            "total_session_value": Decimal(
                row.total_session_value
            ),
        }

    # Sessions assigned directly to the authenticated Super Admin.
    my_sessions = aggregate_sessions(
        DrinkSession.handler_id == super_admin_id,
    )

    # Sessions assigned to regular admins only.
    # Super Admin-assigned and unassigned sessions are excluded.
    regular_admin_ids = select(User.id).where(
        User.role == UserRole.ADMIN,
    )

    other_admin_sessions = aggregate_sessions(
        DrinkSession.handler_id.in_(regular_admin_ids),
    )

    # Sessions that do not currently have a handler.
    unassigned_sessions = aggregate_sessions(
        DrinkSession.handler_id.is_(None),
    )

    # All sessions, including assigned and unassigned sessions.
    system_wide = aggregate_sessions()

    return {
        "my_assigned_sessions": my_sessions,
        "other_admins_sessions": other_admin_sessions,
        "unassigned_sessions": unassigned_sessions,
        "system_wide": system_wide,
    }


def get_admin_user_balances(
    db: Session,
    handler_id: int | None = None,
) -> list[dict]:
    """
    Return every active user's financial position.

    Results include:
        - total owed
        - confirmed payments
        - outstanding balance

    Users with zero balance are included because the admin should
    be able to see the financial status of every active user.
    """

    owed_query = (
        select(
            SessionParticipant.user_id.label("user_id"),
            func.coalesce(
                func.sum(SessionParticipant.amount_owed),
                ZERO,
            ).label("total_owed"),
        )
        .group_by(SessionParticipant.user_id)
    )

    if handler_id is not None:
        owed_query = owed_query.join(
            DrinkSession,
            DrinkSession.id == SessionParticipant.session_id,
        ).where(
            DrinkSession.handler_id == handler_id
        )

    owed_subquery = owed_query.subquery()

    paid_subquery = (
        select(
            Payment.user_id.label("user_id"),
            func.coalesce(
                func.sum(Payment.amount),
                ZERO,
            ).label("total_paid"),
        )
        .where(
            Payment.status == PaymentStatus.CONFIRMED,
            *(
                []
                if handler_id is None
                else [
                    Payment.user_id.in_(
                        handled_payment_user_ids(handler_id)
                    )
                ]
            ),
        )
        .group_by(Payment.user_id)
        .subquery()
    )

    stmt = (
        select(
            User.id.label("user_id"),
            User.name.label("name"),
            func.coalesce(
                owed_subquery.c.total_owed,
                ZERO,
            ).label("total_owed"),
            func.coalesce(
                paid_subquery.c.total_paid,
                ZERO,
            ).label("total_paid"),
        )
        .outerjoin(
            owed_subquery,
            owed_subquery.c.user_id == User.id,
        )
        .outerjoin(
            paid_subquery,
            paid_subquery.c.user_id == User.id,
        )
        .where(User.is_active.is_(True))
        .order_by(User.name.asc())
    )

    if handler_id is not None:
        stmt = stmt.where(
            User.id.in_(
                handled_payment_user_ids(handler_id)
            )
        )

    rows = db.execute(stmt).all()

    return [
        {
            "user_id": row.user_id,
            "name": row.name,
            "total_owed": Decimal(row.total_owed),
            "total_paid": Decimal(row.total_paid),
            "balance": (
                Decimal(row.total_owed)
                - Decimal(row.total_paid)
            ),
        }
        for row in rows
    ]


def get_highest_debt_users(
    db: Session,
    limit: int = 5,
) -> list[dict]:
    """
    Return active users with the highest outstanding balances.
    """

    users = get_admin_user_balances(db)

    users.sort(
        key=lambda user: user["balance"],
        reverse=True,
    )

    return users[:limit]


def get_highest_spenders(
    db: Session,
    limit: int = 5,
    handler_id: int | None = None,
) -> list[dict]:
    """
    Return users ordered by their total amount owed across sessions.
    """

    stmt = (
        select(
            User.id.label("user_id"),
            User.name.label("name"),
            func.coalesce(
                func.sum(SessionParticipant.amount_owed),
                ZERO,
            ).label("total_spent"),
        )
        .join(
            SessionParticipant,
            SessionParticipant.user_id == User.id,
        )
        .join(
            DrinkSession,
            DrinkSession.id == SessionParticipant.session_id,
        )
        .where(User.is_active.is_(True))
        .group_by(
            User.id,
            User.name,
        )
        .order_by(
            func.sum(
                SessionParticipant.amount_owed
            ).desc()
        )
        .limit(limit)
    )

    if handler_id is not None:
        stmt = stmt.where(
            DrinkSession.handler_id == handler_id
        )

    rows = db.execute(stmt).all()

    return [
        {
            "user_id": row.user_id,
            "name": row.name,
            "total_spent": Decimal(row.total_spent),
        }
        for row in rows
    ]


def get_admin_analytics(
    db: Session,
    current_user: User | None = None,
) -> dict:
    """
    Return the complete dataset required by the admin dashboard.

    Regular admins retain the existing handler-scoped analytics.
    Super Admins receive additional financial breakdown data.
    """

    handler_id = (
        current_user.id
        if (
            current_user is not None
            and current_user.role == UserRole.ADMIN
        )
        else None
    )

    users = get_admin_user_balances(
        db,
        handler_id=handler_id,
    )

    response = {
        "summary": get_admin_summary(
            db,
            handler_id=handler_id,
        ),
        "users": users,
        "highest_debt_users": sorted(
            users,
            key=lambda user: user["balance"],
            reverse=True,
        )[:5],
        "highest_spenders": get_highest_spenders(
            db,
            limit=5,
            handler_id=handler_id,
        ),
    }

    if (
        current_user is not None
        and current_user.role == UserRole.SUPER_ADMIN
    ):
        response["financial_breakdown"] = (
            get_session_financial_breakdown(
                db,
                super_admin_id=current_user.id,
            )
        )

    return response