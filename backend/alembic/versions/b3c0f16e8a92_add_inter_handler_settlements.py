"""Add inter-handler settlements when the table is not already present.

Revision ID: b3c0f16e8a92
Revises: 8e11a481d063
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "b3c0f16e8a92"
down_revision = "8e11a481d063"
branch_labels = None
depends_on = None

TABLE_NAME = "inter_handler_settlements"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table(TABLE_NAME):
        existing = {
            column["name"]
            for column in inspector.get_columns(TABLE_NAME)
        }
        expected = {
            "id",
            "payer_handler_id",
            "payee_handler_id",
            "amount",
            "status",
            "created_at",
            "paid_at",
            "notes",
        }
        missing = expected - existing
        if missing:
            raise RuntimeError(
                "Existing inter_handler_settlements table is missing "
                "required columns: " + ", ".join(sorted(missing))
            )
        return

    op.create_table(
        TABLE_NAME,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "payer_handler_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "payee_handler_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_inter_handler_settlements_payer_handler_id",
        TABLE_NAME,
        ["payer_handler_id"],
    )
    op.create_index(
        "ix_inter_handler_settlements_payee_handler_id",
        TABLE_NAME,
        ["payee_handler_id"],
    )
    op.create_index(
        "ix_inter_handler_settlements_status",
        TABLE_NAME,
        ["status"],
    )


def downgrade() -> None:
    # This migration may adopt a table that already contains production data.
    # It intentionally has no downgrade to avoid dropping that data.
    pass
