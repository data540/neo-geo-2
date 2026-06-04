-- 0034: Caché persistente de recomendaciones GEO por workspace.
-- Las recomendaciones se guardan indefinidamente hasta que el usuario
-- pulse "Regenerar" (máximo 1 vez por día por workspace).

CREATE TABLE workspace_recommendations_cache (
  workspace_id    uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  recommendations jsonb NOT NULL DEFAULT '[]',
  chunks          jsonb NOT NULL DEFAULT '[]',
  generated_at    timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz
);

ALTER TABLE workspace_recommendations_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_select"
  ON workspace_recommendations_cache FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "service_role_all"
  ON workspace_recommendations_cache FOR ALL
  USING (true) WITH CHECK (true);
