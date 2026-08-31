"""
Admin API endpoints.

All endpoints in this module require an active ADMIN account.

Passwords and password hashes are never returned.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.user import User
from app.services.admin_service import get_admin_analytics


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)


@router.get("/analytics")
def get_admin_analytics_endpoint(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Return financial and usage analytics for the admin dashboard.

    Includes:

    - Overall system statistics
    - Individual user balances
    - Highest-debt users
    - Highest-spending users

    Passwords and password hashes are never returned.
    """

    return get_admin_analytics(db)