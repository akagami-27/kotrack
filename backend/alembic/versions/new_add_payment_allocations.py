
"""Create payment allocation records for session debts."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e41b7c92a603"
down_revision: Union[str, Sequence[str], None] = "d172a0f61c42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payment_allocations",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "payment_id",
            sa.Integer(),
            sa.ForeignKey("payments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "session_participant_id",
            sa.Integer(),
            sa.ForeignKey(
                "session_participants.id",
                ondelete="RESTRICT",
            ),
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.Numeric(10, 2),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "amount > 0",
            name="ck_payment_allocation_amount_positive",
        ),
        sa.UniqueConstraint(
            "payment_id",
            "session_participant_id",
            name="uq_payment_allocation_payment_participant",
        ),
    )

    # The unique constraint already creates an index beginning
    # with payment_id, so a separate payment_id index is unnecessary.
    op.create_index(
        "ix_payment_allocations_session_participant_id",
        "payment_allocations",
        ["session_participant_id"],
    )


def downgrade() -> None:
    # WARNING: This removes all payment allocation records.
    op.drop_index(
        "ix_payment_allocations_session_participant_id",
        table_name="payment_allocations",
    )

    op.drop_table("payment_allocations")
