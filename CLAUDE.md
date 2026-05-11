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
ANTHROPIC_API_KEY     # Opcional — sin él usa mock para GEO Research y Claude provider
GEMINI_API_KEY        # Opcional
PERPLEXITY_API_KEY    # Opcional
```

## Base de datos

Las migraciones **no** se aplican con Supabase CLI — se ejecutan manualmente en el SQL Editor del dashboard o vía `pnpm migrate` (requiere `DATABASE_URL` con conexión directa a PostgreSQL).

Funciones RPC clave:
- `get_workspace_prompt_performance(slug, llm_key, country_filter)` — usada en `/prompts`
- `get_workspace_kpis(slug, llm_key)` — usada en `/dashboard`
- `is_workspace_member(workspace_id)` — helper RLS
- `can_manage_workspace(workspace_id)` — helper RLS
