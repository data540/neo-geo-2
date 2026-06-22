-- 0038: Añadir soporte AI Mode a prompt_serp_cache.
-- Google AI Mode es una feature SERP distinta de AI Overviews:
-- AI Overviews = resumen generado en resultados estándar.
-- AI Mode = pestaña conversacional de Google Search (2025+).

ALTER TABLE public.prompt_serp_cache
  ADD COLUMN IF NOT EXISTS ai_mode_present       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_mode_serp_position integer;
