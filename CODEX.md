# CODEX — Prompt de reconstrucción completa de neo-geo

> Este documento es un prompt exhaustivo para reconstruir la aplicación **neo-geo** desde cero usando Codex o cualquier agente de codificación. Contiene la arquitectura completa, esquema de base de datos, componentes, acciones, funciones de background, integraciones y todas las mejoras aplicadas en producción.

---

## 1. DESCRIPCIÓN DEL PRODUCTO

**neo-geo** es una plataforma SaaS multi-tenant de **GEO (Generative Engine Optimization)** y monitorización de visibilidad de marca en motores de búsqueda de IA. Permite a empresas:

1. Monitorizar si su marca aparece en respuestas de LLMs (ChatGPT, Claude, Gemini, Perplexity, DeepSeek)
2. Comparar su visibilidad frente a competidores
3. Medir KPIs: posición media, share of voice (SOV), consistencia, sentimiento
4. Generar y priorizar prompts estratégicos con IA (GEO Research)
5. Ver tendencias históricas en dashboard con gráficas de serie temporal

**Stack técnico:**
- Next.js 16.2.4 (App Router, Server Components, Server Actions)
- React 19.2.4
- TypeScript 5 strict mode
- Supabase (PostgreSQL + Auth + RLS)
- Inngest (background jobs, cron)
- OpenRouter (proxy universal para todos los LLMs)
- Tailwind CSS v4
- Biome 2.x (linter + formatter)
- Recharts (gráficas)
- Zod v4 (validación)
- Sonner (toasts)

---

## 2. ESTRUCTURA DE ARCHIVOS

```
neo-geo/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── [workspace]/
│   │   │   │   ├── layout.tsx              # Layout con sidebar para todas las páginas del workspace
│   │   │   │   ├── company-bio/page.tsx    # Editar datos de marca y brand profile
│   │   │   │   ├── dashboard/page.tsx      # KPIs + gráfica de serie temporal
│   │   │   │   ├── prompts/page.tsx        # Lista de prompts con métricas de rendimiento
│   │   │   │   ├── prompt-research/page.tsx # Wizard GEO Research (4 pasos con IA)
│   │   │   │   ├── sources/page.tsx        # URLs citadas por los LLMs
│   │   │   │   ├── competitors/page.tsx    # Competidores + sugerencias auto-detectadas
│   │   │   │   ├── team/page.tsx           # Gestión de miembros del workspace
│   │   │   │   ├── settings/page.tsx       # Configuración de LLMs por workspace
│   │   │   │   └── admin/page.tsx          # Logs de ejecución + tokens + coste (owner/admin)
│   │   │   ├── workspaces/page.tsx         # Lista de workspaces del usuario
│   │   │   └── onboarding/page.tsx         # Wizard de creación de workspace
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── api/
│   │   │   └── inngest/route.ts            # Webhook para Inngest
│   │   ├── auth/callback/route.ts          # Callback OAuth Supabase
│   │   └── page.tsx                        # Landing / redirect
│   │
│   ├── actions/                            # Server Actions (Next.js)
│   │   ├── prompts.ts
│   │   ├── workspace.ts
│   │   ├── competitors.ts
│   │   ├── tags.ts
│   │   ├── geo-research.ts
│   │   └── llm-config.ts
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MainNav.tsx                 # Menú de navegación lateral
│   │   │   ├── AppSidebar.tsx              # Sidebar contenedor
│   │   │   ├── WorkspaceSwitcher.tsx       # Selector de workspace
│   │   │   ├── TopBar.tsx                  # Barra superior
│   │   │   └── FiltersPanel.tsx            # Filtros globales (LLM, país, rango fechas)
│   │   ├── prompts/
│   │   │   ├── PromptPerformanceTable.tsx
│   │   │   ├── PromptPerformanceCard.tsx
│   │   │   ├── PromptKpiCards.tsx
│   │   │   ├── PromptsPageHeader.tsx
│   │   │   ├── AddPromptButton.tsx
│   │   │   ├── BulkUploadPromptsButton.tsx # Import masivo: texto o Excel (.xlsx)
│   │   │   ├── DeletePromptButton.tsx
│   │   │   ├── RunPromptButton.tsx         # Ejecución inmediata con polling
│   │   │   ├── PromptStatusToggle.tsx
│   │   │   ├── PromptVisibilityLegend.tsx
│   │   │   ├── PromptStatusCell.tsx
│   │   │   └── cells/
│   │   │       ├── SovBar.tsx
│   │   │       ├── PositionIndicator.tsx
│   │   │       ├── SentimentBadge.tsx
│   │   │       ├── ConsistencyIndicator.tsx
│   │   │       ├── CountryBadge.tsx
│   │   │       └── TagsCell.tsx
│   │   ├── geo/
│   │   │   ├── GeoResearchWizard.tsx       # Wizard de 4 pasos
│   │   │   ├── ResearchContextForm.tsx     # Paso 1: contexto de marca
│   │   │   ├── PromptCandidateGrid.tsx     # Paso 2: selección de candidatos
│   │   │   ├── PromptCandidateCard.tsx
│   │   │   ├── CoverageAuditPanel.tsx      # Paso 3: auditoría de cobertura
│   │   │   ├── PromptPrioritizerPanel.tsx  # Paso 4: priorización
│   │   │   └── WizardStepIndicator.tsx
│   │   ├── workspace/
│   │   │   ├── WorkspaceForm.tsx
│   │   │   ├── TeamManagementPanel.tsx     # Usa <select> HTML nativo (NO @base-ui/react)
│   │   │   └── LlmConfigPanel.tsx          # Sliders 0-50 por proveedor LLM
│   │   ├── admin/
│   │   │   └── AdminLogsTable.tsx          # Tabla expandible con respuesta raw
│   │   ├── dashboard/
│   │   │   └── TrendChart.tsx              # Recharts LineChart serie temporal
│   │   └── ui/                             # shadcn components (@base-ui/react)
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── progress.tsx
│   │       ├── select.tsx                  # @base-ui/react/select — NO usar en forms con estado
│   │       ├── InfoTooltip.tsx
│   │       └── ...
│   │
│   ├── inngest/
│   │   ├── client.ts                       # Instancia Inngest
│   │   └── functions/
│   │       ├── runPromptManual.ts          # Event: prompt/run.manual — concurrency 5, retries 2
│   │       ├── runPromptScheduled.ts       # Cron: 0 */6 * * * — lee workspace_llm_config
│   │       └── aggregateDailyMetrics.ts    # Cron: 0 2 * * * — agrega métricas diarias
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts                   # createClient() con cookies SSR
│   │   │   └── client.ts                   # createBrowserClient()
│   │   ├── llm/
│   │   │   ├── runner.ts                   # runPrompt() — OpenRouter universal
│   │   │   ├── mock.ts                     # Mock si no hay OPENROUTER_API_KEY
│   │   │   ├── pricing.ts                  # estimateCostForModel() — con fallback por versión
│   │   │   ├── executePromptRun.ts         # Orquesta ejecución completa (llamar desde actions)
│   │   │   ├── generateWorkspacePrompts.ts # Genera 10 prompts iniciales con Claude
│   │   │   └── enqueueWorkspaceRuns.ts     # Encola runs en background
│   │   ├── detection/
│   │   │   ├── detectBrands.ts             # Fuzzy matching de marca + competidores + sentimiento
│   │   │   └── extractSources.ts           # Extrae URLs de respuestas LLM
│   │   ├── geo/
│   │   │   ├── masterPrompts.ts            # Plantillas de sistema para Claude GEO Research
│   │   │   ├── conversationalPromptGenerator.ts  # generatePromptCandidates()
│   │   │   ├── promptCoverageAuditor.ts    # auditPromptCoverage()
│   │   │   └── promptPrioritizer.ts        # prioritizePrompts()
│   │   ├── metrics/
│   │   │   └── calculate.ts               # calculateSOV(), calculateConsistency()
│   │   ├── validations/
│   │   │   └── schemas.ts                 # Todos los Zod schemas
│   │   └── utils.ts                       # cn() helper
│   │
│   └── types/
│       └── index.ts                       # Todos los tipos TypeScript
│
├── supabase/
│   └── migrations/
│       ├── 0001_create_core_tables.sql
│       ├── 0002_create_prompt_monitoring_tables.sql
│       ├── 0003_create_rls_policies.sql
│       ├── 0004_create_metric_views_or_functions.sql
│       ├── 0005_add_prompt_metadata.sql
│       ├── 0006_create_prompt_candidates.sql
│       ├── 0007_add_token_cost_to_prompt_runs.sql
│       ├── 0008_create_competitor_suggestions.sql
│       ├── 0009_competitor_suggestions_rls.sql
│       ├── 0010_rework_prompt_metrics_from_runs.sql
│       ├── 0011_add_deepseek_provider.sql
│       ├── 0012_fix_prompt_performance_latest_run.sql
│       └── 0013_workspace_llm_config.sql
│
├── scripts/
│   ├── migrate.ts                          # Ejecuta migraciones SQL vía pg
│   ├── seed.ts                             # Seed workspace de prueba
│   ├── backfill-daily-metrics.ts           # Recalcula daily_*_metrics desde mentions existentes
│   ├── backfill-costs.ts                   # Calcula cost_usd para runs sin coste
│   └── run-all-prompts.ts                  # Ejecuta todos los prompts activos manualmente
│
├── CLAUDE.md                               # Instrucciones para Claude Code
├── CODEX.md                                # Este archivo — prompt de reconstrucción
├── package.json
├── tsconfig.json
├── biome.json
└── .env                                    # Variables de entorno (ver sección 9)
```

