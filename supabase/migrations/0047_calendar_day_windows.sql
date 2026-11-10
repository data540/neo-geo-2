-- 0047_calendar_day_windows.sql
--
-- 1. Ventanas por días naturales cerrados en la zona horaria del workspace
--    (Europe/Madrid, o America/Bogota con filtro CO), igual que
--    getPeriodWindow() en src/lib/metrics/visibility.ts: "7D" = los 7 últimos
--    días completos (sin hoy) y "Ayer" = el día de ayer, que coinciden con el
--    gráfico de tendencia. Antes eran las últimas N×24 h.
-- 2. Sentiment de la comparación por LLM = sentiment_score (o la etiqueta si
--    falta), el mismo valor que la tarjeta Sentiment del Dashboard.

create or replace function public.metrics_window(days integer, p_country_filter text default null)
returns table(cur_start timestamptz, cur_end timestamptz, prev_start timestamptz)
language sql stable set search_path to 'public'
as $function$
  with tz as (
    select case when p_country_filter = 'CO' then 'America/Bogota' else 'Europe/Madrid' end as name
  ),
  today as (
    select (now() at time zone (select name from tz))::date as d
  )
  select
    ((select d from today) - days)::timestamp at time zone (select name from tz),
    (select d from today)::timestamp at time zone (select name from tz),
    ((select d from today) - days * 2)::timestamp at time zone (select name from tz);
$function$;

