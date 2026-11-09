
"""add payment_reconciliations and update payment_allocations

Revision ID: 8e11a481d063
Revises: f6160ea769b6
Create Date: 2026-11-07 00:40:00.000000

Changes:
1. Create payment_reconciliations table (append-only audit log).
2. Add reconciliation_id FK column to payment_allocations.
3. Drop the unique constraint uq_payment_allocation_payment_participant
   from payment_allocations so that multiple partial reconciliations can
   target the same session_participant over time.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8e11a481d063"
down_revision: Union[str, Sequence[str], None] = "f6160ea769b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create payment_reconciliations table.
    op.create_table(
        "payment_reconciliations",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "payment_id",
            sa.Integer(),
            sa.ForeignKey("payments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "handler_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "reconciled_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_payment_reconciliations_payment_id",
        "payment_reconciliations",
        ["payment_id"],
        unique=False,
    )

    op.create_index(
        "ix_payment_reconciliations_handler_id",
        "payment_reconciliations",
        ["handler_id"],
        unique=False,
    )

    op.create_index(
        "ix_payment_reconciliations_reconciled_by",
        "payment_reconciliations",
        ["reconciled_by"],
        unique=False,
    )

    # 2. Add reconciliation_id FK to payment_allocations.
    op.add_column(
        "payment_allocations",
        sa.Column("reconciliation_id", sa.Integer(), nullable=True),
    )

    op.create_index(
        "ix_payment_allocations_reconciliation_id",
        "payment_allocations",
        ["reconciliation_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_payment_allocations_reconciliation_id",
        "payment_allocations",
        "payment_reconciliations",
        ["reconciliation_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 3. Drop the unique constraint that prevented multiple allocations
    #    to the same session_participant from the same payment.
    op.drop_constraint(
        "uq_payment_allocation_payment_participant",
        "payment_allocations",
        type_="unique",
    )

    # 4. Create explicit index on payment_id since the unique constraint was dropped.
    op.create_index(
        "ix_payment_allocations_payment_id",
        "payment_allocations",
        ["payment_id"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_payment_allocations_payment_id")

    # Restore the unique constraint.
    # WARNING: This will fail if data exists that violates the constraint.
    op.create_unique_constraint(
        "uq_payment_allocation_payment_participant",
        "payment_allocations",
        ["payment_id", "session_participant_id"],
    )

    # Remove reconciliation_id FK and column.
    op.drop_constraint(
        "fk_payment_allocations_reconciliation_id",
        "payment_allocations",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_payment_allocations_reconciliation_id",
        table_name="payment_allocations",
    )

    op.drop_column("payment_allocations", "reconciliation_id")

    # Drop payment_reconciliations table.
    op.drop_index(
        "ix_payment_reconciliations_reconciled_by",
        table_name="payment_reconciliations",
    )

    op.drop_index(
        "ix_payment_reconciliations_handler_id",
        table_name="payment_reconciliations",
    )

    op.drop_index(
        "ix_payment_reconciliations_payment_id",
        table_name="payment_reconciliations",
    )

    op.drop_table("payment_reconciliations")