---

## 3. ESQUEMA DE BASE DE DATOS (PostgreSQL / Supabase)

### Convenciones
- Todos los IDs son `uuid` con `gen_random_uuid()`
- Todas las tablas tienen RLS activado
- Trigger `update_updated_at()` en todas las tablas con `updated_at`
- Helper RLS: `is_workspace_member(p_workspace_id uuid)` y `can_manage_workspace(p_workspace_id uuid)`

---

### Migración 0001 — Tablas core

```sql
-- Perfil de usuario (se crea automáticamente al registrarse)
create table profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text not null,
  full_name text,
  created_at timestamptz default now()
);

-- Workspace / cuenta de empresa
create table workspaces (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,          -- URL-safe, ej: "air-europa"
  name             text not null,
  brand_name       text not null,
  domain           text,
  brand_statement  text,
  country          text not null default 'ES',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Membresía multi-tenant
create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner','admin','member','viewer')),
  created_at   timestamptz default now(),
  primary key (workspace_id, user_id)
);

-- Marcas (propias y competidores)
create table brands (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  domain       text,
  aliases      text[] default '{}',
  type         text not null check (type in ('own','competitor')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Perfil detallado de la marca
create table brand_profiles (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  extracted_summary   text,
  positioning         text,
  audience            text,
  products_services   text,
  differentiators     text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Trigger auto-creación de perfil en registro
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Trigger updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;$$;
```

---

### Migración 0002 — Tablas de monitorización

