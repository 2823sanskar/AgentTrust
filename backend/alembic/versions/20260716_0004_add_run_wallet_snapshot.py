"""Add Stellar wallet snapshot fields to runs."""

from alembic import op
import sqlalchemy as sa


revision = "20260716_0004"
down_revision = "20260716_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("user_stellar_wallet_address", sa.String(length=56), nullable=True))
    op.add_column("runs", sa.Column("user_stellar_wallet_network", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("runs", "user_stellar_wallet_network")
    op.drop_column("runs", "user_stellar_wallet_address")
