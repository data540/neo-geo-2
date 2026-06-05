-- 0035: Integración con Google Search Console (GSC) y GA4.
-- Config por workspace (site URL de GSC + property ID de GA4) y tablas de caché
-- pobladas por el CRON refreshGoogleAnalytics (1 lectura/día por workspace).

-- a) Config por workspace
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS gsc_site_url    text,
  ADD COLUMN IF NOT EXISTS ga4_property_id text;

-- b) Caché de Search Console: una fila por (workspace, día, query)
CREATE TABLE IF NOT EXISTS workspace_gsc_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_date    date NOT NULL,
  query        text NOT NULL,
  clicks       integer NOT NULL DEFAULT 0,
  impressions  integer NOT NULL DEFAULT 0,
  ctr          numeric  NOT NULL DEFAULT 0,
  position     numeric,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, data_date, query)
);

CREATE INDEX IF NOT EXISTS workspace_gsc_cache_ws_date
  ON workspace_gsc_cache (workspace_id, data_date DESC);

-- c) Caché de GA4 por LLM: una fila por (workspace, día, llm)
CREATE TABLE IF NOT EXISTS workspace_ga4_llm_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_date     date NOT NULL,
  llm_key       text NOT NULL,
  conversions   numeric NOT NULL DEFAULT 0,
  sessions      integer NOT NULL DEFAULT 0,
  total_users   integer NOT NULL DEFAULT 0,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, data_date, llm_key)
);

CREATE INDEX IF NOT EXISTS workspace_ga4_llm_cache_ws_date
  ON workspace_ga4_llm_cache (workspace_id, data_date DESC);

-- RLS: mismo patrón que prompt_serp_cache
ALTER TABLE workspace_gsc_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_ga4_llm_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_select"
  ON workspace_gsc_cache FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "service_role_all"
  ON workspace_gsc_cache FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "workspace_member_select"
  ON workspace_ga4_llm_cache FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "service_role_all"
  ON workspace_ga4_llm_cache FOR ALL
  USING (true) WITH CHECK (true);
