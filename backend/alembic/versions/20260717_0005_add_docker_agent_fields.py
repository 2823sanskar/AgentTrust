"""Add Docker agent configuration and container run evidence."""

from alembic import op
import sqlalchemy as sa


revision = "20260717_0005"
down_revision = "20260716_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("docker_image", sa.String(length=255), nullable=True))
    op.add_column("agents", sa.Column("docker_command", sa.Text(), nullable=True))
    op.add_column("agents", sa.Column("timeout_seconds", sa.Integer(), nullable=True))
    op.add_column("runs", sa.Column("container_stdout", sa.Text(), nullable=True))
    op.add_column("runs", sa.Column("container_stderr", sa.Text(), nullable=True))
    op.add_column("runs", sa.Column("exit_code", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("runs", "exit_code")
    op.drop_column("runs", "container_stderr")
    op.drop_column("runs", "container_stdout")
    op.drop_column("agents", "timeout_seconds")
    op.drop_column("agents", "docker_command")
    op.drop_column("agents", "docker_image")
