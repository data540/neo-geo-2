-- 0026: Corrige get_workspace_kpis para que avg_position solo cuente
-- prompts donde la marca SÍ fue mencionada (brand_mentioned = true)
-- y tiene posición válida (brand_position IS NOT NULL).

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
language sql
security definer
stable
as $$
  with performance as (
    select *
    from get_workspace_prompt_performance(p_workspace_slug, p_llm_key, null)
    where prompt_status = 'active'
  )
  select
    count(*)::bigint as active_prompts_count,
    count(*) filter (where brand_mentioned)::bigint as brand_mentions_count,
    round(
      avg(brand_position) filter (where brand_mentioned = true and brand_position is not null),
      1
    ) as avg_position,
    round(
      (
        (count(*) filter (where consistency_score >= 70))::numeric
        / nullif(count(*), 0)::numeric
      ) * 100,
      1
    ) as brand_consistency,
    round(avg(sov) filter (where sov is not null), 1) as avg_sov
  from performance;
$$;
