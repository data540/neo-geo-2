-- 0029: Rediseño de la sección Sources.
-- Dos RPCs:
--   1. get_workspace_source_rankings → tabla principal (una fila por dominio único)
--   2. get_workspace_source_detail   → panel expandido (JSONB con brand presence,
--                                       top competitors, LLMs y cited URLs)
-- Sin cambios de schema — toda la información se deriva con JOINs sobre
-- sources, prompt_runs, prompts, mentions, brands y llm_providers.

-- ── 1. Source Rankings ────────────────────────────────────────────────────────
create or replace function get_workspace_source_rankings(
  workspace_slug text,
  days int default 30,
  llm_key text default null,
  p_country_filter text default null,
  limit_n int default 100
) returns table (
  domain text,
  citations_count bigint,
  urls_total int,
  pct_of_runs numeric,
  example_prompt_text text,
  extra_prompt_count int
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
    join prompts p on pr.prompt_id = p.id
    where pr.created_at >= now() - (days || ' days')::interval
      and pr.status = 'completed'
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  filtered as (
    select s.domain, s.url, s.prompt_run_id, p.text as prompt_text
    from sources s
    join ws on s.workspace_id = ws.id
    join prompt_runs pr on s.prompt_run_id = pr.id
    join prompts p on pr.prompt_id = p.id
    where pr.created_at >= now() - (days || ' days')::interval
      and s.cited_by_llm = true
      and s.domain is not null
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  domain_agg as (
    select
      domain,
      count(distinct prompt_run_id)::bigint as citations_count,
      count(distinct url)::int as urls_total
    from filtered
    group by domain
  ),
  domain_prompts as (
    select
      domain,
      array_agg(distinct prompt_text) as prompt_texts
    from filtered
    where prompt_text is not null
    group by domain
  )
  select
    d.domain,
    d.citations_count,
    d.urls_total,
    case
      when (select total from total_runs) > 0
      then round((d.citations_count::numeric / (select total from total_runs)) * 100, 1)
      else 0
    end as pct_of_runs,
    (dp.prompt_texts)[1] as example_prompt_text,
    greatest(coalesce(array_length(dp.prompt_texts, 1), 0) - 1, 0) as extra_prompt_count
  from domain_agg d
  left join domain_prompts dp on dp.domain = d.domain
  order by d.citations_count desc, d.domain asc
  limit limit_n;
$$;

grant execute on function get_workspace_source_rankings(text, int, text, text, int) to authenticated, service_role;

-- ── 2. Source Detail ──────────────────────────────────────────────────────────
create or replace function get_workspace_source_detail(
  workspace_slug text,
  p_domain text,
  days int default 30,
  llm_key text default null,
  p_country_filter text default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ws as (
    select id from workspaces where slug = workspace_slug
  ),
  -- Todas las sources del dominio en el período (con filtros)
  domain_sources as (
    select s.id, s.url, s.title, s.prompt_run_id, pr.llm_provider_id
    from sources s
    join ws on s.workspace_id = ws.id
    join prompt_runs pr on s.prompt_run_id = pr.id
    join prompts p on pr.prompt_id = p.id
    where s.domain = p_domain
      and s.cited_by_llm = true
      and pr.created_at >= now() - (days || ' days')::interval
      and (llm_key is null or pr.llm_provider_id = (
        select id from llm_providers where key = llm_key
      ))
      and (p_country_filter is null or p.country = p_country_filter)
  ),
  -- Brand Presence: URLs únicas del dominio cuya respuesta LLM mencionó la propia marca
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
  -- Top competitors mencionados en los mismos runs que el dominio
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
  -- LLMs que citaron el dominio
  cited_by_llms as (
    select distinct lp.key, lp.name
    from domain_sources ds
    join llm_providers lp on lp.id = ds.llm_provider_id
  ),
  -- Por cada URL única del dominio: agregados sobre los runs donde apareció
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
      -- Mentions totales (own + competitor) en los runs donde apareció esta URL
      coalesce((
        select count(*)::int from mentions m
        where m.prompt_run_id = any(ua.run_ids)
      ), 0) as mention_count,
      -- ¿Apareció la own brand en alguno de esos runs?
      exists(
        select 1 from mentions m
        where m.prompt_run_id = any(ua.run_ids)
          and m.brand_type = 'own'
      ) as own_brand_present,
      -- Distinct competitors en esos runs
      coalesce((
        select count(distinct m.brand_id)::int from mentions m
        where m.prompt_run_id = any(ua.run_ids)
          and m.brand_type = 'competitor'
      ), 0) as competitor_count,
      -- LLM keys que citaron esta URL específica
      coalesce((
        select array_agg(distinct lp.key)
        from llm_providers lp
        where lp.id = any(ua.llm_ids)
      ), array[]::text[]) as llm_keys,
      -- Prompts donde se usó esta URL
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
$$;

grant execute on function get_workspace_source_detail(text, text, int, text, text) to authenticated, service_role;
