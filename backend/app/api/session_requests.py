"""
Session request API endpoints.

Normal users can submit and view their own requests.
Regular admins can view and review unassigned requests or requests
assigned to themselves. Super admins can review all requests.

Only approved requests become actual DrinkSession records.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.session import get_db
from app.models.enums import UserRole
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
        session_request = create_session_request(
            db,
            requested_by=current_user.id,
            session_date=request_data.session_date,
            packets_used=request_data.packets_used,
            participant_user_ids=request_data.participant_user_ids,
            note=request_data.note,
            handler_id=request_data.handler_id,
        )

        # Persist the request and its participant rows.
        db.commit()
        db.refresh(session_request)

        return session_request

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
        session_request
        for session_request in requests
        if session_request.requested_by == current_user.id
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
    Return session requests visible to the current administrator.

    Super admins can view all requests.
    Regular admins can view unassigned requests and requests
    assigned to themselves.
    """

    if current_user.role == UserRole.SUPER_ADMIN:
        return get_session_requests(db)

    return get_session_requests(
        db,
        handler_id=current_user.id,
        include_unassigned=True,
    )


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

    Users can view their own requests.
    Regular admins can view unassigned requests or requests assigned
    to themselves.
    Super admins can view all requests.
    """

    session_request = get_session_request(
        db,
        request_id=request_id,
    )

    if session_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
        )

    is_super_admin = current_user.role == UserRole.SUPER_ADMIN
    is_admin = current_user.role == UserRole.ADMIN

    is_admin_allowed = (
        is_admin
        and (
            session_request.handler_id is None
            or session_request.handler_id == current_user.id
        )
    )

    is_requester = (
        session_request.requested_by == current_user.id
    )

    # Requesters retain access to their own requests, except that a
    # regular admin cannot bypass another administrator's assignment.
    is_requester_allowed = (
        is_requester
        and (
            not is_admin
            or session_request.handler_id is None
            or session_request.handler_id == current_user.id
        )
    )

    if not (is_super_admin or is_admin_allowed or is_requester_allowed):
        # Avoid revealing requests assigned to another administrator.
        if current_user.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session request not found",
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this request",
        )

    return session_request


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

    Super admins can approve any request.
    Regular admins can approve unassigned requests or requests
    assigned to themselves.

    Approval creates the actual DrinkSession and calculates
    each participant's individual amount owed.
    """

    session_request = get_session_request(
        db,
        request_id=request_id,
    )

    if session_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
        )

    if (
        current_user.role == UserRole.ADMIN
        and session_request.handler_id is not None
        and session_request.handler_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
        )

    try:
        approve_session_request(
            db,
            request=session_request,
            admin_user_id=current_user.id,
        )

        # Persist the new DrinkSession, participants, updated request
        # status, and calculated amounts.
        db.commit()
        db.refresh(session_request)

        return session_request

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except PermissionError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
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

    Super admins can reject any request.
    Regular admins can reject unassigned requests or requests
    assigned to themselves.
    """

    session_request = get_session_request(
        db,
        request_id=request_id,
    )

    if session_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
        )

    if (
        current_user.role == UserRole.ADMIN
        and session_request.handler_id is not None
        and session_request.handler_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
        )

    try:
        result = reject_session_request(
            db,
            request=session_request,
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

    except PermissionError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session request not found",
        ) from exc
