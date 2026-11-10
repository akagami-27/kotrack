"""add inter-handler settlement ledger when absent

Revision ID: b3c0f16e8a92
Revises: 8e11a481d063
Create Date: 2026-11-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "b3c0f16e8a92"
down_revision: Union[str, Sequence[str], None] = "8e11a481d063"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
                f"required columns: {', '.join(sorted(missing))}"
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
    # The table may predate this migration and contain committed settlements.
    # Keep it during downgrade rather than risk dropping existing accounting data.
    pass
