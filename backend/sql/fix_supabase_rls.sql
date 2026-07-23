-- Fix Supabase linter errors:
-- - rls_disabled_in_public
-- - sensitive_columns_exposed on public.users.password
--
-- AgentTrust uses FastAPI as the API layer, so public Supabase Data API access
-- is not required for these tables. Enable RLS and revoke browser API roles.

alter table public.alembic_version enable row level security;
alter table public.users enable row level security;
alter table public.agents enable row level security;
alter table public.runs enable row level security;
alter table public.trust_scores enable row level security;

revoke all on table public.alembic_version from anon;
revoke all on table public.users from anon;
revoke all on table public.agents from anon;
revoke all on table public.runs from anon;
revoke all on table public.trust_scores from anon;

revoke all on table public.alembic_version from authenticated;
revoke all on table public.users from authenticated;
revoke all on table public.agents from authenticated;
revoke all on table public.runs from authenticated;
revoke all on table public.trust_scores from authenticated;
