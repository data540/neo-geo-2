-- =============================================================================
-- 0003: Row Level Security — habilitar RLS y crear políticas
-- =============================================================================

-- Habilitar RLS en todas las tablas multi-tenant
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table brands enable row level security;
alter table brand_profiles enable row level security;
alter table prompts enable row level security;
alter table prompt_tags enable row level security;
alter table prompt_tag_assignments enable row level security;
alter table prompt_llms enable row level security;
alter table prompt_runs enable row level security;
alter table mentions enable row level security;
alter table sources enable row level security;
alter table daily_prompt_metrics enable row level security;
alter table daily_workspace_metrics enable row level security;

-- llm_providers es pública (seed data)
alter table llm_providers enable row level security;
create policy "llm_providers: public read" on llm_providers
  for select using (true);

-- Funciones helper de permisos
create or replace function is_workspace_member(p_workspace_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function can_manage_workspace(p_workspace_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- profiles: solo el propio usuario
create policy "profiles: own select" on profiles
  for select using (id = auth.uid());

create policy "profiles: own insert" on profiles
  for insert with check (id = auth.uid());

create policy "profiles: own update" on profiles
  for update using (id = auth.uid());

-- workspaces: solo miembros
create policy "workspaces: member select" on workspaces
  for select using (is_workspace_member(id));

create policy "workspaces: authenticated insert" on workspaces
  for insert with check (auth.uid() is not null);

create policy "workspaces: admin update" on workspaces
  for update using (can_manage_workspace(id));

create policy "workspaces: owner delete" on workspaces
  for delete using (
    exists (
      select 1 from workspace_members
      where workspace_id = id and user_id = auth.uid() and role = 'owner'
    )
  );

-- workspace_members
create policy "wm: member select" on workspace_members
  for select using (is_workspace_member(workspace_id));

create policy "wm: authenticated insert" on workspace_members
  for insert with check (auth.uid() is not null);

create policy "wm: admin delete" on workspace_members
  for delete using (can_manage_workspace(workspace_id));

-- Macro para tablas con workspace_id directo
do $$ declare t text; begin
  foreach t in array array[
    'brands', 'brand_profiles', 'prompts', 'prompt_tags',
    'prompt_runs', 'mentions', 'sources',
    'daily_prompt_metrics', 'daily_workspace_metrics'
  ] loop
    execute format(
      'create policy "%s: member select" on %s for select using (is_workspace_member(workspace_id))',
      t, t
    );
    execute format(
      'create policy "%s: admin insert" on %s for insert with check (can_manage_workspace(workspace_id))',
      t, t
    );
    execute format(
      'create policy "%s: admin update" on %s for update using (can_manage_workspace(workspace_id))',
      t, t
    );
    execute format(
      'create policy "%s: admin delete" on %s for delete using (can_manage_workspace(workspace_id))',
      t, t
    );
  end loop;
end $$;

-- prompt_tag_assignments (sin workspace_id directo, join via prompts)
create policy "pta: member select" on prompt_tag_assignments
  for select using (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and is_workspace_member(p.workspace_id)
    )
  );

create policy "pta: admin insert" on prompt_tag_assignments
  for insert with check (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and can_manage_workspace(p.workspace_id)
    )
  );

create policy "pta: admin delete" on prompt_tag_assignments
  for delete using (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and can_manage_workspace(p.workspace_id)
    )
  );

-- prompt_llms
create policy "pl: member select" on prompt_llms
  for select using (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and is_workspace_member(p.workspace_id)
    )
  );

create policy "pl: admin insert" on prompt_llms
  for insert with check (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and can_manage_workspace(p.workspace_id)
    )
  );

create policy "pl: admin delete" on prompt_llms
  for delete using (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and can_manage_workspace(p.workspace_id)
    )
  );
