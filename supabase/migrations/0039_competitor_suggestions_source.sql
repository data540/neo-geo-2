-- 0039: competitor_suggestions — prompt_run_id nullable + columna source
-- prompt_run_id nullable: la acción batch (extractCompetitorsFromExecutedPromptsAction)
--   no tiene un run concreto, procesa todos los runs del workspace.
-- source: distinguir 'auto_extraction' (post-run automático) de 'manual_batch' (botón UI).

ALTER TABLE public.competitor_suggestions
  ALTER COLUMN prompt_run_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'auto_extraction'
    CHECK (source IN ('auto_extraction', 'manual_batch'));
