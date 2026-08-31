"""improve password reset workflow

Revision ID: 80d8b3b3f07f
Revises: f457caf69440
Create Date: 2026-08-31 18:16:29.329301

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "80d8b3b3f07f"
down_revision: Union[str, Sequence[str], None] = "f457caf69440"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "password_reset_requests",
        sa.Column(
            "approved_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "password_reset_requests",
        sa.Column(
            "approved_by",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.alter_column(
        "password_reset_requests",
        "code_hash",
        existing_type=sa.VARCHAR(length=255),
        nullable=True,
    )

    op.alter_column(
        "password_reset_requests",
        "expires_at",
        existing_type=postgresql.TIMESTAMP(timezone=True),
        nullable=True,
    )

    op.create_foreign_key(
        None,
        "password_reset_requests",
        "users",
        ["approved_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_constraint(
        None,
        "password_reset_requests",
        type_="foreignkey",
    )

    op.alter_column(
        "password_reset_requests",
        "expires_at",
        existing_type=postgresql.TIMESTAMP(timezone=True),
        nullable=False,
    )

    op.alter_column(
        "password_reset_requests",
        "code_hash",
        existing_type=sa.VARCHAR(length=255),
        nullable=False,
    )

    op.drop_column(
        "password_reset_requests",
        "approved_by",
    )

    op.drop_column(
        "password_reset_requests",
        "approved_at",
    )