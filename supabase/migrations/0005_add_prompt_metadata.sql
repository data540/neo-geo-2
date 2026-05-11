-- =============================================================================
-- 0005: Metadatos de prompts para GEO Research Skill
-- =============================================================================

alter table prompts
  add column if not exists intent text check (intent in (
    'discovery', 'comparison', 'reputation', 'branded',
    'decision', 'local', 'price', 'employability', 'product_specific'
  )),
  add column if not exists funnel_stage text check (funnel_stage in ('top', 'middle', 'bottom')),
  add column if not exists persona text,
  add column if not exists includes_brand boolean default false,
  add column if not exists includes_competitor boolean default false,
  add column if not exists strategic_value smallint check (strategic_value between 1 and 10),
  add column if not exists conversion_intent smallint check (conversion_intent between 1 and 10),
  add column if not exists ai_search_likelihood smallint check (ai_search_likelihood between 1 and 10),
  add column if not exists priority_score smallint check (priority_score between 1 and 100),
  add column if not exists research_reason text,
  add column if not exists coverage_area text;