```sql
-- Proveedores LLM (global, no por workspace)
create table llm_providers (
  id      uuid primary key default gen_random_uuid(),
  key     text unique not null,   -- 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'deepseek'
  name    text not null,
  enabled boolean not null default true
);
-- Seeds: ChatGPT, Claude, Gemini, Perplexity (DeepSeek se añade en 0011)

-- Prompts de monitorización
create table prompts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  text         text not null,
  country      text not null default 'ES',
  status       text not null default 'active' check (status in ('active','paused')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Tags para prompts
create table prompt_tags (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#6366f1',
  created_at   timestamptz default now()
);

create table prompt_tag_assignments (
  prompt_id uuid references prompts(id) on delete cascade,
  tag_id    uuid references prompt_tags(id) on delete cascade,
  primary key (prompt_id, tag_id)
);

-- Ejecuciones de prompts
create table prompt_runs (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  prompt_id        uuid references prompts(id) on delete set null,
  llm_provider_id  uuid references llm_providers(id),
  status           text not null default 'queued' check (status in ('queued','running','completed','failed')),
  raw_response     text,
  model            text,          -- Añadido en 0007: ej "openai/gpt-4.1-nano-2025-04-14"
  input_tokens     integer,       -- Añadido en 0007
  output_tokens    integer,       -- Añadido en 0007
  cost_usd         numeric(10,8), -- Añadido en 0007
  error_message    text,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz default now()
);

-- Menciones detectadas en cada run
create table mentions (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  prompt_run_id       uuid not null references prompt_runs(id) on delete cascade,
  brand_id            uuid references brands(id) on delete set null,
  brand_name_detected text,
  brand_type          text check (brand_type in ('own','competitor')),
  position            integer,    -- Orden de aparición en la respuesta (1 = primero)
  sentiment           text check (sentiment in ('positive','neutral','negative','no_data')),
  confidence          numeric not null default 1.0,
  created_at          timestamptz default now()
);

-- Fuentes / URLs citadas por el LLM
create table sources (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  prompt_run_id uuid not null references prompt_runs(id) on delete cascade,
  url           text,
  domain        text,
  title         text,
  cited_by_llm  boolean default true,
  created_at    timestamptz default now()
);

-- Métricas diarias por prompt + LLM
create table daily_prompt_metrics (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  prompt_id        uuid references prompts(id) on delete cascade,
  llm_provider_id  uuid references llm_providers(id),
  date             date not null,
  brand_mentioned  boolean,
  brand_position   numeric,
  competitor_count integer default 0,
  sov              numeric,        -- Share of Voice 0-100
  sentiment        text,
  consistency_score numeric,       -- % de runs en los que apareció la marca (0-100)
  created_at       timestamptz default now(),
  unique (prompt_id, llm_provider_id, date)
);

-- Métricas diarias agregadas por workspace + LLM
create table daily_workspace_metrics (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references workspaces(id) on delete cascade,
  llm_provider_id      uuid references llm_providers(id),
  date                 date not null,
  active_prompts_count integer default 0,
  brand_mentions_count integer default 0,
  avg_position         numeric,
  brand_consistency    numeric,    -- % de prompts activos con consistencia >= 70%
  avg_sov              numeric,
  created_at           timestamptz default now(),
  unique (workspace_id, llm_provider_id, date)
);
```

---

### Migración 0003 — RLS y helpers

```sql
-- Helpers (security definer para evitar recursión)
create or replace function is_workspace_member(p_workspace_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function can_manage_workspace(p_workspace_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

-- Ejemplo de políticas (repetir para cada tabla):
alter table workspaces enable row level security;
create policy "workspace: member select" on workspaces
  for select using (is_workspace_member(id));
create policy "workspace: admin update" on workspaces
  for update using (can_manage_workspace(id));
-- INSERT en workspaces: auth.uid() is not null (al crear workspace el user aún no es miembro)
create policy "workspace: authenticated insert" on workspaces
  for insert with check (auth.uid() is not null);

-- llm_providers: público (cualquiera puede leer)
create policy "llm_providers: public read" on llm_providers for select using (true);
```

---

### Migración 0004 — Funciones RPC de métricas

```sql
-- RPC principal: rendimiento histórico de prompts
create or replace function get_workspace_prompt_performance(
  p_slug text,
  p_llm_key text default 'chatgpt',
  p_country text default null
)
returns table (
  prompt_id          uuid,
  prompt_text        text,
  prompt_status      text,
  prompt_country     text,
  prompt_intent      text,
  prompt_funnel_stage text,
  prompt_persona     text,
  includes_brand     boolean,
  priority_score     integer,
  brand_mentioned    boolean,
  brand_position     numeric,
  competitor_count   integer,
  sov                numeric,
  sentiment          text,
  consistency_score  numeric,
  last_run_at        timestamptz,
  rank               bigint
) language sql security definer stable as $$
  -- Calcula métricas a partir de TODOS los runs históricos (no solo hoy)
  -- brand_position = promedio de posiciones en runs donde apareció
  -- consistency_score = % de todos los runs con mención propia
  -- sov = % de runs con mención propia / (propia + competidores)
  -- sentiment = modo (más frecuente) de los sentimientos históricos
  -- Véase implementación completa en migración 0012
$$;

-- RPC de KPIs del workspace
create or replace function get_workspace_kpis(
  p_slug text,
  p_llm_key text default 'chatgpt'
)
returns table (
  active_prompts_count  bigint,
  brand_mentions_count  bigint,
  avg_position          numeric,
  brand_consistency     numeric,
  avg_sov               numeric
) language sql security definer stable as $$
  -- Agrega métricas de daily_prompt_metrics para el día más reciente con datos
$$;
```

---

### Migración 0005 — Metadatos de prompts

```sql
-- Añadir a tabla prompts:
alter table prompts add column intent text check (intent in (
  'discovery','comparison','reputation','branded','decision',
  'local','price','employability','product_specific'
));
alter table prompts add column funnel_stage text check (funnel_stage in ('top','middle','bottom'));
alter table prompts add column persona text;
alter table prompts add column includes_brand boolean default false;
alter table prompts add column includes_competitor boolean default false;
alter table prompts add column strategic_value integer check (strategic_value between 1 and 10);
alter table prompts add column conversion_intent integer check (conversion_intent between 1 and 10);
alter table prompts add column ai_search_likelihood integer check (ai_search_likelihood between 1 and 10);
alter table prompts add column priority_score integer check (priority_score between 1 and 100);
alter table prompts add column research_reason text;
alter table prompts add column coverage_area text;
```

