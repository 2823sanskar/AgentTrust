"""Add interactive desktop run tracking fields."""

from alembic import op
import sqlalchemy as sa


revision = "20260723_0009"
down_revision = "20260723_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "runs",
        sa.Column(
            "is_interactive",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column("runs", sa.Column("container_id", sa.String(length=64), nullable=True))
    op.add_column("runs", sa.Column("vnc_port", sa.Integer(), nullable=True))
    op.add_column("runs", sa.Column("websockify_port", sa.Integer(), nullable=True))
    op.add_column("runs", sa.Column("session_token", sa.String(length=255), nullable=True))
    op.add_column(
        "runs",
        sa.Column(
            "desktop_status",
            sa.String(length=32),
            nullable=False,
            server_default="stopped",
        ),
    )
    op.add_column("runs", sa.Column("last_heartbeat", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_runs_is_interactive", "runs", ["is_interactive"])
    op.create_index("ix_runs_desktop_status", "runs", ["desktop_status"])
    op.create_index("ix_runs_last_heartbeat", "runs", ["last_heartbeat"])


def downgrade() -> None:
    op.drop_index("ix_runs_last_heartbeat", table_name="runs")
    op.drop_index("ix_runs_desktop_status", table_name="runs")
    op.drop_index("ix_runs_is_interactive", table_name="runs")
    op.drop_column("runs", "last_heartbeat")
    op.drop_column("runs", "desktop_status")
    op.drop_column("runs", "session_token")
    op.drop_column("runs", "websockify_port")
    op.drop_column("runs", "vnc_port")
    op.drop_column("runs", "container_id")
    op.drop_column("runs", "is_interactive")
