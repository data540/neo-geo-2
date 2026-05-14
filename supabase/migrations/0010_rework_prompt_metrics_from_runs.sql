-- =============================================================================
-- 0010: Métricas de Prompts desde prompt_runs + mentions (diario + histórico)
-- =============================================================================

drop function if exists get_workspace_prompt_performance(text, text, text);
drop function if exists get_workspace_kpis(text, text);

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
    select
      w.id as workspace_id,
      case
        when w.country = 'CO' then 'America/Bogota'
        else 'Europe/Madrid'
      end as tz
    from workspaces w
    where w.slug = p_workspace_slug
  ),
  selected_prompts as (
    select p.*, wc.tz
    from prompts p
    join workspace_ctx wc on wc.workspace_id = p.workspace_id
    where (p_country_filter is null or p.country = p_country_filter)
  ),
  all_completed_runs as (
    select
      pr.id,
      pr.prompt_id,
      pr.completed_at,
      pr.created_at,
      sp.tz,
      (pr.completed_at at time zone sp.tz)::date as local_day
    from prompt_runs pr
    join llm_providers lp on lp.id = pr.llm_provider_id
    join selected_prompts sp on sp.id = pr.prompt_id
    where lp.key = p_llm_key
      and pr.status = 'completed'
  ),
  today_runs as (
    select acr.*
    from all_completed_runs acr
    where acr.local_day = (now() at time zone acr.tz)::date
  ),
  latest_today_run as (
    select distinct on (tr.prompt_id)
      tr.prompt_id,
      tr.id as run_id,
      tr.completed_at
    from today_runs tr
    order by tr.prompt_id, tr.completed_at desc nulls last, tr.created_at desc
  ),
  latest_today_metrics as (
    select
      ltr.prompt_id,
      coalesce(count(*) filter (where m.brand_type = 'own'), 0)::int as own_mentions,
      min(m.position) filter (where m.brand_type = 'own') as brand_position,
      coalesce(count(*) filter (where m.brand_type = 'competitor'), 0)::int as competitor_count,
      coalesce(
        (array_agg(m.sentiment order by m.created_at desc) filter (
          where m.brand_type = 'own' and m.sentiment is not null
        ))[1],
        'no_data'
      )::text as sentiment,
      ltr.completed_at as last_run_at
    from latest_today_run ltr
    left join mentions m on m.prompt_run_id = ltr.run_id
    group by ltr.prompt_id, ltr.completed_at
  ),
  latest_run_by_day as (
    select
      acr.prompt_id,
      acr.id as run_id,
      acr.local_day,
      row_number() over (
        partition by acr.prompt_id, acr.local_day
        order by acr.completed_at desc nulls last, acr.created_at desc
      ) as rn
    from all_completed_runs acr
  ),
  last_30_days_runs as (
    select lrd.prompt_id, lrd.run_id
    from latest_run_by_day lrd
    where lrd.rn = 1
      and lrd.local_day >= current_date - 30
  ),
  daily_mention_flags as (
    select
      l30.prompt_id,
      exists (
        select 1
        from mentions m
        where m.prompt_run_id = l30.run_id
          and m.brand_type = 'own'
      ) as has_own_mention
    from last_30_days_runs l30
  ),
  consistency as (
    select
      dmf.prompt_id,
      round(
        (
          (count(*) filter (where dmf.has_own_mention))::numeric
          / nullif(count(*), 0)::numeric
        ) * 100,
        1
      ) as consistency_score
    from daily_mention_flags dmf
    group by dmf.prompt_id
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
    coalesce(ltm.own_mentions, 0) > 0 as brand_mentioned,
    ltm.brand_position::integer as brand_position,
    coalesce(ltm.competitor_count, 0)::integer as competitor_count,
    case
      when coalesce(ltm.own_mentions, 0) + coalesce(ltm.competitor_count, 0) = 0 then null
      else round(
        (coalesce(ltm.own_mentions, 0)::numeric
          / (coalesce(ltm.own_mentions, 0) + coalesce(ltm.competitor_count, 0))::numeric) * 100,
        1
      )
    end::numeric as sov,
    coalesce(ltm.sentiment, 'no_data')::text as sentiment,
    coalesce(c.consistency_score, 0)::numeric as consistency_score,
    ltm.last_run_at,
    row_number() over (
      order by
        (coalesce(ltm.own_mentions, 0) > 0) desc,
        ltm.brand_position asc nulls last,
        case
          when coalesce(ltm.own_mentions, 0) + coalesce(ltm.competitor_count, 0) = 0 then 0
          else (
            (coalesce(ltm.own_mentions, 0)::numeric
              / (coalesce(ltm.own_mentions, 0) + coalesce(ltm.competitor_count, 0))::numeric) * 100
          )
        end desc
    )::bigint as rank
  from selected_prompts sp
  left join latest_today_metrics ltm on ltm.prompt_id = sp.id
  left join consistency c on c.prompt_id = sp.id
  order by
    (coalesce(ltm.own_mentions, 0) > 0) desc,
    ltm.brand_position asc nulls last,
    case
      when coalesce(ltm.own_mentions, 0) + coalesce(ltm.competitor_count, 0) = 0 then 0
      else (
        (coalesce(ltm.own_mentions, 0)::numeric
          / (coalesce(ltm.own_mentions, 0) + coalesce(ltm.competitor_count, 0))::numeric) * 100
      )
    end desc;
$$;

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
    round(avg(brand_position) filter (where brand_position is not null), 1) as avg_position,
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
