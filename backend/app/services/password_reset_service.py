from datetime import datetime, timedelta, timezone
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.password_reset import PasswordResetRequest
from app.models.user import User


RESET_CODE_LENGTH = 6
RESET_CODE_EXPIRE_MINUTES = 15
MAX_RESET_ATTEMPTS = 5


def request_password_reset(
    db: Session,
    *,
    name: str,
) -> PasswordResetRequest:
    """Create a pending password-reset request."""

    name = name.strip()

    user = db.execute(
        select(User).where(
            User.name == name,
            User.is_active.is_(True),
        )
    ).scalar_one_or_none()

    if user is None:
        raise ValueError("User not found")

    existing = db.execute(
        select(PasswordResetRequest).where(
            PasswordResetRequest.user_id == user.id,
            PasswordResetRequest.used.is_(False),
        )
    ).scalars().all()

    for request in existing:
        request.used = True

    reset_request = PasswordResetRequest(
        user_id=user.id,
    )

    db.add(reset_request)
    db.flush()

    return reset_request


def approve_password_reset(
    db: Session,
    *,
    reset_request: PasswordResetRequest,
    admin: User,
) -> str:
    """Approve a reset request and generate a one-time code."""

    if reset_request.used:
        raise ValueError("Reset request has already been used")

    code = "".join(
        str(secrets.randbelow(10))
        for _ in range(RESET_CODE_LENGTH)
    )

    reset_request.code_hash = hash_password(code)

    reset_request.expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=RESET_CODE_EXPIRE_MINUTES)
    )

    reset_request.approved_at = datetime.now(timezone.utc)
    reset_request.approved_by = admin.id
    reset_request.attempts = 0

    db.flush()

    return code


def reset_password(
    db: Session,
    *,
    reset_request: PasswordResetRequest,
    code: str,
    new_password: str,
) -> User:
    """Validate a reset code and set a new password."""

    if reset_request.used:
        raise ValueError("Reset request has already been used")

    if reset_request.code_hash is None:
        raise ValueError("Reset request has not been approved")

    if reset_request.expires_at is None:
        raise ValueError("Reset code has expired")

    now = datetime.now(timezone.utc)

    if reset_request.expires_at <= now:
        raise ValueError("Reset code has expired")

    if reset_request.attempts >= MAX_RESET_ATTEMPTS:
        raise ValueError("Too many invalid attempts")

    from app.core.security import verify_password

    if not verify_password(
        code,
        reset_request.code_hash,
    ):
        reset_request.attempts += 1
        db.flush()

        raise ValueError("Invalid reset code")

    if len(new_password) < 8:
        raise ValueError(
            "New password must be at least 8 characters"
        )

    user = reset_request.user

    user.password_hash = hash_password(new_password)

    reset_request.used = True

    db.flush()

    return user