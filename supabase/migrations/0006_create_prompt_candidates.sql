-- =============================================================================
-- 0006: Tabla temporal para candidatos del GEO Research Wizard
-- =============================================================================

create table prompt_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  session_id uuid not null,
  prompt text not null,
  intent text check (intent in (
    'discovery', 'comparison', 'reputation', 'branded',
    'decision', 'local', 'price', 'employability', 'product_specific'
  )),
  funnel_stage text check (funnel_stage in ('top', 'middle', 'bottom')),
  persona text,
  country text default 'ES',
  includes_brand boolean default false,
  includes_competitor boolean default false,
  strategic_value smallint check (strategic_value between 1 and 10),
  conversion_intent smallint check (conversion_intent between 1 and 10),
  ai_search_likelihood smallint check (ai_search_likelihood between 1 and 10),
  priority_score smallint check (priority_score between 1 and 100),
  priority_rank integer,
  reason text,
  coverage_area text,
  risk_if_brand_absent text check (risk_if_brand_absent in ('low', 'medium', 'high')),
  tags text[] default '{}',
  selected boolean default true not null,
  activated boolean default false not null,
  created_at timestamptz default now() not null
);

-- RLS
alter table prompt_candidates enable row level security;

create policy "pc: member select" on prompt_candidates
  for select using (is_workspace_member(workspace_id));

create policy "pc: admin insert" on prompt_candidates
  for insert with check (can_manage_workspace(workspace_id));

create policy "pc: admin update" on prompt_candidates
  for update using (can_manage_workspace(workspace_id));

create policy "pc: admin delete" on prompt_candidates
  for delete using (can_manage_workspace(workspace_id));

-- Limpiar sesiones antiguas (>7 días) automáticamente
create or replace function cleanup_old_prompt_candidates()
returns void language sql as $$
  delete from prompt_candidates
  where created_at < now() - interval '7 days' and activated = false;
$$;