---

### Migración 0006 — Candidatos GEO Research

```sql
create table prompt_candidates (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  session_id            uuid not null,              -- Agrupa una sesión de research
  prompt                text not null,
  intent                text,
  funnel_stage          text,
  persona               text,
  country               text not null default 'ES',
  includes_brand        boolean default false,
  includes_competitor   boolean default false,
  strategic_value       integer,
  conversion_intent     integer,
  ai_search_likelihood  integer,
  priority_score        integer,
  priority_rank         integer,
  reason                text,
  coverage_area         text,
  risk_if_brand_absent  text check (risk_if_brand_absent in ('low','medium','high')),
  tags                  text[] default '{}',
  selected              boolean default true,
  activated             boolean default false,      -- true = convertido a prompt activo
  created_at            timestamptz default now()
);
-- Auto-cleanup: delete unactivated candidates after 7 days
```

---

### Migración 0007 — Tokens y coste en runs

```sql
alter table prompt_runs add column model text;
alter table prompt_runs add column input_tokens integer;
alter table prompt_runs add column output_tokens integer;
alter table prompt_runs add column cost_usd numeric(10,8);
```

---

### Migración 0008 — Sugerencias de competidores

```sql
create table competitor_suggestions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  prompt_run_id   uuid references prompt_runs(id) on delete set null,
  name            text not null,
  normalized_name text not null,          -- lowercase sin espacios extra
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at      timestamptz default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users(id),
  unique (workspace_id, normalized_name) where (status = 'pending')
);
```

---

### Migración 0011 — DeepSeek provider

```sql
insert into llm_providers (id, key, name, enabled)
values (gen_random_uuid(), 'deepseek', 'DeepSeek', true);
```

---

### Migración 0013 — Configuración LLM por workspace

```sql
create table workspace_llm_config (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  llm_provider_id uuid not null references llm_providers(id),
  prompts_per_day integer not null default 0
                  check (prompts_per_day >= 0 and prompts_per_day <= 50),
  enabled         boolean not null default false,
  updated_at      timestamptz not null default now(),
  unique (workspace_id, llm_provider_id)
);

-- RLS: miembros leen, admins modifican
alter table workspace_llm_config enable row level security;
create policy "wlc: member select" on workspace_llm_config
  for select using (is_workspace_member(workspace_id));
create policy "wlc: admin insert" on workspace_llm_config
  for insert with check (can_manage_workspace(workspace_id));
create policy "wlc: admin update" on workspace_llm_config
  for update using (can_manage_workspace(workspace_id));

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;$$;

create trigger workspace_llm_config_updated_at
  before update on workspace_llm_config
  for each row execute function update_updated_at();
```

---

## 4. TIPOS TYPESCRIPT (src/types/index.ts)

