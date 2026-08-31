"""add user avatar"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "325f3e3f28b0"
down_revision: Union[str, Sequence[str], None] = "5b6d253a4423"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "avatar_data",
            sa.Text(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column(
        "users",
        "avatar_data",
    )