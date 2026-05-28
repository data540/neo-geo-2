-- ============================================================
-- 0025_position_source.sql
-- Añade columna position_source a mentions para trazabilidad
-- del método de extracción de ranking, y limpia el centinela 99
-- ============================================================

ALTER TABLE mentions
  ADD COLUMN IF NOT EXISTS position_source TEXT
    CHECK (
      position_source IS NULL OR
      position_source IN (
        'numbered_list',
        'bullet_list',
        'appearance_order',
        'llm',
        'manual'
      )
    );

CREATE INDEX IF NOT EXISTS mentions_position_source_idx
  ON mentions(workspace_id, position_source)
  WHERE position IS NOT NULL;

-- Backfill: marcar posiciones existentes como heurística de aparición textual
UPDATE mentions
  SET position_source = 'appearance_order'
  WHERE position IS NOT NULL
    AND position <> 99
    AND position_source IS NULL;

-- Limpiar centinela 99 (ruido del extractor antiguo)
UPDATE mentions
  SET position = NULL
  WHERE position = 99;
