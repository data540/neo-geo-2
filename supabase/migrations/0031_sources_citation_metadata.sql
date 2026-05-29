-- 0031: Metadata adicional en sources para almacenar citaciones estructuradas
-- (provenientes de message.annotations[] de OpenRouter, citations[] legacy, etc.)
-- Habilita que Perplexity y otros LLMs con web search guarden las URLs reales,
-- no solo las que aparecen en texto plano.

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS citation_index int,
  ADD COLUMN IF NOT EXISTS quote_text text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'inline'
    CHECK (source_type IN ('inline','annotation','citation_legacy','web_plugin'));

CREATE INDEX IF NOT EXISTS idx_sources_workspace_created
  ON sources(workspace_id, created_at DESC);

UPDATE sources SET source_type = 'inline' WHERE source_type IS NULL;
