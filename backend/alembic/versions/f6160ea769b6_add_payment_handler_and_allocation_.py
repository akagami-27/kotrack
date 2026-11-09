
"""add payment handler and allocation audit fields

Revision ID: f6160ea769b6
Revises: e41b7c92a603
Create Date: 2026-11-07 00:03:01.672288
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6160ea769b6"
down_revision: Union[str, Sequence[str], None] = "e41b7c92a603"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payment_allocations",
        sa.Column(
            "allocation_type",
            sa.String(length=10),
            nullable=False,
            server_default="FIFO",
        ),
    )

    op.add_column(
        "payment_allocations",
        sa.Column("allocated_by", sa.Integer(), nullable=True),
    )

    op.create_index(
        "ix_payment_allocations_allocated_by",
        "payment_allocations",
        ["allocated_by"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_payment_allocations_allocated_by_users",
        "payment_allocations",
        "users",
        ["allocated_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "payments",
        sa.Column("handler_id", sa.Integer(), nullable=True),
    )

    op.create_index(
        "ix_payments_handler_id",
        "payments",
        ["handler_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_payments_handler_id_users",
        "payments",
        "users",
        ["handler_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_payments_handler_id_users",
        "payments",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_payments_handler_id",
        table_name="payments",
    )

    op.drop_column("payments", "handler_id")

    op.drop_constraint(
        "fk_payment_allocations_allocated_by_users",
        "payment_allocations",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_payment_allocations_allocated_by",
        table_name="payment_allocations",
    )

    op.drop_column("payment_allocations", "allocated_by")
    op.drop_column("payment_allocations", "allocation_type")
