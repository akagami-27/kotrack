"""add password reset rejection audit fields"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c840a2b9d13f"
down_revision: Union[str, Sequence[str], None] = "a2190d9f7c31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "password_reset_requests",
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "password_reset_requests",
        sa.Column("rejected_by", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_password_reset_requests_rejected_by_users",
        "password_reset_requests",
        "users",
        ["rejected_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    bind = op.get_bind()
    audit_count = bind.execute(
        sa.text(
            "SELECT count(*) FROM password_reset_requests "
            "WHERE rejected_at IS NOT NULL OR rejected_by IS NOT NULL"
        )
    ).scalar_one()
    if audit_count:
        raise RuntimeError(
            "Refusing downgrade: password-reset rejection audit records exist; "
            "use a forward recovery migration."
        )
    op.drop_constraint(
        "fk_password_reset_requests_rejected_by_users",
        "password_reset_requests",
        type_="foreignkey",
    )
    op.drop_column("password_reset_requests", "rejected_by")
    op.drop_column("password_reset_requests", "rejected_at")
