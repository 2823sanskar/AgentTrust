"""Enable RLS for Supabase-exposed public tables."""

from alembic import op


revision = "20260722_0006"
down_revision = "20260717_0005"
branch_labels = None
depends_on = None


TABLES = (
    "alembic_version",
    "users",
    "agents",
    "runs",
    "trust_scores",
)


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE public.{table} FROM anon")
        op.execute(f"REVOKE ALL ON TABLE public.{table} FROM authenticated")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
