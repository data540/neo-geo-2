-- =============================================================================
-- 0012: Fix get_workspace_prompt_performance — métricas históricas completas.
--       Posición, SOV y sentimiento se calculan sobre TODOS los runs históricos
--       (no solo el último ni solo los de hoy).
-- =============================================================================

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
language sql
security definer
stable
as $$
  with workspace_ctx as (
    select w.id as workspace_id
    from workspaces w
    where w.slug = p_workspace_slug
  ),
  selected_prompts as (
    select p.*
    from prompts p
    join workspace_ctx wc on wc.workspace_id = p.workspace_id
    where (p_country_filter is null or p.country = p_country_filter)
  ),
  -- Todos los runs completados para el LLM seleccionado
  all_completed_runs as (
    select
      pr.id as run_id,
      pr.prompt_id,
      pr.completed_at,
      pr.created_at
    from prompt_runs pr
    join llm_providers lp on lp.id = pr.llm_provider_id
    join selected_prompts sp on sp.id = pr.prompt_id
    where lp.key = p_llm_key
      and pr.status = 'completed'
  ),
  -- Último run por prompt (para last_run_at)
  latest_run as (
    select distinct on (acr.prompt_id)
      acr.prompt_id,
      acr.completed_at as last_run_at
    from all_completed_runs acr
    order by acr.prompt_id, acr.completed_at desc nulls last, acr.created_at desc
  ),
  -- Todas las menciones de todos los runs históricos
  all_mentions as (
    select
      acr.prompt_id,
      acr.run_id,
      m.brand_type,
      m.position,
      m.sentiment
    from all_completed_runs acr
    left join mentions m on m.prompt_run_id = acr.run_id
  ),
  -- Total de runs por prompt (denominador para consistencia y SOV)
  run_counts as (
    select
      acr.prompt_id,
      count(distinct acr.run_id) as total_runs
    from all_completed_runs acr
    group by acr.prompt_id
  ),
  -- Runs donde la marca propia fue mencionada (para consistencia)
  own_mention_runs as (
    select
      am.prompt_id,
      count(distinct am.run_id) as runs_with_own_mention
    from all_mentions am
    where am.brand_type = 'own'
    group by am.prompt_id
  ),
  -- Métricas históricas agregadas por prompt
  historical_metrics as (
    select
      rc.prompt_id,
      rc.total_runs,
      coalesce(omr.runs_with_own_mention, 0) as runs_with_own_mention,
      -- Posición media histórica (solo runs donde la marca apareció)
      round(
        avg(am.position) filter (where am.brand_type = 'own' and am.position is not null),
        1
      )::integer as brand_position,
      -- Competidores: promedio del count por run
      round(
        avg(comp_per_run.competitor_count)
      )::integer as competitor_count,
      -- SOV histórico: % de runs con mención propia sobre total runs con alguna mención
      case
        when rc.total_runs = 0 then null
        else round(
          (coalesce(omr.runs_with_own_mention, 0)::numeric / rc.total_runs::numeric) * 100,
          1
        )
      end as sov,
      -- Sentimiento dominante en el historial
      (
        select mode() within group (order by am2.sentiment)
        from all_mentions am2
        where am2.prompt_id = rc.prompt_id
          and am2.brand_type = 'own'
          and am2.sentiment is not null
      ) as sentiment,
      -- Consistencia: % de runs con mención propia
      case
        when rc.total_runs = 0 then 0
        else round(
          (coalesce(omr.runs_with_own_mention, 0)::numeric / rc.total_runs::numeric) * 100,
          1
        )
      end as consistency_score
    from run_counts rc
    left join own_mention_runs omr on omr.prompt_id = rc.prompt_id
    left join all_mentions am on am.prompt_id = rc.prompt_id
    left join lateral (
      select
        acr2.run_id,
        count(*) filter (where am3.brand_type = 'competitor') as competitor_count
      from all_completed_runs acr2
      left join mentions am3 on am3.prompt_run_id = acr2.run_id
      where acr2.prompt_id = rc.prompt_id
      group by acr2.run_id
    ) comp_per_run on true
    group by rc.prompt_id, rc.total_runs, omr.runs_with_own_mention
  )
  select
    sp.id as prompt_id,
    sp.text::text as prompt_text,
    sp.status::text as prompt_status,
    sp.country::text as prompt_country,
    sp.intent::text as prompt_intent,
    sp.funnel_stage::text as prompt_funnel_stage,
    sp.persona::text as prompt_persona,
    coalesce(sp.includes_brand, false) as includes_brand,
    sp.priority_score::smallint as priority_score,
    coalesce(hm.runs_with_own_mention, 0) > 0 as brand_mentioned,
    hm.brand_position::integer as brand_position,
    coalesce(hm.competitor_count, 0)::integer as competitor_count,
    hm.sov::numeric as sov,
    coalesce(hm.sentiment, 'no_data')::text as sentiment,
    coalesce(hm.consistency_score, 0)::numeric as consistency_score,
    lr.last_run_at,
    row_number() over (
      order by
        coalesce(hm.runs_with_own_mention, 0) > 0 desc,
        hm.brand_position asc nulls last,
        coalesce(hm.sov, 0) desc
    )::bigint as rank
  from selected_prompts sp
  left join historical_metrics hm on hm.prompt_id = sp.id
  left join latest_run lr on lr.prompt_id = sp.id
  order by
    coalesce(hm.runs_with_own_mention, 0) > 0 desc,
    hm.brand_position asc nulls last,
    coalesce(hm.sov, 0) desc;
$$;
