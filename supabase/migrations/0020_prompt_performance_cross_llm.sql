-- =============================================================================
-- 0020: Refactor get_workspace_prompt_performance para métricas cross-LLM
-- Agrega métricas de TODOS los LLMs habilitados del workspace (avg posición,
-- max SOV, etc.) y elimina el filtro p_llm_key obligatorio.
-- Devuelve también un JSONB per_llm con detalle por proveedor.
-- =============================================================================

create or replace function get_workspace_prompt_performance(
  p_workspace_slug   text,
  p_llm_key          text default null,
  p_country_filter   text default null
)
returns table (
  prompt_id          uuid,
  prompt_text        text,
  prompt_status      text,
  prompt_country     text,
  prompt_intent      text,
  prompt_funnel_stage text,
  prompt_persona     text,
  includes_brand     boolean,
  priority_score     smallint,
  brand_mentioned    boolean,
  brand_position     integer,
  competitor_count   integer,
  sov                numeric,
  sentiment          text,
  consistency_score  numeric,
  last_run_at        timestamptz,
  rank               bigint,
  per_llm            jsonb
)
language sql security definer stable as $$
  with workspace as (
    select id, slug from workspaces where slug = p_workspace_slug
  ),
  -- Métricas por (prompt, llm) más recientes
  latest_metrics_per_llm as (
    select distinct on (dpm.prompt_id, dpm.llm_provider_id)
      dpm.prompt_id,
      dpm.llm_provider_id,
      lp.key              as llm_key,
      lp.name             as llm_name,
      dpm.brand_mentioned,
      dpm.brand_position,
      dpm.competitor_count,
      dpm.sov,
      dpm.sentiment,
      dpm.consistency_score,
      dpm.date
    from daily_prompt_metrics dpm
    join llm_providers lp on lp.id = dpm.llm_provider_id
    join workspace w on w.id = dpm.workspace_id
    -- Si se pasa p_llm_key filtra por ese LLM, si no agrega todos
    where (p_llm_key is null or lp.key = p_llm_key)
    order by dpm.prompt_id, dpm.llm_provider_id, dpm.date desc
  ),
  -- Agregados cross-LLM por prompt
  cross_llm as (
    select
      prompt_id,
      bool_or(brand_mentioned)                                  as brand_mentioned,
      round(avg(brand_position) filter (where brand_mentioned and brand_position is not null), 1)::integer
                                                                as brand_position,
      round(avg(competitor_count), 0)::integer                  as competitor_count,
      round(max(sov), 1)                                        as sov,
      -- sentiment más frecuente (mode)
      mode() within group (order by sentiment)                  as sentiment,
      round(avg(consistency_score), 1)                          as consistency_score,
      -- JSONB: {chatgpt: {brand_mentioned, position, sov, sentiment, consistency}, ...}
      jsonb_object_agg(
        llm_key,
        jsonb_build_object(
          'brand_mentioned',   brand_mentioned,
          'brand_position',    brand_position,
          'sov',               sov,
          'sentiment',         sentiment,
          'consistency_score', consistency_score
        )
      )                                                         as per_llm
    from latest_metrics_per_llm
    group by prompt_id
  ),
  last_runs as (
    select distinct on (pr.prompt_id)
      pr.prompt_id,
      pr.completed_at
    from prompt_runs pr
    join workspace w on w.id = pr.workspace_id
    where pr.status = 'completed'
      and (p_llm_key is null or exists (
        select 1 from llm_providers lp
        where lp.id = pr.llm_provider_id and lp.key = p_llm_key
      ))
    order by pr.prompt_id, pr.completed_at desc
  )
  select
    p.id                                            as prompt_id,
    p.text                                          as prompt_text,
    p.status                                        as prompt_status,
    p.country                                       as prompt_country,
    p.intent                                        as prompt_intent,
    p.funnel_stage                                  as prompt_funnel_stage,
    p.persona                                       as prompt_persona,
    coalesce(p.includes_brand, false)               as includes_brand,
    p.priority_score,
    coalesce(cl.brand_mentioned, false)             as brand_mentioned,
    cl.brand_position,
    coalesce(cl.competitor_count, 0)                as competitor_count,
    cl.sov,
    coalesce(cl.sentiment, 'no_data')               as sentiment,
    coalesce(cl.consistency_score, 0)               as consistency_score,
    lr.completed_at                                 as last_run_at,
    row_number() over (
      order by
        coalesce(cl.brand_mentioned, false) desc,
        cl.brand_position asc nulls last,
        coalesce(cl.sov, 0) desc
    )                                               as rank,
    coalesce(cl.per_llm, '{}'::jsonb)               as per_llm
  from prompts p
  join workspace w on w.id = p.workspace_id
  left join cross_llm cl on cl.prompt_id = p.id
  left join last_runs lr on lr.prompt_id = p.id
  where (p_country_filter is null or p.country = p_country_filter)
  order by
    coalesce(cl.brand_mentioned, false) desc,
    cl.brand_position asc nulls last,
    coalesce(cl.sov, 0) desc;
$$;
