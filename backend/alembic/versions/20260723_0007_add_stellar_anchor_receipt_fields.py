"""add stellar anchor receipt fields

Revision ID: 20260723_0007
Revises: 20260722_0006
Create Date: 2026-07-23
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260723_0007"
down_revision: Union[str, None] = "20260722_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS stellar_ledger_sequence INTEGER")
    op.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS anchored_at TIMESTAMP WITH TIME ZONE")
    op.execute(
        "ALTER TABLE runs ADD COLUMN IF NOT EXISTS "
        "anchor_status VARCHAR(32) NOT NULL DEFAULT 'pending_anchor'"
    )


def downgrade() -> None:
    op.drop_column("runs", "anchor_status")
    op.drop_column("runs", "anchored_at")
    op.drop_column("runs", "stellar_ledger_sequence")