```typescript
// ── Auth ──────────────────────────────────────────────────────────────────────
export interface Profile {
  id: string; email: string; full_name: string | null; created_at: string;
}

// ── Workspaces ────────────────────────────────────────────────────────────────
export interface Workspace {
  id: string; slug: string; name: string; brand_name: string;
  domain: string | null; brand_statement: string | null;
  country: string; created_at: string; updated_at: string;
}
export type WorkspaceMemberRole = "owner" | "admin" | "member" | "viewer";
export interface WorkspaceMember {
  workspace_id: string; user_id: string; role: WorkspaceMemberRole; created_at: string;
}

// ── Brands ────────────────────────────────────────────────────────────────────
export type BrandType = "own" | "competitor";
export interface Brand {
  id: string; workspace_id: string; name: string; domain: string | null;
  aliases: string[]; type: BrandType; created_at: string; updated_at: string;
}
export interface BrandProfile {
  id: string; workspace_id: string;
  extracted_summary: string | null; positioning: string | null;
  audience: string | null; products_services: string | null;
  differentiators: string | null; created_at: string; updated_at: string;
}
export type CompetitorSuggestionStatus = "pending" | "approved" | "rejected";
export interface CompetitorSuggestion {
  id: string; workspace_id: string; prompt_run_id: string; name: string;
  normalized_name: string; status: CompetitorSuggestionStatus;
  created_at: string; reviewed_at: string | null; reviewed_by: string | null;
}

// ── LLM Providers ─────────────────────────────────────────────────────────────
export type LlmProviderKey = "chatgpt" | "claude" | "gemini" | "perplexity" | "deepseek";
export interface LlmProvider { id: string; key: LlmProviderKey; name: string; enabled: boolean; }
export interface WorkspaceLlmConfig {
  id: string; workspace_id: string; llm_provider_id: string;
  prompts_per_day: number; enabled: boolean; updated_at: string;
}
export interface WorkspaceLlmConfigWithProvider extends WorkspaceLlmConfig {
  llm_providers: Pick<LlmProvider, "key" | "name">;
}

// ── Prompts ───────────────────────────────────────────────────────────────────
export type PromptStatus = "active" | "paused";
export type PromptIntent =
  | "discovery" | "comparison" | "reputation" | "branded" | "decision"
  | "local" | "price" | "employability" | "product_specific";
export type FunnelStage = "top" | "middle" | "bottom";
export interface Prompt {
  id: string; workspace_id: string; text: string; country: string;
  status: PromptStatus; intent: PromptIntent | null; funnel_stage: FunnelStage | null;
  persona: string | null; includes_brand: boolean; includes_competitor: boolean;
  strategic_value: number | null; conversion_intent: number | null;
  ai_search_likelihood: number | null; priority_score: number | null;
  research_reason: string | null; coverage_area: string | null;
  created_at: string; updated_at: string;
}
export interface PromptTag { id: string; workspace_id: string; name: string; color: string; created_at: string; }

// ── Runs & Monitoring ─────────────────────────────────────────────────────────
export type RunStatus = "queued" | "running" | "completed" | "failed";
export type Sentiment = "positive" | "neutral" | "negative" | "no_data";
export interface PromptRun {
  id: string; workspace_id: string; prompt_id: string; llm_provider_id: string | null;
  status: RunStatus; raw_response: string | null; model: string | null;
  input_tokens: number | null; output_tokens: number | null; cost_usd: number | null;
  error_message: string | null; started_at: string | null; completed_at: string | null; created_at: string;
}
export interface Mention {
  id: string; workspace_id: string; prompt_run_id: string; brand_id: string | null;
  brand_name_detected: string | null; brand_type: BrandType | null;
  position: number | null; sentiment: Sentiment | null; confidence: number; created_at: string;
}
export interface Source {
  id: string; workspace_id: string; prompt_run_id: string;
  url: string | null; domain: string | null; title: string | null; cited_by_llm: boolean; created_at: string;
}

// ── Metrics ───────────────────────────────────────────────────────────────────
export interface DailyPromptMetric {
  id: string; workspace_id: string; prompt_id: string; llm_provider_id: string | null;
  date: string; brand_mentioned: boolean | null; brand_position: number | null;
  competitor_count: number; sov: number | null; sentiment: string | null;
  consistency_score: number | null; created_at: string;
}
export interface DailyWorkspaceMetric {
  id: string; workspace_id: string; llm_provider_id: string | null; date: string;
  active_prompts_count: number; brand_mentions_count: number; avg_position: number | null;
  brand_consistency: number | null; avg_sov: number | null; created_at: string;
}

// ── Performance RPC result ────────────────────────────────────────────────────
export interface PromptPerformanceRow {
  prompt_id: string; prompt_text: string; prompt_status: PromptStatus;
  prompt_country: string; prompt_intent: PromptIntent | null; prompt_funnel_stage: FunnelStage | null;
  prompt_persona: string | null; includes_brand: boolean; priority_score: number | null;
  brand_mentioned: boolean; brand_position: number | null; competitor_count: number;
  sov: number | null; sentiment: Sentiment; consistency_score: number;
  last_run_at: string | null; rank: number; tags?: PromptTag[];
}
export type VisibilityStatus = "top" | "mentioned" | "competitors_only" | "no_data";
export function getVisibilityStatus(row: PromptPerformanceRow): VisibilityStatus {
  if (row.brand_mentioned && row.brand_position === 1) return "top";
  if (row.brand_mentioned) return "mentioned";
  if (row.competitor_count > 0) return "competitors_only";
  return "no_data";
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
export interface WorkspaceKpis {
  activePromptsCount: number; brandMentionsCount: number; avgPosition: number | null;
  brandConsistency: number; avgSov: number | null;
}

// ── GEO Research ──────────────────────────────────────────────────────────────
export type RiskIfBrandAbsent = "low" | "medium" | "high";
export interface PromptCandidate {
  id: string; workspace_id: string; session_id: string; prompt: string;
  intent: PromptIntent | null; funnel_stage: FunnelStage | null; persona: string | null;
  country: string; includes_brand: boolean; includes_competitor: boolean;
  strategic_value: number | null; conversion_intent: number | null;
  ai_search_likelihood: number | null; priority_score: number | null;
  priority_rank: number | null; reason: string | null; coverage_area: string | null;
  risk_if_brand_absent: RiskIfBrandAbsent | null; tags: string[];
  selected: boolean; activated: boolean; created_at: string;
}
export interface GeoResearchInput {
  brandName: string; domain: string; brandStatement: string; country: string;
  location: string; category: string; productsServices: string; targetAudience: string;
  competitors: string[]; differentiators: string; numberOfPrompts: number;
}
export interface CoverageAuditResult {
  coverageScore: number; mainGaps: string[]; duplicatedOrWeakPrompts: string[];
  recommendedNewPrompts: string[]; promptsToRemove: string[]; finalRecommendation: string;
}
export interface PrioritizedPrompt {
  prompt: string; priorityRank: number; whySelected: string;
  coverageArea: string; riskIfBrandAbsent: RiskIfBrandAbsent;
}

// ── Action results ────────────────────────────────────────────────────────────
export interface ActionResult<T = undefined> {
  success: boolean; error?: string; data?: T;
}
```

---

## 5. MENÚS Y NAVEGACIÓN

### Menú lateral (MainNav.tsx)

| Orden | Ruta | Label | Icono | Descripción |
|-------|------|-------|-------|-------------|
| 1 | `/{slug}/company-bio` | Company Bio | Building2 | Editar datos de la marca y brand profile |
| 2 | `/{slug}/dashboard` | Dashboard | LayoutDashboard | KPIs + gráfica de serie temporal |
| 3 | `/{slug}/prompts` | Prompts | MessageSquareText | Lista de prompts con métricas históricas |
| 4 | `/{slug}/prompt-research` | GEO Research | Search | Wizard de 4 pasos para generar prompts con IA |
| 5 | `/{slug}/sources` | Sources | Globe | URLs citadas por los LLMs |
| 6 | `/{slug}/competitors` | Competitors | Swords | Gestión de competidores + auto-detección |
| 7 | `/{slug}/team` | Team | Users | Gestión de miembros y roles |
| 8 | `/{slug}/settings` | Settings | Settings | Configuración de LLMs por workspace |
| 9 | `/{slug}/admin` | Admin | ShieldCheck | Logs de ejecución (solo owner/admin) |

