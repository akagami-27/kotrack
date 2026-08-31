from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.payment import UserBalanceRead
from app.services.balance import (
    calculate_user_balance,
    total_amount_owed,
    total_confirmed_payments,
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
    balance = calculate_user_balance(db, current_user.id)

    return UserBalanceRead(
        user_id=current_user.id,
        total_owed=owed,
        total_confirmed_payments=confirmed_payments,
        balance=balance,
    )