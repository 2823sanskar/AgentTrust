"""Add action log to execution runs."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260711_0002"
down_revision: Union[str, None] = "20260708_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("action_log", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("runs", "action_log")
