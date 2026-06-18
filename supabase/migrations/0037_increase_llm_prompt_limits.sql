-- =============================================================================
-- 0037: increase per-provider LLM prompt allocation limit
-- =============================================================================

alter table workspace_llm_config
  drop constraint if exists workspace_llm_config_prompts_per_day_check;

alter table workspace_llm_config
  add constraint workspace_llm_config_prompts_per_day_check
  check (prompts_per_day >= 0 and prompts_per_day <= 200);
