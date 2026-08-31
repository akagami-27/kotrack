"""
Session request API endpoints.

Normal users can submit and view their own requests.
Admins can view, approve, and reject requests.

Only approved requests become actual DrinkSession records.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.session import get_db
from app.models.session_request import SessionRequest
from app.models.user import User
from app.schemas.session_request import (
    SessionRequestCreate,
    SessionRequestRead,
)
from app.services.session_request_service import (
    approve_session_request,
    create_session_request,
    get_session_request,
    get_session_requests,
    reject_session_request,
)


router = APIRouter(
    prefix="/api/session-requests",
    tags=["Session Requests"],
)


@router.post(
    "",
    response_model=SessionRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def create_request(
    request_data: SessionRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a new drink session request.

    Any authenticated user can request a session.
    """

    try:
        request = create_session_request(
            db,
            requested_by=current_user.id,
            session_date=request_data.session_date,
            packets_used=request_data.packets_used,
            participant_user_ids=request_data.participant_user_ids,
            note=request_data.note,
        )

        # IMPORTANT:
        # Persist the request and its participant rows.
        db.commit()
        db.refresh(request)

        return request

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/my",
    response_model=list[SessionRequestRead],
)
def list_my_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return requests created by the current user.
    """

    requests = get_session_requests(db)

    return [
        request
        for request in requests
        if request.requested_by == current_user.id
    ]


@router.get(
    "",
    response_model=list[SessionRequestRead],
)
def list_all_requests(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Return all session requests.

    ADMIN only.
    """

    return get_session_requests(db)


@router.get(
    "/{request_id}",
    response_model=SessionRequestRead,
)
def get_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return a session request.

    Users can only view their own requests.
    Admins can view any request.
    """

    request = get_session_request(
        db,
        request_id=request_id,
    )

    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
        )

    if (
        current_user.role.value != "ADMIN"
        and request.requested_by != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this request",
        )

    return request


@router.post(
    "/{request_id}/approve",
    response_model=SessionRequestRead,
)
def approve_request(
    request_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Approve a pending request.

    ADMIN only.

    Approval creates the actual DrinkSession and calculates
    each participant's individual amount owed.
    """

    request = get_session_request(
        db,
        request_id=request_id,
    )

    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
        )

    try:
        approve_session_request(
            db,
            request=request,
            admin_user_id=current_user.id,
        )

        # Persist the new DrinkSession, participants,
        # updated request status, and calculated amounts.
        db.commit()
        db.refresh(request)

        return request

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/{request_id}/reject",
    response_model=SessionRequestRead,
)
def reject_request(
    request_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reject a pending request.

    ADMIN only.
    """

    request = get_session_request(
        db,
        request_id=request_id,
    )

    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
        )

    try:
        result = reject_session_request(
            db,
            request=request,
            admin_user_id=current_user.id,
        )

        # Persist the rejected status.
        db.commit()
        db.refresh(result)

        return result

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc