-- Migration 0040: índices de rendimiento para RPCs del dashboard
-- Problema: las 5 RPCs filtran por prompt_runs.created_at pero no existía índice
-- en esa columna (sí existía en completed_at, columna distinta). Esto provocaba
-- seq scan en frío con tiempos de 600-800ms por RPC.

-- Índice crítico: todas las RPCs del dashboard filtran pr.created_at >= now() - N days
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_runs_created_at
  ON prompt_runs(created_at DESC);

-- Índice para el JOIN mentions → prompt_runs filtrado por workspace
-- Permite resolver workspace_id + prompt_run_id en un único index scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mentions_workspace_run
  ON mentions(workspace_id, prompt_run_id);

-- Índice parcial para top_competitors (hace 2 scans filtrando brand_type='competitor')
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mentions_workspace_competitor
  ON mentions(workspace_id, prompt_run_id)
  WHERE brand_type = 'competitor';