-- ── Market share ─────────────────────────────────────────────────────────────
create or replace function public.get_workspace_market_share(
  workspace_slug text,
  days integer default 30,
  llm_key text default null,
  p_country_filter text default null
)
returns table(brand_id uuid, brand_name text, brand_domain text, brand_type text, mentions_count bigint, share_pct numeric)
language sql stable security definer set search_path to 'public'
as $function$
  with ws as (select id from workspaces where slug = workspace_slug),
  win as (select * from public.metrics_window(days, p_country_filter)),
  runs as (
    select pr.id
    from prompt_runs pr
    join ws on pr.workspace_id = ws.id
    join prompts p on pr.prompt_id = p.id
    where pr.status = 'completed'
      and pr.completed_at >= (select cur_start from win)
      and pr.completed_at < (select cur_end from win)
      and (llm_key is null or pr.llm_provider_id = (select id from llm_providers where key = llm_key))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  filtered as (
    select m.brand_id, m.brand_type
    from mentions m
    join ws on m.workspace_id = ws.id
    join runs r on m.prompt_run_id = r.id
    where m.brand_id is not null
  ),
  agg as (select brand_id, brand_type, count(*)::bigint as mentions_count from filtered group by brand_id, brand_type),
  total as (select coalesce(sum(mentions_count), 0)::numeric as total from agg)
  select b.id, b.name, b.domain, a.brand_type::text, a.mentions_count,
    case when (select total from total) > 0
         then round((a.mentions_count::numeric / (select total from total)) * 100, 1) else 0 end
  from agg a join brands b on a.brand_id = b.id
  order by a.mentions_count desc;
$function$;

-- ── Mention breakdown ────────────────────────────────────────────────────────
create or replace function public.get_workspace_mention_breakdown(
  workspace_slug text,
  days integer default 30,
  llm_key text default null,
  p_country_filter text default null
)
returns table(mention_type text, count bigint, pct numeric)
language sql stable security definer set search_path to 'public'
as $function$
  with ws as (select id from workspaces where slug = workspace_slug),
  win as (select * from public.metrics_window(days, p_country_filter)),
  runs as (
    select pr.id
    from prompt_runs pr
    join ws on pr.workspace_id = ws.id
    join prompts p on pr.prompt_id = p.id
    where pr.status = 'completed'
      and pr.completed_at >= (select cur_start from win)
      and pr.completed_at < (select cur_end from win)
      and (llm_key is null or pr.llm_provider_id = (select id from llm_providers where key = llm_key))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  filtered as (
    select coalesce(m.mention_type::text, 'general_mention') as mtype
    from mentions m
    join ws on m.workspace_id = ws.id
    join runs r on m.prompt_run_id = r.id
    where m.brand_type = 'own'
  ),
  agg as (select mtype, count(*)::bigint as count from filtered group by mtype),
  total as (select coalesce(sum(count), 0)::numeric as total from agg)
  select a.mtype, a.count,
    case when (select total from total) > 0
         then round((a.count::numeric / (select total from total)) * 100, 1) else 0 end
  from agg a order by a.count desc;
$function$;

-- ── Top competitors (share sobre el total de menciones, como el donut) ───────
create or replace function public.get_workspace_top_competitors(
  workspace_slug text,
  days integer default 30,
  limit_n integer default 5,
  llm_key text default null,
  p_country_filter text default null
)
returns table(competitor_id uuid, competitor_name text, competitor_domain text, mentions_count bigint, share_pct numeric, trend_pct numeric)
language sql stable security definer set search_path to 'public'
as $function$
  with ws as (select id from workspaces where slug = workspace_slug),
  win as (select * from public.metrics_window(days, p_country_filter)),
  runs as (
    select pr.id,
      (pr.completed_at >= (select cur_start from win)) as is_current
    from prompt_runs pr
    join ws on pr.workspace_id = ws.id
    join prompts p on pr.prompt_id = p.id
    where pr.status = 'completed'
      and pr.completed_at >= (select prev_start from win)
      and pr.completed_at < (select cur_end from win)
      and (llm_key is null or pr.llm_provider_id = (select id from llm_providers where key = llm_key))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  window_mentions as (
    select m.brand_id, m.brand_type, r.is_current
    from mentions m
    join ws on m.workspace_id = ws.id
    join runs r on m.prompt_run_id = r.id
    where m.brand_id is not null
  ),
  curr_period as (
    select brand_id, count(*)::bigint as cnt
    from window_mentions
    where is_current and brand_type = 'competitor'
    group by brand_id
  ),
  prev_period as (
    select brand_id, count(*)::bigint as cnt
    from window_mentions
    where not is_current and brand_type = 'competitor'
    group by brand_id
  ),
  total as (
    select count(*)::numeric as total from window_mentions where is_current
  )
  select b.id, b.name, b.domain, c.cnt,
    case when (select total from total) > 0
         then round((c.cnt::numeric / (select total from total)) * 100, 1) else 0 end,
    case when p.cnt is null or p.cnt = 0 then null
         else round(((c.cnt::numeric - p.cnt::numeric) / p.cnt::numeric) * 100, 1) end
  from curr_period c
  join brands b on c.brand_id = b.id
  left join prev_period p on c.brand_id = p.brand_id
  order by c.cnt desc limit limit_n;
$function$;

-- ── Top sources ──────────────────────────────────────────────────────────────
create or replace function public.get_workspace_top_sources(
  workspace_slug text,
  days integer default 30,
  limit_n integer default 5,
  llm_key text default null,
  p_country_filter text default null
)
returns table(domain text, citations_count bigint, pct_of_runs numeric)
language sql stable security definer set search_path to 'public'
as $function$
  with ws as (select id from workspaces where slug = workspace_slug),
  win as (select * from public.metrics_window(days, p_country_filter)),
  runs as (
    select pr.id
    from prompt_runs pr
    join ws on pr.workspace_id = ws.id
    join prompts p on pr.prompt_id = p.id
    where pr.status = 'completed'
      and pr.completed_at >= (select cur_start from win)
      and pr.completed_at < (select cur_end from win)
      and (llm_key is null or pr.llm_provider_id = (select id from llm_providers where key = llm_key))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  total_runs as (select count(*)::numeric as total from runs),
  filtered as (
    select s.domain, s.prompt_run_id
    from sources s
    join ws on s.workspace_id = ws.id
    join runs r on s.prompt_run_id = r.id
    where s.cited_by_llm = true and s.domain is not null
  ),
  agg as (select domain, count(distinct prompt_run_id)::bigint as citations_count from filtered group by domain)
  select a.domain, a.citations_count,
    case when (select total from total_runs) > 0
         then round((a.citations_count::numeric / (select total from total_runs)) * 100, 1) else 0 end
  from agg a order by a.citations_count desc, a.domain asc limit limit_n;
$function$;

-- ── Source rankings (página Sources) ─────────────────────────────────────────
create or replace function public.get_workspace_source_rankings(
  workspace_slug text,
  days integer default 30,
  llm_key text default null,
  p_country_filter text default null,
  limit_n integer default 100
)
returns table(domain text, citations_count bigint, urls_total integer, pct_of_runs numeric, example_prompt_text text, extra_prompt_count integer)
language sql stable security definer set search_path to 'public'
as $function$
  with ws as (select id from workspaces where slug = workspace_slug),
  win as (select * from public.metrics_window(days, p_country_filter)),
  runs as (
    select pr.id, p.text as prompt_text
    from prompt_runs pr
    join ws on pr.workspace_id = ws.id
    join prompts p on pr.prompt_id = p.id
    where pr.status = 'completed'
      and pr.completed_at >= (select cur_start from win)
      and pr.completed_at < (select cur_end from win)
      and (llm_key is null or pr.llm_provider_id = (select id from llm_providers where key = llm_key))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  total_runs as (select count(*)::numeric as total from runs),
  filtered as (
    select s.domain, s.url, s.prompt_run_id, r.prompt_text
    from sources s
    join ws on s.workspace_id = ws.id
    join runs r on s.prompt_run_id = r.id
    where s.cited_by_llm = true and s.domain is not null
  ),
  domain_agg as (
    select domain,
      count(distinct prompt_run_id)::bigint as citations_count,
      count(distinct url)::int as urls_total
    from filtered
    group by domain
  ),
  domain_prompts as (
    select domain, array_agg(distinct prompt_text) as prompt_texts
    from filtered
    where prompt_text is not null
    group by domain
  )
  select d.domain, d.citations_count, d.urls_total,
    case when (select total from total_runs) > 0
         then round((d.citations_count::numeric / (select total from total_runs)) * 100, 1) else 0 end,
    (dp.prompt_texts)[1],
    greatest(coalesce(array_length(dp.prompt_texts, 1), 0) - 1, 0)
  from domain_agg d
  left join domain_prompts dp on dp.domain = d.domain
  order by d.citations_count desc, d.domain asc
  limit limit_n;
$function$;

-- ── Source KPIs (fuente más influyente = respuestas que la citan) ───────────
create or replace function public.get_workspace_source_kpis(
  workspace_slug text,
  days integer default 30,
  llm_key text default null,
  p_country_filter text default null
)
returns jsonb
language sql stable security definer set search_path to 'public'
as $function$
  with ws as (select id from workspaces where slug = workspace_slug),
  win as (select * from public.metrics_window(days, p_country_filter)),
  runs as (
    select pr.id
    from prompt_runs pr
    join ws on pr.workspace_id = ws.id
    join prompts p on pr.prompt_id = p.id
    where pr.status = 'completed'
      and pr.completed_at >= (select cur_start from win)
      and pr.completed_at < (select cur_end from win)
      and (llm_key is null or pr.llm_provider_id = (select id from llm_providers where key = llm_key))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  cited as (
    select s.domain, s.url, s.prompt_run_id
    from sources s
    join ws on s.workspace_id = ws.id
    join runs r on s.prompt_run_id = r.id
    where s.cited_by_llm = true
  ),
  own_runs as (
    select distinct m.prompt_run_id
    from mentions m
    join ws on m.workspace_id = ws.id
    join runs r on m.prompt_run_id = r.id
    where m.brand_type = 'own'
  ),
  top_domain as (
    select domain, count(distinct prompt_run_id)::int as cnt
    from cited
    where domain is not null
    group by domain
    order by cnt desc, domain asc
    limit 1
  )
  select case when not exists (select 1 from ws) then null else jsonb_build_object(
    'brand_citing_urls',
      (select count(distinct c.url) from cited c join own_runs o on o.prompt_run_id = c.prompt_run_id),
    'most_influential_domain', (select domain from top_domain),
    'most_influential_count', coalesce((select cnt from top_domain), 0)
  ) end;
$function$;

-- ── Comparación por LLM (posición = mejor rankeada por respuesta) ───────────
create or replace function public.get_workspace_llm_comparison(
  workspace_slug text,
  days integer default 30,
  p_country_filter text default null
)
returns table(llm_key text, llm_name text, visibility_pct numeric, sov_pct numeric, avg_rank numeric, top_competitor_name text, top_competitor_sov numeric, avg_sentiment numeric, total_runs bigint)
language sql stable security definer set search_path to 'public'
as $function$
  with ws as (select id from workspaces where slug = workspace_slug),
  win as (select * from public.metrics_window(days, p_country_filter)),
  runs as (
    select pr.id, pr.llm_provider_id
    from prompt_runs pr
    join ws on pr.workspace_id = ws.id
    join prompts p on pr.prompt_id = p.id
    where pr.status = 'completed'
      and pr.completed_at >= (select cur_start from win)
      and pr.completed_at < (select cur_end from win)
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  window_mentions as (
    select r.llm_provider_id, r.id as run_id, m.brand_id, m.brand_type,
           m.position, m.position_source, m.sentiment, m.sentiment_score
    from mentions m
    join ws on m.workspace_id = ws.id
    join runs r on m.prompt_run_id = r.id
  ),
  runs_by_llm as (
    select llm_provider_id, count(*)::bigint as run_count from runs group by llm_provider_id
  ),
  own_by_llm as (
    select llm_provider_id,
           count(distinct run_id)::bigint as runs_with_brand,
           count(*) filter (where brand_id is not null)::bigint as own_mentions_total,
           avg(coalesce(sentiment_score,
                        case when sentiment = 'positive' then 1
                             when sentiment = 'negative' then -1 else 0 end))::numeric as avg_sent
    from window_mentions
    where brand_type = 'own'
    group by llm_provider_id
  ),
  best_rank_by_run as (
    select llm_provider_id, run_id, min(position) as best_position
    from window_mentions
    where brand_type = 'own'
      and position is not null
      and position_source in ('numbered_list', 'bullet_list', 'llm')
    group by llm_provider_id, run_id
  ),
  rank_by_llm as (
    select llm_provider_id, avg(best_position)::numeric as avg_pos
    from best_rank_by_run
    group by llm_provider_id
  ),
  comp_by_llm as (
    select llm_provider_id, count(*)::bigint as comp_mentions_total
    from window_mentions
    where brand_type = 'competitor' and brand_id is not null
    group by llm_provider_id
  ),
  top_competitor_per_llm as (
    select distinct on (llm_provider_id) llm_provider_id, brand_id, mentions_count
    from (
      select llm_provider_id, brand_id, count(*)::bigint as mentions_count
      from window_mentions
      where brand_type = 'competitor' and brand_id is not null
      group by llm_provider_id, brand_id
    ) sub
    order by llm_provider_id, mentions_count desc
  )
  select lp.key, lp.name,
    case when r.run_count > 0 and om.runs_with_brand is not null
         then round((om.runs_with_brand::numeric / r.run_count::numeric) * 100, 1) else 0 end,
    case when (coalesce(om.own_mentions_total, 0) + coalesce(cm.comp_mentions_total, 0)) > 0
         then round((coalesce(om.own_mentions_total, 0)::numeric /
                     (coalesce(om.own_mentions_total, 0) + coalesce(cm.comp_mentions_total, 0))::numeric) * 100, 1)
         else 0 end,
    case when rk.avg_pos is not null then round(rk.avg_pos, 1) else null end,
    tc_brand.name,
    case when tcl.mentions_count is not null
              and (coalesce(om.own_mentions_total, 0) + coalesce(cm.comp_mentions_total, 0)) > 0
         then round((tcl.mentions_count::numeric /
                     (coalesce(om.own_mentions_total, 0) + coalesce(cm.comp_mentions_total, 0))::numeric) * 100, 1)
         else 0 end,
    case when om.avg_sent is not null then round(om.avg_sent, 2) else null end,
    coalesce(r.run_count, 0)
  from llm_providers lp
  left join runs_by_llm r on lp.id = r.llm_provider_id
  left join own_by_llm om on lp.id = om.llm_provider_id
  left join rank_by_llm rk on lp.id = rk.llm_provider_id
  left join comp_by_llm cm on lp.id = cm.llm_provider_id
  left join top_competitor_per_llm tcl on lp.id = tcl.llm_provider_id
  left join brands tc_brand on tcl.brand_id = tc_brand.id
  where lp.enabled = true
  order by 3 desc nulls last;
$function$;

-- ── Prompts: posición por prompt solo con rankings reales ───────────────────
-- 3. La posición de la tabla de Prompts (y del MCP get_prompt_performance)
--    sale de la última respuesta completada de cada prompt × LLM, con la misma
--    regla que el resto de la app: mejor posición en un ranking real
--    (numbered_list / bullet_list / llm). Antes usaba daily_prompt_metrics,
--    que también contaba el orden de aparición en el texto.
create or replace function public.get_workspace_prompt_performance(
  p_workspace_slug text,
  p_llm_key text default null,
  p_country_filter text default null
)
returns table(prompt_id uuid, prompt_text text, prompt_status text, prompt_country text, prompt_intent text, prompt_funnel_stage text, prompt_persona text, includes_brand boolean, priority_score smallint, brand_mentioned boolean, brand_position integer, competitor_count integer, sov numeric, sentiment text, consistency_score numeric, last_run_at timestamp with time zone, rank bigint, per_llm jsonb)
language sql stable security definer set search_path to 'public'
as $function$
  with workspace as (
    select id, slug from workspaces where slug = p_workspace_slug
  ),
  latest_run_per_llm as (
    select distinct on (pr.prompt_id, pr.llm_provider_id)
      pr.id as run_id, pr.prompt_id, pr.llm_provider_id
    from prompt_runs pr
    join workspace w on w.id = pr.workspace_id
    where pr.status = 'completed'
    order by pr.prompt_id, pr.llm_provider_id, pr.completed_at desc
  ),
  ranked_position as (
    select lr.prompt_id, lr.llm_provider_id, min(m.position)::integer as position
    from latest_run_per_llm lr
    join mentions m on m.prompt_run_id = lr.run_id
    where m.brand_type = 'own'
      and m.position is not null
      and m.position_source in ('numbered_list', 'bullet_list', 'llm')
    group by lr.prompt_id, lr.llm_provider_id
  ),
  latest_metrics_per_llm as (
    select distinct on (dpm.prompt_id, dpm.llm_provider_id)
      dpm.prompt_id,
      dpm.llm_provider_id,
      lp.key as llm_key,
      lp.name as llm_name,
      dpm.brand_mentioned,
      rp.position as brand_position,
      dpm.competitor_count,
      dpm.sov,
      dpm.sentiment,
      dpm.consistency_score,
      dpm.date
    from daily_prompt_metrics dpm
    join llm_providers lp on lp.id = dpm.llm_provider_id
    join workspace w on w.id = dpm.workspace_id
    left join ranked_position rp
      on rp.prompt_id = dpm.prompt_id and rp.llm_provider_id = dpm.llm_provider_id
    where (p_llm_key is null or lp.key = p_llm_key)
    order by dpm.prompt_id, dpm.llm_provider_id, dpm.date desc
  ),
  cross_llm as (
    select
      prompt_id,
      bool_or(brand_mentioned) as brand_mentioned,
      round(avg(brand_position) filter (where brand_mentioned and brand_position is not null), 1)::integer as brand_position,
      round(avg(competitor_count), 0)::integer as competitor_count,
      round(max(sov), 1) as sov,
      mode() within group (order by sentiment) as sentiment,
      round(avg(consistency_score), 1) as consistency_score,
      jsonb_object_agg(
        llm_key,
        jsonb_build_object(
          'brand_mentioned', brand_mentioned,
          'brand_position', brand_position,
          'sov', sov,
          'sentiment', sentiment,
          'consistency_score', consistency_score
        )
      ) as per_llm
    from latest_metrics_per_llm
    group by prompt_id
  ),
  last_runs as (
    select distinct on (pr.prompt_id)
      pr.prompt_id, pr.completed_at
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
    p.id as prompt_id,
    p.text as prompt_text,
    p.status as prompt_status,
    p.country as prompt_country,
    p.intent as prompt_intent,
    p.funnel_stage as prompt_funnel_stage,
    p.persona as prompt_persona,
    coalesce(p.includes_brand, false) as includes_brand,
    p.priority_score,
    coalesce(cl.brand_mentioned, false) as brand_mentioned,
    cl.brand_position,
    coalesce(cl.competitor_count, 0) as competitor_count,
    cl.sov,
    coalesce(cl.sentiment, 'no_data') as sentiment,
    coalesce(cl.consistency_score, 0) as consistency_score,
    lr.completed_at as last_run_at,
    row_number() over (
      order by coalesce(cl.brand_mentioned, false) desc,
               cl.brand_position asc nulls last,
               coalesce(cl.sov, 0) desc
    ) as rank,
    coalesce(cl.per_llm, '{}'::jsonb) as per_llm
  from prompts p
  join workspace w on w.id = p.workspace_id
  left join cross_llm cl on cl.prompt_id = p.id
  left join last_runs lr on lr.prompt_id = p.id
  where (p_country_filter is null or p.country = p_country_filter)
  order by coalesce(cl.brand_mentioned, false) desc,
           cl.brand_position asc nulls last,
           coalesce(cl.sov, 0) desc;
$function$;
