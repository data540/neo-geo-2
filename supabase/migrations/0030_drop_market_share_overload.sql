-- ─────────────────────────────────────────────────────────────────────────────
-- 0023: Eliminar la sobrecarga huérfana de get_workspace_market_share
-- ─────────────────────────────────────────────────────────────────────────────
-- Contexto: existían dos versiones de la función en la BD:
--   (workspace_slug, days, llm_key)                          → la usada por el dashboard
--   (workspace_slug, days, llm_key, p_country_filter)        → variante huérfana
-- PostgREST devolvía PGRST203 al no poder resolver el overloading,
-- y el panel "Market Share" del dashboard se renderizaba vacío.

drop function if exists public.get_workspace_market_share(text, int, text, text);
