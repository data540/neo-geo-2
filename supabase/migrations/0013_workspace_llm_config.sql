-- =============================================================================
-- 0013: workspace_llm_config — per-workspace LLM provider settings
-- =============================================================================

create table workspace_llm_config (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null references workspaces(id) on delete cascade,
  llm_provider_id   uuid        not null references llm_providers(id),
  prompts_per_day   integer     not null default 0
                                check (prompts_per_day >= 0 and prompts_per_day <= 50),
  enabled           boolean     not null default false,
  updated_at        timestamptz not null default now(),

  unique (workspace_id, llm_provider_id)
);

alter table workspace_llm_config enable row level security;

create policy "wlc: member select" on workspace_llm_config
  for select using (is_workspace_member(workspace_id));

create policy "wlc: admin insert" on workspace_llm_config
  for insert with check (can_manage_workspace(workspace_id));

create policy "wlc: admin update" on workspace_llm_config
  for update using (can_manage_workspace(workspace_id));

create policy "wlc: admin delete" on workspace_llm_config
  for delete using (can_manage_workspace(workspace_id));

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspace_llm_config_updated_at
  before update on workspace_llm_config
  for each row execute function update_updated_at();
