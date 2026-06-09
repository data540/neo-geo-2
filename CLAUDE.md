# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Dev server (port 3000, uses next available if occupied)
pnpm build        # TypeScript check + production build
pnpm lint         # Biome linter check
pnpm lint:fix     # Biome linter with auto-fix
pnpm format       # Biome formatter
pnpm workflow:new codex/my-change  # Create a dev branch from origin/master
pnpm prod:sync    # Sync optional read-only production mirror
pnpm migrate      # Run SQL migrations via pg against DATABASE_URL
pnpm seed         # Seed Escuela CES workspace (SEED_USER_EMAIL / SEED_USER_PASSWORD env vars)
pnpm kb:index     # Re-index content/geo-knowledge/ markdown into knowledge_chunks (pgvector RAG)
pnpm kb:stats     # Show per-file chunk and token stats from knowledge_chunks
pnpm backfill:mentions  # Re-clasifica mentions sin mention_type usando classifyMentionType()
```

## Development vs production workflow

GitHub `origin/master` is the production source of truth. The local folder `C:\Users\David\VS neo-geo-2` is the development workspace.

Rules for Claude Code:
- Do not commit directly to `master` unless the user explicitly asks for an emergency hotfix.
- Create feature branches with `codex/<short-name>` from `origin/master`.
- Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` before proposing a merge to production.
- Keep optional local production mirrors read-only and sync them with `pnpm prod:sync`.
- Do not edit nested repo copies such as `neo-geo/`; they are local-only artifacts ignored by the root repo.

Full workflow: `docs/development-production-workflow.md`.

Para el seed con usuario específico:
```bash
SEED_USER_EMAIL=tester@gmail.com SEED_USER_PASSWORD=12345678 pnpm seed
```

## Architecture

### Multi-tenant SaaS
Cada `workspace` tiene un `slug` único en la URL (`/[workspace]/prompts`). El layout `src/app/(app)/[workspace]/layout.tsx` valida membresía en cada request y expone el workspace a los hijos vía props. No existe contexto global de workspace — los Server Components lo reciben como prop del layout.

### Data flow: Monitorización de prompts
```
Prompt → Inngest event "prompt/run.manual" o "prompt/run.multi"
  → runPromptManual.ts / runPromptManualMulti.ts
  → runPrompt() vía OpenRouter (sin mocks — lanza error si falta OPENROUTER_API_KEY)
  → detectBrands() (exact + alias matching sobre el rawResponse)
  → mentions INSERT
  → daily_prompt_metrics UPSERT
  → revalidatePath
```
Los Inngest functions usan `SUPABASE_SERVICE_ROLE_KEY` (bypassea RLS). Las Server Actions usan el cliente con cookies del usuario (respeta RLS).

### Data flow: GEO Research wizard (4 pasos)
```
ResearchContextForm → generatePromptsAction
  → generatePromptCandidates() vía OpenRouter (sin mocks — lanza error si falta key)
  → prompt_candidates INSERT (session_id agrupa una sesión)
→ PromptCandidateGrid (paso 2, selección)
→ auditCoverageAction → auditPromptCoverage() vía OpenRouter
→ prioritizePromptsAction → prioritizePrompts() vía OpenRouter
→ acceptPromptsAction → prompts INSERT + candidates.activated = true
```

### Supabase clients
- `src/lib/supabase/client.ts` — `createBrowserClient`, para Client Components
- `src/lib/supabase/server.ts` — `createServerClient` con cookies, para Server Components y Server Actions
- Inngest functions crean su propio cliente con `createSupabaseClient(..., SERVICE_ROLE_KEY)` para bypassear RLS

### RLS
Todas las tablas tienen RLS activo. Las funciones helper `is_workspace_member(uuid)` y `can_manage_workspace(uuid)` están definidas en PostgreSQL (`security definer`). La política de INSERT en `workspaces` permite cualquier usuario autenticado (`auth.uid() is not null`) porque al crear el workspace el usuario aún no es miembro.

