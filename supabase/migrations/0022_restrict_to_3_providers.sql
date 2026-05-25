-- =============================================================================
-- 0022: Reducir a 3 proveedores activos — ChatGPT, AI Overviews (Gemini), Perplexity
-- =============================================================================

-- Desactivar claude y deepseek (datos históricos se conservan intactos)
UPDATE llm_providers
SET enabled = false
WHERE key IN ('claude', 'deepseek');

-- Renombrar gemini → "AI Overviews" (key se mantiene "gemini" para no romper FK de prompt_runs)
UPDATE llm_providers
SET name = 'AI Overviews'
WHERE key = 'gemini';

-- Actualizar workspace_llm_config que usen el modelo antiguo de chatgpt al nuevo default free-tier
UPDATE workspace_llm_config wlc
SET model = 'openai/gpt-4o-mini'
FROM llm_providers lp
WHERE wlc.llm_provider_id = lp.id
  AND lp.key = 'chatgpt'
  AND (wlc.model IS NULL OR wlc.model = 'openai/gpt-4.1-nano');
