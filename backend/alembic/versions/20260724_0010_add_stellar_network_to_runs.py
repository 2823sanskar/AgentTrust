"""Record the Stellar network used for each anchored run.

Revision ID: 20260724_0010
Revises: 20260723_0009
Create Date: 2026-07-24
"""

from alembic import op


revision = "20260724_0010"
down_revision = "20260723_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE runs ADD COLUMN IF NOT EXISTS stellar_network VARCHAR(20)"
    )
    op.execute(
        "UPDATE runs SET stellar_network = 'testnet' "
        "WHERE stellar_transaction IS NOT NULL AND stellar_network IS NULL"
    )


def downgrade() -> None:
    op.drop_column("runs", "stellar_network")