### LLM providers — política sin mocks (datos reales siempre)

**Todos los LLMs se ejecutan exclusivamente a través de OpenRouter.** No hay mocks, ni fallbacks heurísticos, ni respuestas simuladas: si `OPENROUTER_API_KEY` no está configurada, el código lanza un error explícito en runtime. El objetivo es trabajar siempre con datos reales — nunca reintroducir mocks aunque sea "para desarrollo local".

**Proveedores activos (3):**

| `LlmProviderKey` | Label en UI   | Modelo default OpenRouter   |
|------------------|---------------|-----------------------------|
| `chatgpt`        | ChatGPT       | `openai/gpt-4o`             |
| `gemini`         | AI Overviews  | `google/gemini-2.5-flash-lite` |
| `perplexity`     | Perplexity    | `perplexity/sonar`          |

> La key `"gemini"` se mantiene en la BD para no romper datos históricos (prompt_runs, mentions). El `name` en `llm_providers` es "AI Overviews". Los proveedores `claude` y `deepseek` están desactivados (`enabled = false`) desde la migración `0022`.

- [src/lib/llm/runner.ts](src/lib/llm/runner.ts): único entry point para ejecuciones de prompts. Mapea cada `LlmProviderKey` a un modelo OpenRouter via `DEFAULT_OPENROUTER_MODEL`. Override por env (`OPENROUTER_MODEL_*`) o por workspace (`workspace_llm_config.model`).
- Pipeline GEO ([src/lib/geo/](src/lib/geo/)): `generatePromptCandidates`, `normalizeCandidates`, `auditPromptCoverage`, `prioritizePrompts`, `generateRecommendations` y `generateWorkspacePrompts` **lanzan error** si falta `OPENROUTER_API_KEY`. Ninguno tiene fallback heurístico.
- Embeddings: intentan primero OpenRouter (`OPENROUTER_API_KEY`, modelo `OPENROUTER_EMBEDDING_MODEL` o `openai/text-embedding-3-small` por defecto). OpenAI directo (`OPENAI_API_KEY_EMBEDDINGS` o `OPENAI_API_KEY`) queda solo como fallback final.
- Las claves individuales `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY` **ya no se usan** — todo va por OpenRouter.

> ⚠️ **No reintroducir mocks bajo ningún concepto.** Si una API key falta, el código debe fallar visible — no devolver datos simulados. El archivo `src/lib/llm/mock.ts` fue eliminado intencionadamente.

### Dashboard analytics (5 paneles + Export Excel)
La página `/[workspace]/dashboard` consume 5 RPCs en paralelo (migración `0016_dashboard_charts.sql`):
- `get_workspace_market_share(slug, days, llm_key)` → donut `MarketShareDonut` (own brand + competidores normalizados)
- `get_workspace_mention_breakdown(slug, days, llm_key)` → `MentionBreakdownPanel` (clasificación por `mention_type` enum: primary_recommendation, list_option, comparison, general_mention, warning)
- `get_workspace_top_competitors(slug, days, limit, llm_key)` → `TopCompetitorsPanel` con trend vs período anterior
- `get_workspace_top_sources(slug, days, limit, llm_key)` → `SourcePowerRanking` (dominios cited_by_llm en `sources`)
- `get_workspace_llm_comparison(slug, days)` → `LlmComparisonTable` (siempre global, sin filtro por LLM)

La columna `mentions.mention_type` se rellena en runtime por `classifyMentionType()` en `src/lib/detection/detectBrands.ts` (heurística + regex; orden de prioridad warning > primary > comparison > list > general). Para datos anteriores a la migración: `pnpm backfill:mentions`.

Export Excel multi-hoja vía `ExportDashboardButton` → `exportDashboardAction` (en `src/actions/dashboard-export.ts`) usa `xlsx` para componer 7 hojas (Resumen, Market Share, Tipos de mención, Top Competidores, Top Sources, Comparación LLMs, Tendencia diaria) y devolver base64 al cliente para descarga directa.

