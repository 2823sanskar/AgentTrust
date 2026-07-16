"""Add Stellar wallet fields to users."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260716_0003"
down_revision: Union[str, None] = "20260711_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stellar_wallet_address", sa.String(length=56), nullable=True))
    op.add_column("users", sa.Column("stellar_wallet_network", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "stellar_wallet_network")
    op.drop_column("users", "stellar_wallet_address")