**Implementación:** `isActive` basado en `usePathname().startsWith(href)`. Modo colapsado oculta labels.

---

## 6. FUNCIONALIDADES DETALLADAS

### 6.1 Dashboard

- **KPI Cards** (arriba): Prompts activos, Menciones de marca, Posición media, Consistencia, SOV
- **TrendChart** (Recharts LineChart): Serie temporal de daily_workspace_metrics
  - 4 métricas seleccionables: Menciones (verde), Visibilidad/SOV (índigo), Posición (ámbar), Consistencia (púrpura)
  - Dos ejes Y: izquierdo para menciones (count), derecho para % métricas
  - Toggle buttons para activar/desactivar cada métrica
  - `connectNulls` activo en todas las líneas
- **Filtros**: Selector de LLM, rango de fechas (7/30/90 días)
- **Tabla de tendencias**: datos históricos en tabla debajo de la gráfica
- **Fix scroll**: `flex-1 overflow-auto min-h-0` en wrapper principal

### 6.2 Prompts

- RPC `get_workspace_prompt_performance(slug, llm_key, country_filter)` — calcula desde todos los runs históricos
- Columnas: prompt text, país, estado, intent, posición, SOV, sentimiento, consistencia, última ejecución
- Filtros: LLM provider, país
- Acciones por fila: ejecutar ahora, pausar/reactivar, eliminar
- Import masivo: texto plano (newline-separated) o archivo Excel (.xlsx)
- Tags: crear, asignar, visualizar por colores

### 6.3 GEO Research (Wizard 4 pasos)

**Paso 1 — Contexto:** Formulario con campos de marca (responsivo `grid-cols-1 sm:grid-cols-2`)
**Paso 2 — Candidatos:** Grid de tarjetas con selección múltiple
**Paso 3 — Auditoría:** Análisis de cobertura por Claude AI
**Paso 4 — Priorización:** Ranking de candidatos con justificación

**Fix responsive:** Todos los paneles con `p-4 sm:p-6`, step connector `w-8 sm:w-16`

### 6.4 Competitors

- Lista de competidores con métricas: posición, SOV, sentimiento, consistencia
- Añadir/editar/eliminar manualmente
- **Auto-detección:** Escanea todas las respuestas de runs completados, detecta marcas desconocidas con fuzzy matching, crea sugerencias pendientes de aprobación
- **Sugerencias:** Panel de pending/approved/rejected con acciones de aprobar/rechazar

### 6.5 Settings (LLM Config)

- Sliders 0–50 por cada uno de los 5 proveedores LLM
- `<input type="range">` HTML nativo (no third-party)
- Contador total de prompts/día en tiempo real
- Guardado batch: un solo upsert con todos los proveedores
- `enabled` se deriva server-side de `prompts_per_day > 0`
- Roles viewer/member ven en modo read-only

### 6.6 Team

- Tabla de miembros: email, nombre, rol, fecha de unión
- Invitar por email (debe existir en `profiles`)
- Selector de rol: `<select>` HTML nativo (NO @base-ui/react Select — tiene bugs de renderizado del popup)
- Zona de riesgo: eliminar workspace con confirmación por slug

### 6.7 Admin

- Tabla de últimas 200 ejecuciones: fecha, prompt, modelo, provider, input tokens, output tokens, coste USD, duración, estado
- Fila expandible: muestra `raw_response` del LLM
- Totales en cabecera: runs totales, tokens entrada, tokens salida, coste total
- Acceso restringido: solo owner/admin (`notFound()` para otros roles)

---

## 7. INTEGRACIÓN LLM (OpenRouter)

### runner.ts — Modelos por defecto

```typescript
const DEFAULT_OPENROUTER_MODEL: Record<LlmProviderKey, string> = {
  chatgpt:    "openai/gpt-4.1-nano",
  claude:     "anthropic/claude-3.5-haiku",
  gemini:     "google/gemini-2.0-flash-001",
  perplexity: "perplexity/sonar",
  deepseek:   "deepseek/deepseek-chat-v3-0324",
};
```

Todos los modelos son sobrescribibles por variable de entorno (`OPENROUTER_MODEL_CHATGPT`, etc.).

### pricing.ts — Cálculo de coste

Función `estimateCostForModel(model, inputTokens, outputTokens)`:
1. Busca precio en tabla estática (sin red)
2. Si no encuentra → intenta variantes del nombre (sin vendor prefix, sin sufijo de fecha `-2025-04-14`)
3. Si no encuentra → consulta catálogo live de OpenRouter `/api/v1/models` (TTL 1h)
4. Devuelve `null` si no puede calcular

**Problema resuelto:** OpenRouter devuelve modelo con versión `openai/gpt-4.1-nano-2025-04-14` pero la tabla estática tiene `gpt-4.1-nano`. Se implementó `modelVariants()` para probar 4 variantes.

### mock.ts

Se activa cuando `OPENROUTER_API_KEY` no está configurado. Genera respuestas realistas con la marca propia y competidores. El mock **no** devuelve tokens ni coste (quedan como `null`).

---

## 8. FLUJO DE DATOS

### Ejecución de un prompt

```
UI: RunPromptButton.tsx
  → runPromptNowAction() [src/actions/prompts.ts]
    → INSERT prompt_runs (status='queued')
    → inngest.send("prompt/run.manual", { promptId, workspaceId, llmKey })
      → runPromptManual.ts [Inngest function, concurrency=5, retries=2]
        → step 1: fetch context (prompt, workspace, brands, llm_provider)
        → step 2: create prompt_run record (status='running')
        → step 3: runPrompt() → OpenRouter API
        → step 4: save raw_response, model, tokens, cost_usd (status='completed')
        → step 5: detectBrands() → fuzzy matching
        → step 6: extractSourcesFromResponse() → URLs
        → step 7: INSERT mentions
        → step 8: INSERT sources
        → step 9: INSERT competitor_suggestions (si marca desconocida)
        → step 10: UPSERT daily_prompt_metrics
        → step 11: UPSERT daily_workspace_metrics
        → step 12: revalidatePath (prompts, dashboard)
```