### Knowledge base RAG (Recomendaciones GEO)
La feature `/[workspace]/recommendations` usa RAG sobre la knowledge base experta en `content/geo-knowledge/` (vault Obsidian, 155+ notas .md):
1. **Ingesta** (`pnpm kb:index`): parsea cada `.md`, trocea por headings H2/H3, genera embeddings vía OpenRouter con `openai/text-embedding-3-small` por defecto (1536 dims) y upsertea en `knowledge_chunks` (pgvector). Idempotente: solo procesa lo que cambia (hash sha256 por chunk).
2. **Retrieval** (`src/lib/geo/knowledgeRetrieval.ts`): a partir de las métricas débiles del workspace construye 1-4 queries en lenguaje natural, las embebe y llama a la RPC `match_knowledge_chunks` (cosine similarity, ivfflat). Top 10 chunks dedup.
3. **Generación**: `generateRecommendations()` pasa los chunks completos a Claude 3.5 Haiku vía OpenRouter y pide citar `source_file` por recomendación. La UI muestra las fuentes como badges.

Variables: `OPENROUTER_API_KEY` para indexar y embeber queries vía OpenRouter. Fallback final: `OPENAI_API_KEY_EMBEDDINGS` o `OPENAI_API_KEY`.

### Analytics: Search Console + GA4 (CPA por LLM)
La sección `/[workspace]/analytics` cruza datos reales de Google con la monitorización GEO:
- **Conexión:** Service Account global de Google (`GOOGLE_SA_CLIENT_EMAIL` / `GOOGLE_SA_PRIVATE_KEY`). El dueño de cada propiedad GSC/GA4 da acceso de lectura a ese `client_email`. El `gsc_site_url` y `ga4_property_id` se configuran por workspace en Settings (`GoogleIntegrationPanel` → `updateGoogleConfigAction`, columnas en `workspaces`).
- **Cliente:** `src/lib/google/` — `auth.ts` (JWT service account), `searchConsole.ts`, `analytics.ts`, `llmReferralMap.ts` (mapea `sessionSource` de GA4 a `LlmProviderKey`: chatgpt.com→chatgpt, perplexity.ai→perplexity, gemini.google.com→gemini).
- **Ingesta:** CRON diario `refreshGoogleAnalytics` (Inngest, `0 4 * * *` + evento manual `google/analytics.refresh`). GSC reprocesa ventana de 30 días (UPSERT idempotente por latencia de ~2-3 días). Cachea en `workspace_gsc_cache` (fila por workspace+día+query) y `workspace_ga4_llm_cache` (fila por workspace+día+llm). Migración `0035`.
- **CPA por LLM:** `CPA = SUM(prompt_runs.cost_usd) del proveedor ÷ conversiones GA4 atribuidas a ese LLM`. AI Overviews/Gemini tiene atribución limitada en GA4 (su tráfico se mezcla con google/organic) — se indica en la UI.
- **Cruce GEO↔SEO:** la página compara los `prompts` activos con las queries reales de `workspace_gsc_cache` por normalización (lowercase, sin acentos, substring) para marcar prompts con tráfico real vs oportunidades.

### Server Actions
Todas en `src/actions/`. Patrón obligatorio:
1. `createClient()` de `@/lib/supabase/server`
2. Validar con Zod (`.issues[0]?.message` — Zod v4 usa `.issues` no `.errors`)
3. Verificar permisos con `supabase.rpc("can_manage_workspace", ...)`
4. Query
5. `return { success: true/false, data?, error? }` — nunca `redirect()` dentro de una action (no es serializable)

### Tipos
`src/types/index.ts` es la fuente de verdad. `ActionResult<T>` es el tipo de retorno estándar para todas las actions. `PromptPerformanceRow` es el resultado de la RPC `get_workspace_prompt_performance()`.

