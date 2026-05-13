-- =============================================================================
-- 0009: RLS for competitor suggestions
-- =============================================================================

alter table competitor_suggestions enable row level security;

create policy "competitor_suggestions: member select" on competitor_suggestions
  for select using (is_workspace_member(workspace_id));

create policy "competitor_suggestions: admin insert" on competitor_suggestions
  for insert with check (can_manage_workspace(workspace_id));

create policy "competitor_suggestions: admin update" on competitor_suggestions
  for update using (can_manage_workspace(workspace_id));

create policy "competitor_suggestions: admin delete" on competitor_suggestions
  for delete using (can_manage_workspace(workspace_id));
