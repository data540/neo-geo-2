-- RPC: get_workspace_source_kpis
-- Returns brand-citing URLs count and most influential source for the Sources KPI cards

CREATE OR REPLACE FUNCTION get_workspace_source_kpis(
  workspace_slug text,
  days int DEFAULT 30,
  llm_key text DEFAULT NULL,
  p_country_filter text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id uuid;
  v_since timestamptz;
  v_llm_id uuid;
  v_brand_citing_urls int;
  v_most_influential_domain text;
  v_most_influential_count int;
BEGIN
  SELECT id INTO v_workspace_id FROM workspaces WHERE slug = workspace_slug;
  IF v_workspace_id IS NULL THEN RETURN NULL; END IF;

  v_since := now() - (days || ' days')::interval;

  IF llm_key IS NOT NULL THEN
    SELECT id INTO v_llm_id FROM llm_providers WHERE key = llm_key;
  END IF;

  -- Brand-Citing URLs: distinct URLs where own brand appears
  SELECT COUNT(DISTINCT s.url)
  INTO v_brand_citing_urls
  FROM sources s
  JOIN mentions m ON m.prompt_run_id = s.prompt_run_id
  WHERE s.workspace_id = v_workspace_id
    AND s.cited_by_llm = true
    AND s.created_at >= v_since
    AND m.workspace_id = v_workspace_id
    AND m.brand_type = 'own'
    AND (v_llm_id IS NULL OR s.prompt_run_id IN (
      SELECT id FROM prompt_runs WHERE llm_provider_id = v_llm_id
    ))
    AND (p_country_filter IS NULL OR s.prompt_run_id IN (
      SELECT pr.id FROM prompt_runs pr
      JOIN prompts p ON p.id = pr.prompt_id
      WHERE p.country = p_country_filter
    ));

  -- Most influential source (highest citation count)
  SELECT s.domain, COUNT(*) AS cnt
  INTO v_most_influential_domain, v_most_influential_count
  FROM sources s
  WHERE s.workspace_id = v_workspace_id
    AND s.cited_by_llm = true
    AND s.created_at >= v_since
    AND (v_llm_id IS NULL OR s.prompt_run_id IN (
      SELECT id FROM prompt_runs WHERE llm_provider_id = v_llm_id
    ))
    AND (p_country_filter IS NULL OR s.prompt_run_id IN (
      SELECT pr.id FROM prompt_runs pr
      JOIN prompts p ON p.id = pr.prompt_id
      WHERE p.country = p_country_filter
    ))
  GROUP BY s.domain
  ORDER BY cnt DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'brand_citing_urls', COALESCE(v_brand_citing_urls, 0),
    'most_influential_domain', v_most_influential_domain,
    'most_influential_count', COALESCE(v_most_influential_count, 0)
  );
END;
$$;
