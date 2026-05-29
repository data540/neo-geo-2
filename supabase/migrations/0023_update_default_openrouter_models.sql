-- =============================================================================
-- 0023: Actualizar defaults de OpenRouter para los 3 LLMs activos
-- =============================================================================

-- ChatGPT barato: GPT-5.4 Nano. Solo migramos nulos o defaults historicos.
UPDATE workspace_llm_config wlc
SET model = 'openai/gpt-5.4-nano'
FROM llm_providers lp
WHERE wlc.llm_provider_id = lp.id
  AND lp.key = 'chatgpt'
  AND (
    wlc.model IS NULL
    OR wlc.model IN ('openai/gpt-5.5', 'openai/gpt-4o-mini', 'openai/gpt-4.1-nano')
  );

-- AI Overviews/Gemini barato: Gemini 2.5 Flash Lite.
UPDATE workspace_llm_config wlc
SET model = 'google/gemini-2.5-flash-lite'
FROM llm_providers lp
WHERE wlc.llm_provider_id = lp.id
  AND lp.key = 'gemini'
  AND (
    wlc.model IS NULL
    OR wlc.model IN ('google/gemini-3.5-flash', 'google/gemini-2.0-flash-001')
  );

-- Perplexity equivalent: Sonar. Conserva personalizados y normaliza nulos.
UPDATE workspace_llm_config wlc
SET model = 'perplexity/sonar'
FROM llm_providers lp
WHERE wlc.llm_provider_id = lp.id
  AND lp.key = 'perplexity'
  AND wlc.model IS NULL;

-- Asegurar que la app mantiene solo los tres proveedores activos actuales.
UPDATE llm_providers
SET enabled = CASE
  WHEN key IN ('chatgpt', 'gemini', 'perplexity') THEN true
  ELSE false
END;

UPDATE llm_providers
SET name = 'AI Overviews'
WHERE key = 'gemini';
