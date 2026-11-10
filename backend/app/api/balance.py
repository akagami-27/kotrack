from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.payment import UserBalanceRead, UserOutstandingBreakdownRead
from app.services.balance import (
    total_amount_owed,
    total_confirmed_payments,
    user_outstanding_by_handler,
)

router = APIRouter(
    prefix="/api/balance",
    tags=["Balance"],
)


@router.get("/me", response_model=UserBalanceRead)
def get_my_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated user's current balance."""

    owed = total_amount_owed(db, current_user.id)
    confirmed_payments = total_confirmed_payments(db, current_user.id)
    outstanding = user_outstanding_by_handler(db, current_user.id)
    balance = outstanding["total_outstanding"]

    return UserBalanceRead(
        user_id=current_user.id,
        total_owed=owed,
        total_confirmed_payments=confirmed_payments,
        balance=balance,
        outstanding_by_admin=outstanding["admins"],
    )


@router.get("/me/outstanding-by-admin", response_model=UserOutstandingBreakdownRead)
def get_my_outstanding_by_admin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated user's session debt grouped by handler."""
    return user_outstanding_by_handler(db, current_user.id)
