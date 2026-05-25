-- =============================================================================
-- 0021: RPC get_prompt_detail — devuelve competidores, fuentes y raw responses
-- agregados de la última ejecución (latest run) por LLM para un prompt concreto.
-- Usado por la expansión inline "Details below" en /[workspace]/prompts.
-- =============================================================================

create or replace function get_prompt_detail(p_prompt_id uuid)
returns table (
  competitors jsonb,
  sources     jsonb,
  runs        jsonb
)
language plpgsql security definer stable as $$
declare
  v_workspace_id uuid;
begin
  -- Resolver workspace del prompt y verificar membresía
  select workspace_id into v_workspace_id from prompts where id = p_prompt_id;

  if v_workspace_id is null or not is_workspace_member(v_workspace_id) then
    return query select '[]'::jsonb, '[]'::jsonb, '[]'::jsonb;
    return;
  end if;

  return query
  with latest_runs as (
    select distinct on (pr.llm_provider_id)
      pr.id,
      pr.llm_provider_id,
      pr.model,
      pr.completed_at,
      pr.raw_response,
      lp.key  as llm_key,
      lp.name as llm_name
    from prompt_runs pr
    join llm_providers lp on lp.id = pr.llm_provider_id
    where pr.prompt_id = p_prompt_id
      and pr.status = 'completed'
    order by pr.llm_provider_id, pr.completed_at desc nulls last
  ),
  competitors_agg as (
    select
      m.brand_name_detected as name,
      count(distinct lr.llm_provider_id)::int as llm_count
    from mentions m
    join latest_runs lr on lr.id = m.prompt_run_id
    where m.brand_type = 'competitor'
      and m.brand_name_detected is not null
      and trim(m.brand_name_detected) <> ''
    group by m.brand_name_detected
    order by count(distinct lr.llm_provider_id) desc, m.brand_name_detected asc
  ),
  sources_agg as (
    select
      s.domain,
      (array_agg(s.url order by s.created_at desc))[1] as url,
      count(*)::int as count
    from sources s
    join latest_runs lr on lr.id = s.prompt_run_id
    where s.domain is not null and trim(s.domain) <> ''
    group by s.domain
    order by count(*) desc, s.domain asc
  ),
  runs_out as (
    select
      lr.llm_key,
      lr.llm_name as llm_label,
      lr.model,
      lr.completed_at,
      coalesce(lr.raw_response, '') as raw_response
    from latest_runs lr
    order by lr.llm_key
  )
  select
    coalesce((select jsonb_agg(to_jsonb(c)) from competitors_agg c), '[]'::jsonb) as competitors,
    coalesce((select jsonb_agg(to_jsonb(s)) from sources_agg s), '[]'::jsonb)     as sources,
    coalesce((select jsonb_agg(to_jsonb(r)) from runs_out r), '[]'::jsonb)        as runs;
end;
$$;

grant execute on function get_prompt_detail(uuid) to authenticated;
