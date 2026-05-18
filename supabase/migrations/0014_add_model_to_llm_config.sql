-- =============================================================================
-- 0014: add model column to workspace_llm_config
-- =============================================================================

alter table workspace_llm_config
  add column if not exists model text;
