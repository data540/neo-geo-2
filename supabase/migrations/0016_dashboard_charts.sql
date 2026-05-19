-- ─────────────────────────────────────────────────────────────────────────────
-- 0016: Dashboard avanzado — mention_type + 5 RPCs nuevas
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enum y columna nueva en mentions
do $$
begin
  if not exists (select 1 from pg_type where typname = 'mention_type') then
    create type mention_type as enum (
      'primary_recommendation',
      'list_option',
      'comparison',
      'general_mention',
      'warning'
    );
  end if;
end$$;

alter table mentions add column if not exists mention_type mention_type;

create index if not exists mentions_mention_type_idx
  on mentions(workspace_id, mention_type);

create index if not exists mentions_workspace_created_idx
  on mentions(workspace_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: Market Share — SOV normalizado entre la marca y competidores
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function get_workspace_market_share(
  workspace_slug text,
  days int default 30,
  llm_key text default null
) returns table (
  brand_id uuid,
  brand_name text,
  brand_domain text,
  brand_type text,
  mentions_count bigint,
  share_pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with ws as (
    select id from workspaces where slug = workspace_slug
  ),
  filtered as (
    select m.brand_id, m.brand_type
    from mentions m
    join ws on m.workspace_id = ws.id
    join prompt_runs pr on m.prompt_run_id = pr.id
    where pr.created_at >= now() - (days || ' days')::interval
      and m.brand_id is not null
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
  ),
  agg as (
    select brand_id, brand_type, count(*)::bigint as mentions_count
    from filtered
    group by brand_id, brand_type
  ),
  total as (select coalesce(sum(mentions_count), 0)::numeric as total from agg)
  select
    b.id as brand_id,
    b.name as brand_name,
    b.domain as brand_domain,
    a.brand_type::text,
    a.mentions_count,
    case
      when (select total from total) > 0
      then round((a.mentions_count::numeric / (select total from total)) * 100, 1)
      else 0
    end as share_pct
  from agg a
  join brands b on a.brand_id = b.id
  order by a.mentions_count desc;
$$;

grant execute on function get_workspace_market_share(text, int, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: Mention Breakdown — distribución por mention_type (sobre own brand)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function get_workspace_mention_breakdown(
  workspace_slug text,
  days int default 30,
  llm_key text default null
) returns table (
  mention_type text,
  count bigint,
  pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with ws as (
    select id from workspaces where slug = workspace_slug
  ),
  filtered as (
    select coalesce(m.mention_type::text, 'general_mention') as mtype
    from mentions m
    join ws on m.workspace_id = ws.id
    join prompt_runs pr on m.prompt_run_id = pr.id
    where pr.created_at >= now() - (days || ' days')::interval
      and m.brand_type = 'own'
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
  ),
  agg as (
    select mtype, count(*)::bigint as count
    from filtered
    group by mtype
  ),
  total as (select coalesce(sum(count), 0)::numeric as total from agg)
  select
    a.mtype as mention_type,
    a.count,
    case
      when (select total from total) > 0
      then round((a.count::numeric / (select total from total)) * 100, 1)
      else 0
    end as pct
  from agg a
  order by a.count desc;
$$;

grant execute on function get_workspace_mention_breakdown(text, int, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: Top Competitors — ranking por menciones con tendencia vs período anterior
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function get_workspace_top_competitors(
  workspace_slug text,
  days int default 30,
  limit_n int default 5,
  llm_key text default null
) returns table (
  competitor_id uuid,
  competitor_name text,
  competitor_domain text,
  mentions_count bigint,
  share_pct numeric,
  trend_pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with ws as (
    select id from workspaces where slug = workspace_slug
  ),
  curr_period as (
    select m.brand_id, count(*)::bigint as cnt
    from mentions m
    join ws on m.workspace_id = ws.id
    join prompt_runs pr on m.prompt_run_id = pr.id
    where pr.created_at >= now() - (days || ' days')::interval
      and m.brand_type = 'competitor'
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
    group by m.brand_id
  ),
  prev_period as (
    select m.brand_id, count(*)::bigint as cnt
    from mentions m
    join ws on m.workspace_id = ws.id
    join prompt_runs pr on m.prompt_run_id = pr.id
    where pr.created_at >= now() - ((days * 2) || ' days')::interval
      and pr.created_at < now() - (days || ' days')::interval
      and m.brand_type = 'competitor'
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
    group by m.brand_id
  ),
  total as (select coalesce(sum(cnt), 0)::numeric as total from curr_period)
  select
    b.id as competitor_id,
    b.name as competitor_name,
    b.domain as competitor_domain,
    c.cnt as mentions_count,
    case
      when (select total from total) > 0
      then round((c.cnt::numeric / (select total from total)) * 100, 1)
      else 0
    end as share_pct,
    case
      when p.cnt is null or p.cnt = 0 then null
      else round(((c.cnt::numeric - p.cnt::numeric) / p.cnt::numeric) * 100, 1)
    end as trend_pct
  from curr_period c
  join brands b on c.brand_id = b.id
  left join prev_period p on c.brand_id = p.brand_id
  order by c.cnt desc
  limit limit_n;
$$;

grant execute on function get_workspace_top_competitors(text, int, int, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: Top Sources — dominios que más aparecen en respuestas con citaciones
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function get_workspace_top_sources(
  workspace_slug text,
  days int default 30,
  limit_n int default 5,
  llm_key text default null
) returns table (
  domain text,
  citations_count bigint,
  pct_of_runs numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with ws as (
    select id from workspaces where slug = workspace_slug
  ),
  total_runs as (
    select count(*)::numeric as total
    from prompt_runs pr
    join ws on pr.workspace_id = ws.id
    where pr.created_at >= now() - (days || ' days')::interval
      and pr.status = 'completed'
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
  ),
  filtered as (
    select s.domain, s.prompt_run_id
    from sources s
    join ws on s.workspace_id = ws.id
    join prompt_runs pr on s.prompt_run_id = pr.id
    where pr.created_at >= now() - (days || ' days')::interval
      and s.cited_by_llm = true
      and s.domain is not null
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
  ),
  agg as (
    select domain, count(distinct prompt_run_id)::bigint as citations_count
    from filtered
    group by domain
  )
  select
    a.domain,
    a.citations_count,
    case
      when (select total from total_runs) > 0
      then round((a.citations_count::numeric / (select total from total_runs)) * 100, 1)
      else 0
    end as pct_of_runs
  from agg a
  order by a.citations_count desc
  limit limit_n;
$$;

grant execute on function get_workspace_top_sources(text, int, int, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: LLM Comparison — matriz por proveedor con visibility, sov, rank, sentiment
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function get_workspace_llm_comparison(
  workspace_slug text,
  days int default 30
) returns table (
  llm_key text,
  llm_name text,
  visibility_pct numeric,
  sov_pct numeric,
  avg_rank numeric,
  top_competitor_name text,
  top_competitor_sov numeric,
  avg_sentiment numeric,
  total_runs bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ws as (
    select id from workspaces where slug = workspace_slug
  ),
  runs_by_llm as (
    select pr.llm_provider_id, count(*)::bigint as run_count
    from prompt_runs pr
    join ws on pr.workspace_id = ws.id
    where pr.created_at >= now() - (days || ' days')::interval
      and pr.status = 'completed'
    group by pr.llm_provider_id
  ),
  own_mentions_by_llm as (
    select pr.llm_provider_id,
           count(distinct pr.id)::bigint as runs_with_brand,
           count(*)::bigint as own_mentions_total,
           avg(m.position)::numeric as avg_pos,
           avg(case
             when m.sentiment = 'positive' then 1
             when m.sentiment = 'negative' then -1
             else 0
           end)::numeric as avg_sent
    from mentions m
    join ws on m.workspace_id = ws.id
    join prompt_runs pr on m.prompt_run_id = pr.id
    where pr.created_at >= now() - (days || ' days')::interval
      and m.brand_type = 'own'
    group by pr.llm_provider_id
  ),
  comp_mentions_by_llm as (
    select pr.llm_provider_id, count(*)::bigint as comp_mentions_total
    from mentions m
    join ws on m.workspace_id = ws.id
    join prompt_runs pr on m.prompt_run_id = pr.id
    where pr.created_at >= now() - (days || ' days')::interval
      and m.brand_type = 'competitor'
    group by pr.llm_provider_id
  ),
  top_competitor_per_llm as (
    select distinct on (llm_provider_id)
           llm_provider_id, brand_id, mentions_count
    from (
      select pr.llm_provider_id, m.brand_id, count(*)::bigint as mentions_count
      from mentions m
      join ws on m.workspace_id = ws.id
      join prompt_runs pr on m.prompt_run_id = pr.id
      where pr.created_at >= now() - (days || ' days')::interval
        and m.brand_type = 'competitor'
      group by pr.llm_provider_id, m.brand_id
    ) sub
    order by llm_provider_id, mentions_count desc
  )
  select
    lp.key as llm_key,
    lp.name as llm_name,
    case
      when r.run_count > 0 and om.runs_with_brand is not null
      then round((om.runs_with_brand::numeric / r.run_count::numeric) * 100, 1)
      else 0
    end as visibility_pct,
    case
      when (coalesce(om.own_mentions_total, 0) + coalesce(cm.comp_mentions_total, 0)) > 0
      then round(
        (coalesce(om.own_mentions_total, 0)::numeric /
         (coalesce(om.own_mentions_total, 0) + coalesce(cm.comp_mentions_total, 0))::numeric) * 100,
        1
      )
      else 0
    end as sov_pct,
    case
      when om.avg_pos is not null then round(om.avg_pos, 1)
      else null
    end as avg_rank,
    tc_brand.name as top_competitor_name,
    case
      when tcl.mentions_count is not null and cm.comp_mentions_total > 0
      then round((tcl.mentions_count::numeric / cm.comp_mentions_total::numeric) * 100, 1)
      else 0
    end as top_competitor_sov,
    case
      when om.avg_sent is not null then round(om.avg_sent, 2)
      else null
    end as avg_sentiment,
    coalesce(r.run_count, 0) as total_runs
  from llm_providers lp
  left join runs_by_llm r on lp.id = r.llm_provider_id
  left join own_mentions_by_llm om on lp.id = om.llm_provider_id
  left join comp_mentions_by_llm cm on lp.id = cm.llm_provider_id
  left join top_competitor_per_llm tcl on lp.id = tcl.llm_provider_id
  left join brands tc_brand on tcl.brand_id = tc_brand.id
  where lp.enabled = true
  order by visibility_pct desc nulls last;
$$;

grant execute on function get_workspace_llm_comparison(text, int) to authenticated, service_role;
