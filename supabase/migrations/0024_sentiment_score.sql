-- =============================================================================
-- 0024: Sentiment score numérico continuo (-1.0 a +1.0) + metadata
-- =============================================================================
-- Añade columnas sentiment_score, sentiment_confidence y sentiment_source a
-- mentions para permitir análisis de sentimiento basado en LLM. Conserva el
-- enum sentiment original para retrocompatibilidad con queries antiguas.

ALTER TABLE mentions
  ADD COLUMN IF NOT EXISTS sentiment_score numeric(3,2)
    CHECK (sentiment_score IS NULL OR (sentiment_score >= -1.0 AND sentiment_score <= 1.0)),
  ADD COLUMN IF NOT EXISTS sentiment_confidence numeric(3,2)
    CHECK (sentiment_confidence IS NULL OR (sentiment_confidence >= 0.0 AND sentiment_confidence <= 1.0)),
  ADD COLUMN IF NOT EXISTS sentiment_source text
    CHECK (sentiment_source IS NULL OR sentiment_source IN ('heuristic', 'llm', 'manual'));

CREATE INDEX IF NOT EXISTS mentions_sentiment_score_idx
  ON mentions(workspace_id, sentiment_score)
  WHERE sentiment_score IS NOT NULL;

-- Backfill desde el enum existente (conversión aproximada)
UPDATE mentions
SET
  sentiment_score = CASE sentiment
    WHEN 'positive' THEN 0.7
    WHEN 'negative' THEN -0.7
    WHEN 'neutral'  THEN 0.0
    ELSE NULL
  END,
  sentiment_confidence = 0.5,
  sentiment_source = 'heuristic'
WHERE sentiment IS NOT NULL
  AND sentiment <> 'no_data'
  AND sentiment_score IS NULL;
