# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Dev server (port 3000, uses next available if occupied)
pnpm build        # TypeScript check + production build
pnpm lint         # Biome linter check
pnpm lint:fix     # Biome linter with auto-fix
pnpm format       # Biome formatter
pnpm migrate      # Run SQL migrations via pg against DATABASE_URL
pnpm seed         # Seed Escuela CES workspace (SEED_USER_EMAIL / SEED_USER_PASSWORD env vars)
pnpm kb:index     # Re-index content/geo-knowledge/ markdown into knowledge_chunks (pgvector RAG)
pnpm kb:stats     # Show per-file chunk and token stats from knowledge_chunks
pnpm backfill:mentions  # Re-clasifica mentions sin mention_type usando classifyMentionType()
```

Para el seed con usuario específico:
```bash
SEED_USER_EMAIL=tester@gmail.com SEED_USER_PASSWORD=12345678 pnpm seed
```

## Architecture

### Multi-tenant SaaS
Cada `workspace` tiene un `slug` único en la URL (`/[workspace]/prompts`). El layout `src/app/(app)/[workspace]/layout.tsx` valida membresía en cada request y expone el workspace a los hijos vía props. No existe contexto global de workspace — los Server Components lo reciben como prop del layout.

### Data flow: Monitorización de prompts
```
Prompt → Inngest event "prompt/run.manual"
  → runPromptManual.ts
  → runPrompt() (chatgpt/claude/gemini/perplexity o mock si no hay API key)
  → detectBrands() (exact + alias matching sobre el rawResponse)
  → mentions INSERT
  → daily_prompt_metrics UPSERT
  → revalidatePath
```
Los Inngest functions usan `SUPABASE_SERVICE_ROLE_KEY` (bypassea RLS). Las Server Actions usan el cliente con cookies del usuario (respeta RLS).

### Data flow: GEO Research wizard (4 pasos)
```
ResearchContextForm → generatePromptsAction
  → generatePromptCandidates() (Claude API o mock sin API key)
  → prompt_candidates INSERT (session_id agrupa una sesión)
→ PromptCandidateGrid (paso 2, selección)
→ auditCoverageAction → auditPromptCoverage() (Claude API)
→ prioritizePromptsAction → prioritizePrompts() (Claude API)
→ acceptPromptsAction → prompts INSERT + candidates.activated = true
```

### Supabase clients
- `src/lib/supabase/client.ts` — `createBrowserClient`, para Client Components
- `src/lib/supabase/server.ts` — `createServerClient` con cookies, para Server Components y Server Actions
- Inngest functions crean su propio cliente con `createSupabaseClient(..., SERVICE_ROLE_KEY)` para bypassear RLS

### RLS
Todas las tablas tienen RLS activo. Las funciones helper `is_workspace_member(uuid)` y `can_manage_workspace(uuid)` están definidas en PostgreSQL (`security definer`). La política de INSERT en `workspaces` permite cualquier usuario autenticado (`auth.uid() is not null`) porque al crear el workspace el usuario aún no es miembro.

### LLM providers
`src/lib/llm/runner.ts` despacha a provider según la key. Si no hay API key configurada, usa el mock en `src/lib/llm/mock.ts`. Lo mismo aplica para las funciones GEO: `ANTHROPIC_API_KEY` vacía activa el mock de `getMockCandidates()`.

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
1. **Ingesta** (`pnpm kb:index`): parsea cada `.md`, trocea por headings H2/H3, genera embeddings con `text-embedding-3-small` (1536 dims) y upsertea en `knowledge_chunks` (pgvector). Idempotente: solo procesa lo que cambia (hash sha256 por chunk).
2. **Retrieval** (`src/lib/geo/knowledgeRetrieval.ts`): a partir de las métricas débiles del workspace construye 1-4 queries en lenguaje natural, las embebe y llama a la RPC `match_knowledge_chunks` (cosine similarity, ivfflat). Top 10 chunks dedup.
3. **Generación**: `generateRecommendations()` pasa los chunks completos a Claude 3.5 Haiku vía OpenRouter y pide citar `source_file` por recomendación. La UI muestra las fuentes como badges.

Variables: `OPENAI_API_KEY_EMBEDDINGS` (o `OPENAI_API_KEY` como fallback) para indexar y embeber queries.

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
DATABASE_URL          # Para pnpm migrate (contraseña con caracteres especiales debe ir URL-encoded)
INNGEST_EVENT_KEY     # "local" en desarrollo
INNGEST_SIGNING_KEY   # "local" en desarrollo
OPENAI_API_KEY        # Opcional — sin él usa mock para ChatGPT
OPENAI_API_KEY_EMBEDDINGS  # Opcional — clave separada para embeddings (fallback a OPENAI_API_KEY)
ANTHROPIC_API_KEY     # Opcional — sin él usa mock para GEO Research y Claude provider
GEMINI_API_KEY        # Opcional
PERPLEXITY_API_KEY    # Opcional
OPENROUTER_API_KEY    # Opcional — usado por Recomendaciones GEO (Claude 3.5 Haiku)
```

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
