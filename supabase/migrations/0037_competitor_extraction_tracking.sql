-- Tracking de extracción de competidores por run + tabla de rechazos
-- Resuelve tres fallos: re-procesado diario del historial, re-inserción de
-- falsos positivos eliminados, y ausencia de validación LLM en tiempo real.

-- Columna para marcar qué prompt_runs ya tuvieron su extracción de competidores.
-- El CRON solo procesa runs donde este campo es NULL.
ALTER TABLE public.prompt_runs
  ADD COLUMN IF NOT EXISTS competitors_extracted_at TIMESTAMPTZ;

-- Backfill: marcar todos los runs existentes como ya procesados.
-- Los competidores legítimos ya están en brands; esto evita que el CRON
-- re-analice historial y genere falsos positivos desde respuestas antiguas.
UPDATE public.prompt_runs
SET competitors_extracted_at = NOW()
WHERE status = 'completed' AND raw_response IS NOT NULL;

-- Tabla blocklist: registra nombres normalizados que el usuario eliminó como falsos positivos.
-- Impide que el CRON o la extracción en tiempo real los vuelva a insertar.
CREATE TABLE IF NOT EXISTS public.competitor_rejections (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  normalized_name TEXT NOT NULL,
  rejected_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (workspace_id, normalized_name)
);

ALTER TABLE public.competitor_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitor_rejections_workspace_member"
  ON public.competitor_rejections FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));
