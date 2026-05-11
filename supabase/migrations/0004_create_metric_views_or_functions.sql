-- =============================================================================
-- 0004: Funciones SQL para métricas y vistas de performance
-- =============================================================================

-- Función principal: datos completos para /[workspace]/prompts
create or replace function get_workspace_prompt_performance(
  p_workspace_slug text,
  p_llm_key text default 'chatgpt',
  p_country_filter text default null
)
returns table (
  prompt_id uuid,
  prompt_text text,
  prompt_status text,
  prompt_country text,
  prompt_intent text,
  prompt_funnel_stage text,
  prompt_persona text,
  includes_brand boolean,
  priority_score smallint,
  brand_mentioned boolean,
  brand_position integer,
  competitor_count integer,
  sov numeric,
  sentiment text,
  consistency_score numeric,
  last_run_at timestamptz,
  rank bigint
)
language sql security definer stable as $$
  with latest_metrics as (
    select distinct on (dpm.prompt_id)
      dpm.prompt_id,
      dpm.brand_mentioned,
      dpm.brand_position,
      dpm.competitor_count,
      dpm.sov,
      dpm.sentiment,
      dpm.consistency_score,
      dpm.date
    from daily_prompt_metrics dpm
    join llm_providers lp on lp.id = dpm.llm_provider_id
    join workspaces w on w.id = dpm.workspace_id
    where w.slug = p_workspace_slug
      and lp.key = p_llm_key
    order by dpm.prompt_id, dpm.date desc
  ),
  last_runs as (
    select distinct on (pr.prompt_id)
      pr.prompt_id,
      pr.completed_at
    from prompt_runs pr
    join llm_providers lp on lp.id = pr.llm_provider_id
    join workspaces w on w.id = pr.workspace_id
    where w.slug = p_workspace_slug
      and lp.key = p_llm_key
      and pr.status = 'completed'
    order by pr.prompt_id, pr.completed_at desc
  )
  select
    p.id as prompt_id,
    p.text as prompt_text,
    p.status as prompt_status,
    p.country as prompt_country,
    p.intent as prompt_intent,
    p.funnel_stage as prompt_funnel_stage,
    p.persona as prompt_persona,
    coalesce(p.includes_brand, false) as includes_brand,
    p.priority_score,
    coalesce(lm.brand_mentioned, false) as brand_mentioned,
    lm.brand_position,
    coalesce(lm.competitor_count, 0) as competitor_count,
    lm.sov,
    coalesce(lm.sentiment, 'no_data') as sentiment,
    coalesce(lm.consistency_score, 0) as consistency_score,
    lr.completed_at as last_run_at,
    row_number() over (
      order by
        coalesce(lm.brand_mentioned, false) desc,
        lm.brand_position asc nulls last,
        coalesce(lm.sov, 0) desc
    ) as rank
  from prompts p
  join workspaces w on w.id = p.workspace_id
  left join latest_metrics lm on lm.prompt_id = p.id
  left join last_runs lr on lr.prompt_id = p.id
  where w.slug = p_workspace_slug
    and (p_country_filter is null or p.country = p_country_filter)
  order by
    coalesce(lm.brand_mentioned, false) desc,
    lm.brand_position asc nulls last,
    coalesce(lm.sov, 0) desc;
$$;

-- Función: KPIs de workspace para un LLM
create or replace function get_workspace_kpis(
  p_workspace_slug text,
  p_llm_key text default 'chatgpt'
)
returns table (
  active_prompts_count bigint,
  brand_mentions_count bigint,
  avg_position numeric,
  brand_consistency numeric,
  avg_sov numeric
)
language sql security definer stable as $$
  with latest_metrics as (
    select distinct on (dpm.prompt_id)
      dpm.prompt_id,
      dpm.brand_mentioned,
      dpm.brand_position,
      dpm.sov,
      dpm.consistency_score
    from daily_prompt_metrics dpm
    join llm_providers lp on lp.id = dpm.llm_provider_id
    join workspaces w on w.id = dpm.workspace_id
    join prompts p on p.id = dpm.prompt_id
    where w.slug = p_workspace_slug
      and lp.key = p_llm_key
      and p.status = 'active'
    order by dpm.prompt_id, dpm.date desc
  )
  select
    count(distinct p.id)::bigint as active_prompts_count,
    count(distinct case when lm.brand_mentioned then lm.prompt_id end)::bigint as brand_mentions_count,
    round(
      avg(lm.brand_position) filter (where lm.brand_mentioned and lm.brand_position is not null),
      1
    ) as avg_position,
    round(
      (count(distinct case when coalesce(lm.consistency_score, 0) >= 70 then p.id end)::numeric /
       nullif(count(distinct p.id), 0)::numeric * 100),
      1
    ) as brand_consistency,
    round(avg(lm.sov) filter (where lm.sov is not null), 1) as avg_sov
  from prompts p
  join workspaces w on w.id = p.workspace_id
  left join latest_metrics lm on lm.prompt_id = p.id
  where w.slug = p_workspace_slug
    and p.status = 'active';
$$;