### Cron diario (runPromptScheduled)

```
Cron: 0 */6 * * * (cada 6 horas)
  → SELECT workspace_llm_config WHERE enabled=true AND prompts_per_day > 0
  → SELECT prompts WHERE status='active'
  → Para cada config (workspace × provider):
      - available = prompts del workspace
      - count = min(prompts_per_day, available.length)
      - selected = shuffle(available).slice(0, count) // Fisher-Yates
      - inngest.send(events[]) // un evento por prompt seleccionado
```

### Agregación diaria

```
Cron: 0 2 * * * (2 AM)
  → Para cada workspace × llm_provider:
      - Leer daily_prompt_metrics del día
      - Calcular: active_prompts, brand_mentions, avg_position, brand_consistency, avg_sov
      - UPSERT daily_workspace_metrics
```

---

## 9. VARIABLES DE ENTORNO

```bash
# Supabase — OBLIGATORIO
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Bypasa RLS para operaciones bulk

# Base de datos directa — para scripts de migración
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres

# Inngest — Background jobs
INNGEST_EVENT_KEY=local              # "local" en desarrollo
INNGEST_SIGNING_KEY=local            # "local" en desarrollo

# OpenRouter — OBLIGATORIO para LLM real
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_HTTP_REFERER=https://tuapp.com  # Opcional
OPENROUTER_APP_NAME=neo-geo                # Opcional

# Modelos OpenRouter — Opcional (usa defaults si no están)
OPENROUTER_MODEL_CHATGPT=openai/gpt-4.1-nano
OPENROUTER_MODEL_CLAUDE=anthropic/claude-3.5-haiku
OPENROUTER_MODEL_GEMINI=google/gemini-2.0-flash-001
OPENROUTER_MODEL_PERPLEXITY=perplexity/sonar
OPENROUTER_MODEL_DEEPSEEK=deepseek/deepseek-chat-v3-0324

# Claude AI para GEO Research — Opcional
ANTHROPIC_API_KEY=sk-ant-...

# Seed de base de datos — Solo para desarrollo
SEED_USER_EMAIL=tester@gmail.com
SEED_USER_PASSWORD=12345678
```

> **Sin `OPENROUTER_API_KEY`**: todos los runs usan mock. Los tokens y coste quedan como `null`.  
> **Sin `ANTHROPIC_API_KEY`**: GEO Research usa candidatos mock (funciona pero no es real).

---

## 10. PATRONES DE CÓDIGO

### Server Actions — Patrón obligatorio

```typescript
"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const schema = z.object({ workspaceId: z.string().uuid(), ... });

export async function myAction(input: unknown): Promise<ActionResult<SomeType>> {
  // 1. Validar
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    //                                                  ^^^^^^ Zod v4 usa .issues no .errors
  }
  
  // 2. Auth
  const supabase = await createClient();
  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: parsed.data.workspaceId,
  });
  if (!canManage) return { success: false, error: "Sin permisos" };
  
  // 3. Query
  const { data, error } = await supabase.from("tabla").insert({ ... });
  if (error) return { success: false, error: error.message };
  
  // 4. Revalidar (si es necesario) — NUNCA redirect() dentro de actions
  revalidatePath(`/${slug}/pagina`);
  
  return { success: true, data };
}
```

### Clientes Supabase

```typescript
// Server Components y Server Actions:
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient(); // Respeta RLS con cookies del usuario

// Inngest functions y scripts CLI:
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Bypasa RLS
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

### Client Components — Patrón de formularios

```typescript
"use client";
import { useTransition } from "react";
import { toast } from "sonner";

