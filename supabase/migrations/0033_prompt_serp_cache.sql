-- 0033: Caché de datos SERP de Google para prompts con AI Overview (gemini).
-- Un snapshot por prompt por semana, independiente de cuántas veces se ejecute.
-- Esto minimiza las llamadas a SerpAPI (~1/prompt/semana vs 1/ejecución).

CREATE TABLE IF NOT EXISTS prompt_serp_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt_id       uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  -- Resultado de la búsqueda en Google
  ai_overview_present       boolean NOT NULL DEFAULT false,
  ai_overview_serp_position integer,        -- null si no hubo AI Overview
  ai_overview_sections      jsonb NOT NULL DEFAULT '[]'::jsonb
  -- Estructura: [{"name": "Consejos clave", "position": 1}, ...]
);

-- Índice para buscar el snapshot más reciente de un prompt
CREATE INDEX IF NOT EXISTS prompt_serp_cache_prompt_fetched
  ON prompt_serp_cache (prompt_id, fetched_at DESC);

-- Índice para listar todos los snapshots recientes de un workspace
CREATE INDEX IF NOT EXISTS prompt_serp_cache_workspace_fetched
  ON prompt_serp_cache (workspace_id, fetched_at DESC);

-- RLS: mismas reglas que las demás tablas del workspace
ALTER TABLE prompt_serp_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_select"
  ON prompt_serp_cache FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "service_role_all"
  ON prompt_serp_cache FOR ALL
  USING (true)
  WITH CHECK (true);
