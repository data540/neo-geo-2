-- 0048_sources_window_and_counts.sql
--
-- 1. get_workspace_source_detail usa la misma ventana de días naturales que el
--    ranking (metrics_window) y solo respuestas completadas. Antes usaba las
--    últimas N×24 h por created_at: el detalle de mapfre.es daba 65 URLs frente
--    a las 66 del ranking.
-- 2. get_workspace_source_kpis devuelve también los contadores del periodo
--    completo (citas, dominios, URLs, prompts y LLMs). Antes la página los
--    calculaba con las 1.000 filas más recientes (224 dominios frente a 722).

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
    select pr.id, pr.prompt_id, pr.llm_provider_id
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
    select s.domain, s.url, s.prompt_run_id, r.prompt_id, r.llm_provider_id
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
    'most_influential_count', coalesce((select cnt from top_domain), 0),
    'citations_count', (select count(*) from cited),
    'domains_count', (select count(distinct domain) from cited where domain is not null),
    'urls_count', (select count(distinct url) from cited where url is not null),
    'prompts_count', (select count(distinct prompt_id) from cited),
    'llms_count', (select count(distinct llm_provider_id) from cited)
  ) end;
$function$;

create or replace function public.get_workspace_source_detail(
  workspace_slug text,
  p_domain text,
  days integer default 30,
  llm_key text default null,
  p_country_filter text default null
)
returns jsonb
language sql stable security definer set search_path to 'public'
as $function$
  with ws as (
    select id from workspaces where slug = workspace_slug
  ),
  win as (select * from public.metrics_window(days, p_country_filter)),
  domain_sources as (
    select s.id, s.url, s.title, s.prompt_run_id, pr.llm_provider_id
    from sources s
    join ws on s.workspace_id = ws.id
    join prompt_runs pr on s.prompt_run_id = pr.id
    join prompts p on pr.prompt_id = p.id
    where s.domain = p_domain
      and s.cited_by_llm = true
      and pr.status = 'completed'
      and pr.completed_at >= (select cur_start from win)
      and pr.completed_at < (select cur_end from win)
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  brand_presence as (
    select
      count(distinct url) filter (
        where exists (
          select 1 from mentions m
          where m.prompt_run_id = ds.prompt_run_id
            and m.brand_type = 'own'
        )
      )::int as urls_with_own_brand,
      count(distinct url)::int as total_urls
    from domain_sources ds
  ),
  top_competitors as (
    select b.id, b.name, count(*)::int as count
    from domain_sources ds
    join mentions m on m.prompt_run_id = ds.prompt_run_id
    join brands b on b.id = m.brand_id
    where m.brand_type = 'competitor'
    group by b.id, b.name
    order by count(*) desc
    limit 10
  ),
  cited_by_llms as (
    select distinct lp.key, lp.name
    from domain_sources ds
    join llm_providers lp on lp.id = ds.llm_provider_id
  ),
  url_agg as (
    select
      ds.url,
      (array_agg(distinct ds.title) filter (where ds.title is not null))[1] as title,
      array_agg(distinct ds.prompt_run_id) as run_ids,
      array_agg(distinct ds.llm_provider_id) as llm_ids
    from domain_sources ds
    group by ds.url
  ),
  url_metrics as (
    select
      ua.url,
      ua.title,
      coalesce((
        select count(*)::int from mentions m
        where m.prompt_run_id = any(ua.run_ids)
      ), 0) as mention_count,
      exists(
        select 1 from mentions m
        where m.prompt_run_id = any(ua.run_ids)
          and m.brand_type = 'own'
      ) as own_brand_present,
      coalesce((
        select count(distinct m.brand_id)::int from mentions m
        where m.prompt_run_id = any(ua.run_ids)
          and m.brand_type = 'competitor'
      ), 0) as competitor_count,
      coalesce((
        select array_agg(distinct lp.key)
        from llm_providers lp
        where lp.id = any(ua.llm_ids)
      ), array[]::text[]) as llm_keys,
      coalesce((
        select array_agg(distinct p.text)
        from prompt_runs pr
        join prompts p on p.id = pr.prompt_id
        where pr.id = any(ua.run_ids)
      ), array[]::text[]) as used_in_prompts
    from url_agg ua
  )
  select jsonb_build_object(
    'brand_presence', (
      select jsonb_build_object(
        'urls_with_own_brand', urls_with_own_brand,
        'total_urls', total_urls,
        'pct', case
          when total_urls > 0
          then round((urls_with_own_brand::numeric / total_urls::numeric) * 100, 1)
          else 0
        end
      ) from brand_presence
    ),
    'top_competitors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand_id', id,
        'name', name,
        'count', count
      ) order by count desc)
      from top_competitors
    ), '[]'::jsonb),
    'cited_by_llms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', key,
        'name', name
      ) order by name)
      from cited_by_llms
    ), '[]'::jsonb),
    'cited_urls', coalesce((
      select jsonb_agg(jsonb_build_object(
        'url', url,
        'title', title,
        'mention_count', mention_count,
        'own_brand_present', own_brand_present,
        'competitor_count', competitor_count,
        'llm_keys', to_jsonb(llm_keys),
        'used_in_prompts', to_jsonb(used_in_prompts)
      ) order by mention_count desc, url asc)
      from url_metrics
    ), '[]'::jsonb)
  );
$function$;
