-- 0049_dashboard_product_filter.sql
--
-- Filtro por producto en el Dashboard. Las 5 RPC del Dashboard aceptan
-- p_prompt_pattern: una expresión regular (sin distinguir mayúsculas) que debe
-- cumplir el texto del prompt. NULL = todos los prompts (comportamiento previo).
-- El patrón lo fija el servidor desde src/lib/workspace-products.ts; nunca
-- viene directamente de la URL.
--
-- Se borran las firmas anteriores para que PostgREST no tenga sobrecargas
-- ambiguas al llamar con argumentos con nombre.

drop function if exists public.get_workspace_market_share(text, integer, text, text);
drop function if exists public.get_workspace_mention_breakdown(text, integer, text, text);
drop function if exists public.get_workspace_top_competitors(text, integer, integer, text, text);
drop function if exists public.get_workspace_top_sources(text, integer, integer, text, text);
drop function if exists public.get_workspace_llm_comparison(text, integer, text);

create function public.get_workspace_market_share(
  workspace_slug text,
  days integer default 30,
  llm_key text default null,
  p_country_filter text default null,
  p_prompt_pattern text default null
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
      and (p_prompt_pattern is null or p.text ~* p_prompt_pattern)
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

create function public.get_workspace_mention_breakdown(
  workspace_slug text,
  days integer default 30,
  llm_key text default null,
  p_country_filter text default null,
  p_prompt_pattern text default null
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
      and (p_prompt_pattern is null or p.text ~* p_prompt_pattern)
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

create function public.get_workspace_top_competitors(
  workspace_slug text,
  days integer default 30,
  limit_n integer default 5,
  llm_key text default null,
  p_country_filter text default null,
  p_prompt_pattern text default null
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
      and (p_prompt_pattern is null or p.text ~* p_prompt_pattern)
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

create function public.get_workspace_top_sources(
  workspace_slug text,
  days integer default 30,
  limit_n integer default 5,
  llm_key text default null,
  p_country_filter text default null,
  p_prompt_pattern text default null
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
      and (p_prompt_pattern is null or p.text ~* p_prompt_pattern)
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

create function public.get_workspace_llm_comparison(
  workspace_slug text,
  days integer default 30,
  p_country_filter text default null,
  p_prompt_pattern text default null
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
      and (p_prompt_pattern is null or p.text ~* p_prompt_pattern)
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

grant execute on function public.get_workspace_market_share(text, integer, text, text, text) to anon, authenticated, service_role;
grant execute on function public.get_workspace_mention_breakdown(text, integer, text, text, text) to anon, authenticated, service_role;
grant execute on function public.get_workspace_top_competitors(text, integer, integer, text, text, text) to anon, authenticated, service_role;
grant execute on function public.get_workspace_top_sources(text, integer, integer, text, text, text) to anon, authenticated, service_role;
grant execute on function public.get_workspace_llm_comparison(text, integer, text, text) to anon, authenticated, service_role;
