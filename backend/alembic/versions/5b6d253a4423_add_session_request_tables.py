"""add session request tables

Revision ID: 5b6d253a4423
Revises: 2055d32bc609
Create Date: 2026-08-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5b6d253a4423"
down_revision: Union[str, Sequence[str], None] = "2055d32bc609"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create session request tables."""

    op.create_table(
        "session_requests",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "requested_by",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "session_date",
            sa.Date(),
            nullable=False,
        ),
        sa.Column(
            "packets_used",
            sa.Numeric(
                precision=10,
                scale=3,
            ),
            nullable=False,
        ),
        sa.Column(
            "note",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "reviewed_by",
            sa.Integer(),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_session_requests_requested_by",
        "session_requests",
        ["requested_by"],
        unique=False,
    )

    op.create_index(
        "ix_session_requests_status",
        "session_requests",
        ["status"],
        unique=False,
    )

    op.create_table(
        "session_request_participants",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "request_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["request_id"],
            ["session_requests.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "request_id",
            "user_id",
            name="uq_session_request_participant",
        ),
    )

    op.create_index(
        "ix_session_request_participants_request_id",
        "session_request_participants",
        ["request_id"],
        unique=False,
    )

    op.create_index(
        "ix_session_request_participants_user_id",
        "session_request_participants",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove session request tables."""

    op.drop_index(
        "ix_session_request_participants_user_id",
        table_name="session_request_participants",
    )

    op.drop_index(
        "ix_session_request_participants_request_id",
        table_name="session_request_participants",
    )

    op.drop_table("session_request_participants")

    op.drop_index(
        "ix_session_requests_status",
        table_name="session_requests",
    )

    op.drop_index(
        "ix_session_requests_requested_by",
        table_name="session_requests",
    )

    op.drop_table("session_requests")