### Linter
Biome 2.x. Reglas relevantes:
- `noNonNullAssertion` en warn (permitido en env vars)
- `noExplicitAny` en error
- Buttons necesitan `type="button"` explícito
- SVGs decorativos necesitan `aria-hidden="true"`
- `globals.css` excluido de Biome (Tailwind v4 `@theme` no es CSS estándar)

## Variables de entorno requeridas

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL                 # Para pnpm migrate (contraseña con caracteres especiales URL-encoded)
INNGEST_EVENT_KEY            # "local" en desarrollo
INNGEST_SIGNING_KEY          # "local" en desarrollo
OPENROUTER_API_KEY           # OBLIGATORIA — todos los LLMs (ejecución de prompts + pipeline GEO) van por OpenRouter. Sin esta key el código lanza error explícito; no hay mocks.
OPENROUTER_HTTP_REFERER      # Opcional — header para OpenRouter analytics
OPENROUTER_APP_NAME          # Opcional — X-Title para OpenRouter analytics
OPENROUTER_MODEL_CHATGPT     # Opcional — override del default openai/gpt-4o
OPENROUTER_MODEL_GEMINI      # Opcional — override del default google/gemini-2.5-flash-lite
OPENROUTER_MODEL_PERPLEXITY  # Opcional — override del default perplexity/sonar
OPENROUTER_MODEL_SENTIMENT   # Opcional — default openai/gpt-4o-mini (análisis LLM de sentiment)
OPENROUTER_EMBEDDING_MODEL   # Opcional — default openai/text-embedding-3-small
OPENAI_API_KEY_EMBEDDINGS    # Fallback final para embeddings si falla/no está OpenRouter
OPENAI_API_KEY               # Fallback de OPENAI_API_KEY_EMBEDDINGS si no está configurada
SERPAPI_KEY                  # Para el refresco semanal de datos SERP de Google AI Overview (src/inngest/functions/refreshAioSerpData.ts). Sin esta key el CRON no hace llamadas (falla con error explícito). Coste ~1 call/prompt/semana.
GOOGLE_SA_CLIENT_EMAIL       # Service Account de Google (sección Analytics: Search Console + GA4). client_email del JSON de la cuenta de servicio.
GOOGLE_SA_PRIVATE_KEY        # Service Account de Google. private_key del JSON, con \n literales escapados. Solo servidor — nunca al cliente.
```

> Las claves `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `OPENROUTER_MODEL_CLAUDE` y `OPENROUTER_MODEL_DEEPSEEK` ya **no se usan**. Toda la inferencia de LLM va por OpenRouter con los 3 proveedores activos.

## Base de datos

Las migraciones **no** se aplican con Supabase CLI — se ejecutan manualmente en el SQL Editor del dashboard o vía `pnpm migrate` (requiere `DATABASE_URL` con conexión directa a PostgreSQL).

Funciones RPC clave:
- `get_workspace_prompt_performance(slug, llm_key, country_filter)` — usada en `/prompts`
- `get_workspace_kpis(slug, llm_key)` — usada en `/dashboard`
- `is_workspace_member(workspace_id)` — helper RLS
- `can_manage_workspace(workspace_id)` — helper RLS

## Despliegue (Vercel)

**El proyecto de producción es `neogeo` en Vercel con dominio `neogeo-three.vercel.app`.** Repositorio vinculado: `data540/neo-geo-2`.

⚠️ **Antes de hacer cambios de despliegue (crear proyectos, cambiar dominios, etc.),** siempre verifica primero:
1. Qué proyectos Vercel existen y sus dominios actuales
2. Qué repositorio está conectado a cuál proyecto
3. La arquitectura de despliegue existente
4. **SOLO ENTONCES** toma acciones (crear/modificar/eliminar proyectos)

Nunca crees nuevos proyectos sin verificar si ya existe configuración. Los cambios de despliegue afectan la infraestructura compartida — requieren entender el estado actual primero.
