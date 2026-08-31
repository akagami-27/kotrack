"""add payment receipt fields

Revision ID: d3896ea15b0f
Revises: 80d8b3b3f07f
Create Date: 2026-08-31

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3896ea15b0f"
down_revision: Union[str, Sequence[str], None] = "80d8b3b3f07f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add receipt storage and metadata to payments."""

    op.add_column(
        "payments",
        sa.Column(
            "receipt_data",
            sa.LargeBinary(),
            nullable=True,
        ),
    )

    op.add_column(
        "payments",
        sa.Column(
            "receipt_filename",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        "payments",
        sa.Column(
            "receipt_content_type",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        "payments",
        sa.Column(
            "receipt_file_size",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "payments",
        sa.Column(
            "receipt_sha256",
            sa.String(length=64),
            nullable=True,
        ),
    )

    op.add_column(
        "payments",
        sa.Column(
            "receipt_uploaded_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_payments_receipt_sha256",
        "payments",
        ["receipt_sha256"],
        unique=False,
    )


def downgrade() -> None:
    """Remove receipt storage and metadata from payments."""

    op.drop_index(
        "ix_payments_receipt_sha256",
        table_name="payments",
    )

    op.drop_column(
        "payments",
        "receipt_uploaded_at",
    )

    op.drop_column(
        "payments",
        "receipt_sha256",
    )

    op.drop_column(
        "payments",
        "receipt_file_size",
    )

    op.drop_column(
        "payments",
        "receipt_content_type",
    )

    op.drop_column(
        "payments",
        "receipt_filename",
    )

    op.drop_column(
        "payments",
        "receipt_data",
    )