export function MyForm({ ... }) {
  const [pending, startTransition] = useTransition();
  
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await myAction({ ... });
      if (result.success) toast.success("OK");
      else toast.error(result.error ?? "Error");
    });
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* SIEMPRE type="button" en botones no-submit */}
      <Button type="submit" disabled={pending}>Guardar</Button>
    </form>
  );
}
```

---

## 11. REGLAS DE LINTER (Biome 2.x)

- `noNonNullAssertion`: warn (permitido en process.env.VARIABLE!)
- `noExplicitAny`: error — nunca usar `any`, usar `unknown` + cast
- Todos los `<button>` deben tener `type="button"` o `type="submit"` explícito
- SVGs decorativos: `aria-hidden="true"`
- `globals.css` excluido (Tailwind v4 `@theme` no es CSS estándar)
- Importaciones organizadas automáticamente

---

## 12. BUGS RESUELTOS Y MEJORAS APLICADAS

### Bug: Tokens y coste null en Admin panel
**Causa:** OpenRouter devuelve el modelo con versión (`openai/gpt-4.1-nano-2025-04-14`) pero la tabla de precios solo tenía la clave sin versión ni sufijo de fecha.  
**Fix:** `modelVariants()` en `pricing.ts` prueba 4 variantes: con/sin vendor prefix, con/sin sufijo fecha `-YYYY-MM-DD`.  
**Backfill:** `scripts/backfill-costs.ts` actualizó 71 runs históricos.

### Bug: Prompts sin datos de posición/SOV
**Causa:** RPC `get_workspace_prompt_performance` calculaba solo desde runs de hoy, no histórico.  
**Fix:** Migración 0012 reescribe la RPC para usar todos los runs históricos. Usa CTEs: `latest_run`, `all_mentions`, `run_counts`, `own_mention_runs`, `comp_per_run`, `historical_metrics`.

### Bug: Dashboard sin datos históricos en la gráfica
**Causa:** Filtro `.gte("date", fromIso)` fallaba por problema de zona horaria.  
**Fix:** Usar `.limit(days)` sin filtro de fecha. Backfill de `daily_workspace_metrics` con `scripts/backfill-daily-metrics.ts`.

### Bug: Scroll roto en Dashboard y GEO Research
**Causa:** `overflow-hidden` en layout padre sin `overflow-auto` en hijos.  
**Fix:** Añadir `flex-1 overflow-auto min-h-0` en el wrapper principal de cada página.

### Bug: Selector de rol en Team no muestra el dropdown
**Causa:** `@base-ui/react/select` no renderiza el popup correctamente en este contexto.  
**Fix:** Reemplazar con `<select>` HTML nativo con estilos Tailwind compatibles.  
**Regla:** NO usar `@base-ui/react Select` en formularios con estado — usar siempre `<select>` HTML nativo.

### Bug: GEO Research no visible en móvil
**Fix:** `grid-cols-1 sm:grid-cols-2`, padding `p-4 sm:p-6`, step connector responsivo.

### Mejora: Cron hardcodeado a chatgpt
**Antes:** `runPromptScheduled` siempre usaba `llmKey: "chatgpt"` para todos los workspaces.  
**Ahora:** Lee `workspace_llm_config` y envía N eventos por proveedor habilitado, con shuffle aleatorio de prompts.

### Mejora: scripts/run-all-prompts.ts no guardaba cost_usd
**Fix:** Añadir llamada a `estimateCostForModel()` y guardar el resultado en el update de `prompt_runs`.

---

## 13. SCRIPTS CLI

```bash
pnpm dev              # Servidor de desarrollo (Next.js, puerto 3000)
pnpm build            # Build de producción + type check
pnpm lint             # Biome check
pnpm lint:fix         # Biome fix automático
pnpm migrate          # Ejecuta migraciones SQL via pg (requiere DATABASE_URL)
pnpm seed             # Seed workspace de prueba
pnpm backfill         # Recalcula daily_*_metrics desde mentions existentes
pnpm backfill-costs   # Calcula cost_usd para prompt_runs sin coste (71 runs corregidos)
pnpm run-prompts [workspace-slug] [llm-key]  # Ejecuta todos los prompts activos
# Ej: pnpm run-prompts air-europa chatgpt
```

---

## 14. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. **Setup del proyecto**
   - Next.js 16 con TypeScript, Tailwind v4, Biome
   - Supabase project, Auth configurado
   - Variables de entorno

2. **Base de datos**
   - Ejecutar las 13 migraciones en orden en Supabase SQL Editor
   - Verificar RLS y funciones helper

3. **Tipos y utilidades base**
   - `src/types/index.ts`
   - `src/lib/utils.ts`
   - `src/lib/supabase/server.ts` y `client.ts`

4. **Integración LLM**
   - `src/lib/llm/runner.ts` (OpenRouter)
   - `src/lib/llm/mock.ts`
   - `src/lib/llm/pricing.ts`
   - `src/lib/detection/detectBrands.ts`
   - `src/lib/detection/extractSources.ts`
   - `src/lib/metrics/calculate.ts`

5. **Inngest**
   - `src/inngest/client.ts`
   - `src/inngest/functions/runPromptManual.ts`
   - `src/inngest/functions/runPromptScheduled.ts`
   - `src/inngest/functions/aggregateDailyMetrics.ts`
   - `src/app/api/inngest/route.ts`

6. **Server Actions** (en este orden por dependencias)
   - `src/actions/workspace.ts`
   - `src/actions/prompts.ts`
   - `src/actions/competitors.ts`
   - `src/actions/tags.ts`
   - `src/actions/geo-research.ts`
   - `src/actions/llm-config.ts`

7. **Componentes UI base** (shadcn/base-ui)

8. **Layout y navegación**
   - `AppSidebar`, `MainNav`, `WorkspaceSwitcher`, `FiltersPanel`

9. **Páginas** (en orden de complejidad)
   - Login / Register
   - Workspaces list
   - Company Bio
   - Team
   - Admin
   - Sources
   - Dashboard (con TrendChart)
   - Competitors
   - Prompts
   - GEO Research
   - Settings

10. **Scripts CLI** y backfill

---

## 15. NOTAS IMPORTANTES PARA LA RECONSTRUCCIÓN

1. **Multi-tenancy via URL:** Todas las páginas de workspace usan `[workspace]` (slug). El layout valida membresía en cada request.

2. **No redirect() en Server Actions:** Solo `return { success, error, data }`. Los redirects van en el componente cliente después de recibir la respuesta.

3. **Zod v4:** Usar `.issues[0]?.message` NO `.errors[0]?.message`.

4. **Service Role Key:** Usar solo en Inngest functions y scripts. Nunca exponer al cliente. Bypasa RLS completamente.

5. **`@base-ui/react` Select:** Tiene un bug conocido donde el popup del dropdown no se renderiza en ciertos contextos. Usar `<select>` HTML nativo con estilos Tailwind como alternativa robusta.

6. **OpenRouter modelos:** Los modelos se devuelven con sufijo de versión fecha (ej: `-2025-04-14`). La función `estimateCostForModel` maneja esto con `modelVariants()`.

7. **Backfill necesario en datos existentes:** Si se añade una nueva columna calculada, hay que crear un script de backfill para los registros históricos.

8. **RLS insert en workspaces:** La política permite `auth.uid() is not null` (sin verificar membresía) porque al crear el workspace el usuario aún no es miembro.

9. **Inngest en desarrollo:** Requiere `npx inngest-cli@latest dev` corriendo en paralelo con `pnpm dev`.

10. **Scroll en páginas:** Cada página debe tener `flex-1 overflow-auto min-h-0` en su wrapper para funcionar dentro del layout con sidebar fijo.
