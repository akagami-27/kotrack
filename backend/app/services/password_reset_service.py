"""Code-free, request-bound password recovery operations."""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.password_reset import PasswordResetRequest
from app.models.user import User

SESSION_TTL = timedelta(hours=2)
PENDING_SESSION_TTL = timedelta(hours=24)
REQUEST_COOLDOWN = timedelta(minutes=5)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def request_password_reset(db: Session, *, name: str, existing_session: str | None = None) -> tuple[PasswordResetRequest | None, str]:
    """Start a request while returning a random browser cookie value.

    Unknown names and throttled requests intentionally have the same public
    response. A cookie is only persisted for a real new request.
    """
    raw_session = secrets.token_urlsafe(32)
    user = db.execute(select(User).where(User.name == name.strip(), User.is_active.is_(True))).scalar_one_or_none()
    if user is None:
        return None, raw_session
    now = datetime.now(timezone.utc)
    digest = hashlib.sha256(existing_session.encode()).hexdigest() if existing_session else None
    open_request = db.execute(select(PasswordResetRequest).where(
        PasswordResetRequest.user_id == user.id,
        PasswordResetRequest.status.in_(("PENDING", "APPROVED")),
    ).with_for_update()).scalar_one_or_none()
    if open_request is not None and (
        open_request.session_expires_at is None
        or _utc(open_request.session_expires_at) <= now
    ):
        open_request.status = "CLOSED_LEGACY"
        open_request.used = True
        open_request.reset_session_hash = None
        db.flush()
        open_request = None
    if open_request is not None and open_request.reset_session_hash == digest and digest is not None:
        return open_request, existing_session
    recent = db.execute(select(PasswordResetRequest.id).where(
        PasswordResetRequest.user_id == user.id,
        PasswordResetRequest.created_at >= now - REQUEST_COOLDOWN,
    ).limit(1)).scalar_one_or_none()
    if recent is not None or open_request is not None:
        return None, raw_session
    request = PasswordResetRequest(
        user_id=user.id,
        status="PENDING",
        reset_session_hash=hashlib.sha256(raw_session.encode()).hexdigest(),
        session_expires_at=now + PENDING_SESSION_TTL,
    )
    db.add(request)
    db.flush()
    return request, raw_session


def decide_password_reset(db: Session, *, request_id: int, admin: User, approve: bool) -> PasswordResetRequest:
    """Atomically make one Super Admin decision for a pending request."""
    now = datetime.now(timezone.utc)
    values: dict[str, object] = {
        "status": "APPROVED" if approve else "REJECTED",
        "approved_at": now if approve else None,
        "approved_by": admin.id if approve else None,
        "rejected_at": None if approve else now,
        "rejected_by": None if approve else admin.id,
        "used": not approve,
        "session_expires_at": now + SESSION_TTL if approve else now + PENDING_SESSION_TTL,
    }
    result = db.execute(update(PasswordResetRequest).where(
        PasswordResetRequest.id == request_id,
        PasswordResetRequest.status == "PENDING",
        PasswordResetRequest.user_id != admin.id,
    ).values(**values))
    if result.rowcount != 1:
        raise ValueError("Request is no longer pending or cannot be decided by this administrator")
    db.flush()
    return db.get(PasswordResetRequest, request_id)


def complete_password_reset(db: Session, *, raw_session: str, new_password: str) -> PasswordResetRequest:
    """Consume the browser session and approval in the same transaction."""
    if len(new_password) < 8:
        raise ValueError("New password must be at least 8 characters")
    digest = hashlib.sha256(raw_session.encode()).hexdigest()
    request = db.execute(select(PasswordResetRequest).where(
        PasswordResetRequest.reset_session_hash == digest,
    ).with_for_update()).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if (request is None or request.status != "APPROVED" or request.session_expires_at is None
            or _utc(request.session_expires_at) <= now):
        raise ValueError("No approved, valid password-reset request was found")
    user = db.execute(select(User).where(User.id == request.user_id, User.is_active.is_(True)).with_for_update()).scalar_one_or_none()
    if user is None:
        raise ValueError("Account is unavailable")
    result = db.execute(update(PasswordResetRequest).where(
        PasswordResetRequest.id == request.id,
        PasswordResetRequest.status == "APPROVED",
        PasswordResetRequest.reset_session_hash == digest,
    ).values(status="COMPLETED", completed_at=now, used=True, reset_session_hash=None))
    if result.rowcount != 1:
        raise ValueError("Password-reset approval has already been consumed")
    user.password_hash = hash_password(new_password)
    db.flush()
    return request
