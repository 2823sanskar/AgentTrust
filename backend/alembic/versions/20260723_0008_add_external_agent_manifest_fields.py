"""Add external agent manifest fields."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260723_0008"
down_revision = "20260723_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column("agent_type", sa.String(length=32), nullable=False, server_default="prebuilt"),
    )
    op.add_column("agents", sa.Column("entrypoint_command", sa.Text(), nullable=True))
    op.add_column("agents", sa.Column("required_env_vars", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("agents", sa.Column("source_repo_url", sa.String(length=500), nullable=True))
    op.execute(
        "UPDATE agents SET agent_type = 'custom_docker' "
        "WHERE provider = 'external_docker' AND agent_type = 'prebuilt'"
    )
    op.alter_column("agents", "agent_type", server_default=None)


def downgrade() -> None:
    op.drop_column("agents", "source_repo_url")
    op.drop_column("agents", "required_env_vars")
    op.drop_column("agents", "entrypoint_command")
    op.drop_column("agents", "agent_type")
