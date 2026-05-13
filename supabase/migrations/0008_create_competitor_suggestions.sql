-- =============================================================================
-- 0008: Competitor suggestions from LLM responses
-- =============================================================================

create table competitor_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  prompt_run_id uuid references prompt_runs(id) on delete cascade not null,
  name text not null,
  normalized_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now() not null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create unique index competitor_suggestions_pending_unique
  on competitor_suggestions (workspace_id, normalized_name)
  where status = 'pending';
