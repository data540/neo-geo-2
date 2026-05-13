import dotenv from "dotenv";
import { Client } from "pg";
import * as readline from "readline";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL no configurada en .env.local");
  process.exit(1);
}

// Extraer host desde URL de Supabase
// De: https://ydfzkueudfutjpeqozdi.supabase.co
// A: ydfzkueudfutjpeqozdi.db.supabase.co
const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");
const dbHost = `${projectRef}.db.supabase.co`;

const migrations = [
  {
    name: "0001_create_core_tables",
    sql: `
-- =============================================================================
-- 0001: Core tables — profiles, workspaces, workspace_members, brands
-- =============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz default now() not null
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  brand_name text not null,
  domain text,
  brand_statement text,
  country text default 'ES' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz default now() not null,
  primary key (workspace_id, user_id)
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  domain text,
  aliases text[] default '{}' not null,
  type text not null check (type in ('own', 'competitor')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table brand_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  extracted_summary text,
  positioning text,
  audience text,
  products_services text,
  differentiators text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_updated_at
  before update on workspaces
  for each row execute function update_updated_at();

create trigger brands_updated_at
  before update on brands
  for each row execute function update_updated_at();

create trigger brand_profiles_updated_at
  before update on brand_profiles
  for each row execute function update_updated_at();
    `,
  },
  {
    name: "0002_create_prompt_monitoring_tables",
    sql: `
-- =============================================================================
-- 0002: Prompt monitoring tables — providers, prompts, runs, mentions, sources, metrics
-- =============================================================================

create table llm_providers (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  enabled boolean default true not null
);

insert into llm_providers (key, name) values
  ('chatgpt', 'ChatGPT'),
  ('claude', 'Claude'),
  ('gemini', 'Gemini'),
  ('perplexity', 'Perplexity');

create table prompts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  text text not null,
  country text default 'ES' not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table prompt_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  color text default '#6366f1' not null,
  created_at timestamptz default now() not null
);

create table prompt_tag_assignments (
  prompt_id uuid references prompts(id) on delete cascade not null,
  tag_id uuid references prompt_tags(id) on delete cascade not null,
  primary key (prompt_id, tag_id)
);

create table prompt_llms (
  prompt_id uuid references prompts(id) on delete cascade not null,
  llm_provider_id uuid references llm_providers(id) on delete cascade not null,
  primary key (prompt_id, llm_provider_id)
);

create table prompt_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  prompt_id uuid references prompts(id) on delete cascade not null,
  llm_provider_id uuid references llm_providers(id),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  raw_response text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now() not null
);

create table mentions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  prompt_run_id uuid references prompt_runs(id) on delete cascade not null,
  brand_id uuid references brands(id),
  brand_name_detected text,
  brand_type text check (brand_type in ('own', 'competitor')),
  position integer,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative', 'no_data')),
  confidence numeric default 1.0 not null,
  created_at timestamptz default now() not null
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  prompt_run_id uuid references prompt_runs(id) on delete cascade not null,
  url text,
  domain text,
  title text,
  cited_by_llm boolean default false not null,
  created_at timestamptz default now() not null
);

create table daily_prompt_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  prompt_id uuid references prompts(id) on delete cascade not null,
  llm_provider_id uuid references llm_providers(id),
  date date not null,
  brand_mentioned boolean,
  brand_position integer,
  competitor_count integer default 0 not null,
  sov numeric,
  sentiment text,
  consistency_score numeric,
  created_at timestamptz default now() not null,
  unique (prompt_id, llm_provider_id, date)
);

create table daily_workspace_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  llm_provider_id uuid references llm_providers(id),
  date date not null,
  active_prompts_count integer default 0 not null,
  brand_mentions_count integer default 0 not null,
  avg_position numeric,
  brand_consistency numeric,
  avg_sov numeric,
  created_at timestamptz default now() not null,
  unique (workspace_id, llm_provider_id, date)
);

create trigger prompts_updated_at
  before update on prompts
  for each row execute function update_updated_at();
    `,
  },
  {
    name: "0003_create_rls_policies",
    sql: `
-- =============================================================================
-- 0003: Row Level Security — habilitar RLS y crear políticas
-- =============================================================================

alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table brands enable row level security;
alter table brand_profiles enable row level security;
alter table prompts enable row level security;
alter table prompt_tags enable row level security;
alter table prompt_tag_assignments enable row level security;
alter table prompt_llms enable row level security;
alter table prompt_runs enable row level security;
alter table mentions enable row level security;
alter table sources enable row level security;
alter table daily_prompt_metrics enable row level security;
alter table daily_workspace_metrics enable row level security;

alter table llm_providers enable row level security;
create policy "llm_providers: public read" on llm_providers
  for select using (true);

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
      and role in ('owner', 'admin')
  );
$$;

create policy "profiles: own select" on profiles
  for select using (id = auth.uid());

create policy "profiles: own insert" on profiles
  for insert with check (id = auth.uid());

create policy "profiles: own update" on profiles
  for update using (id = auth.uid());

create policy "workspaces: member select" on workspaces
  for select using (is_workspace_member(id));

create policy "workspaces: authenticated insert" on workspaces
  for insert with check (auth.uid() is not null);

create policy "workspaces: admin update" on workspaces
  for update using (can_manage_workspace(id));

create policy "workspaces: owner delete" on workspaces
  for delete using (
    exists (
      select 1 from workspace_members
      where workspace_id = id and user_id = auth.uid() and role = 'owner'
    )
  );

create policy "wm: member select" on workspace_members
  for select using (is_workspace_member(workspace_id));

create policy "wm: authenticated insert" on workspace_members
  for insert with check (auth.uid() is not null);

create policy "wm: admin delete" on workspace_members
  for delete using (can_manage_workspace(workspace_id));

do $$ declare t text; begin
  foreach t in array array[
    'brands', 'brand_profiles', 'prompts', 'prompt_tags',
    'prompt_runs', 'mentions', 'sources',
    'daily_prompt_metrics', 'daily_workspace_metrics'
  ] loop
    execute format(
      'create policy "%s: member select" on %s for select using (is_workspace_member(workspace_id))',
      t, t
    );
    execute format(
      'create policy "%s: admin insert" on %s for insert with check (can_manage_workspace(workspace_id))',
      t, t
    );
    execute format(
      'create policy "%s: admin update" on %s for update using (can_manage_workspace(workspace_id))',
      t, t
    );
    execute format(
      'create policy "%s: admin delete" on %s for delete using (can_manage_workspace(workspace_id))',
      t, t
    );
  end loop;
end $$;

create policy "pta: member select" on prompt_tag_assignments
  for select using (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and is_workspace_member(p.workspace_id)
    )
  );

create policy "pta: admin insert" on prompt_tag_assignments
  for insert with check (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and can_manage_workspace(p.workspace_id)
    )
  );

create policy "pta: admin delete" on prompt_tag_assignments
  for delete using (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and can_manage_workspace(p.workspace_id)
    )
  );

create policy "pl: member select" on prompt_llms
  for select using (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and is_workspace_member(p.workspace_id)
    )
  );

create policy "pl: admin insert" on prompt_llms
  for insert with check (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and can_manage_workspace(p.workspace_id)
    )
  );

create policy "pl: admin delete" on prompt_llms
  for delete using (
    exists (
      select 1 from prompts p
      where p.id = prompt_id and can_manage_workspace(p.workspace_id)
    )
  );
    `,
  },
  {
    name: "0004_create_metric_views_or_functions",
    sql: `
-- =============================================================================
-- 0004: Funciones SQL para métricas y vistas de performance
-- =============================================================================

create or replace function get_workspace_prompt_performance(
  p_workspace_slug text,
  p_llm_key text default 'chatgpt',
  p_country_filter text default null
)
returns table (
  prompt_id uuid,
  prompt_text text,
  prompt_status text,
  prompt_country text,
  prompt_intent text,
  prompt_funnel_stage text,
  prompt_persona text,
  includes_brand boolean,
  priority_score smallint,
  brand_mentioned boolean,
  brand_position integer,
  competitor_count integer,
  sov numeric,
  sentiment text,
  consistency_score numeric,
  last_run_at timestamptz,
  rank bigint
)
language sql security definer stable as $$
  with latest_metrics as (
    select distinct on (dpm.prompt_id)
      dpm.prompt_id,
      dpm.brand_mentioned,
      dpm.brand_position,
      dpm.competitor_count,
      dpm.sov,
      dpm.sentiment,
      dpm.consistency_score,
      dpm.date
    from daily_prompt_metrics dpm
    join llm_providers lp on lp.id = dpm.llm_provider_id
    join workspaces w on w.id = dpm.workspace_id
    where w.slug = p_workspace_slug
      and lp.key = p_llm_key
    order by dpm.prompt_id, dpm.date desc
  ),
  last_runs as (
    select distinct on (pr.prompt_id)
      pr.prompt_id,
      pr.completed_at
    from prompt_runs pr
    join llm_providers lp on lp.id = pr.llm_provider_id
    join workspaces w on w.id = pr.workspace_id
    where w.slug = p_workspace_slug
      and lp.key = p_llm_key
      and pr.status = 'completed'
    order by pr.prompt_id, pr.completed_at desc
  )
  select
    p.id as prompt_id,
    p.text as prompt_text,
    p.status as prompt_status,
    p.country as prompt_country,
    p.intent as prompt_intent,
    p.funnel_stage as prompt_funnel_stage,
    p.persona as prompt_persona,
    coalesce(p.includes_brand, false) as includes_brand,
    p.priority_score,
    coalesce(lm.brand_mentioned, false) as brand_mentioned,
    lm.brand_position,
    coalesce(lm.competitor_count, 0) as competitor_count,
    lm.sov,
    coalesce(lm.sentiment, 'no_data') as sentiment,
    coalesce(lm.consistency_score, 0) as consistency_score,
    lr.completed_at as last_run_at,
    row_number() over (
      order by
        coalesce(lm.brand_mentioned, false) desc,
        lm.brand_position asc nulls last,
        coalesce(lm.sov, 0) desc
    ) as rank
  from prompts p
  join workspaces w on w.id = p.workspace_id
  left join latest_metrics lm on lm.prompt_id = p.id
  left join last_runs lr on lr.prompt_id = p.id
  where w.slug = p_workspace_slug
    and (p_country_filter is null or p.country = p_country_filter)
  order by
    coalesce(lm.brand_mentioned, false) desc,
    lm.brand_position asc nulls last,
    coalesce(lm.sov, 0) desc;
$$;

create or replace function get_workspace_kpis(
  p_workspace_slug text,
  p_llm_key text default 'chatgpt'
)
returns table (
  active_prompts_count bigint,
  brand_mentions_count bigint,
  avg_position numeric,
  brand_consistency numeric,
  avg_sov numeric
)
language sql security definer stable as $$
  with latest_metrics as (
    select distinct on (dpm.prompt_id)
      dpm.prompt_id,
      dpm.brand_mentioned,
      dpm.brand_position,
      dpm.sov,
      dpm.consistency_score
    from daily_prompt_metrics dpm
    join llm_providers lp on lp.id = dpm.llm_provider_id
    join workspaces w on w.id = dpm.workspace_id
    join prompts p on p.id = dpm.prompt_id
    where w.slug = p_workspace_slug
      and lp.key = p_llm_key
      and p.status = 'active'
    order by dpm.prompt_id, dpm.date desc
  )
  select
    count(distinct p.id)::bigint as active_prompts_count,
    count(distinct case when lm.brand_mentioned then lm.prompt_id end)::bigint as brand_mentions_count,
    round(
      avg(lm.brand_position) filter (where lm.brand_mentioned and lm.brand_position is not null),
      1
    ) as avg_position,
    round(
      (count(distinct case when coalesce(lm.consistency_score, 0) >= 70 then p.id end)::numeric /
       nullif(count(distinct p.id), 0)::numeric * 100),
      1
    ) as brand_consistency,
    round(avg(lm.sov) filter (where lm.sov is not null), 1) as avg_sov
  from prompts p
  join workspaces w on w.id = p.workspace_id
  left join latest_metrics lm on lm.prompt_id = p.id
  where w.slug = p_workspace_slug
    and p.status = 'active';
$$;
    `,
  },
  {
    name: "0005_add_prompt_metadata",
    sql: `
-- =============================================================================
-- 0005: Metadatos de prompts para GEO Research Skill
-- =============================================================================

alter table prompts
  add column if not exists intent text check (intent in (
    'discovery', 'comparison', 'reputation', 'branded',
    'decision', 'local', 'price', 'employability', 'product_specific'
  )),
  add column if not exists funnel_stage text check (funnel_stage in ('top', 'middle', 'bottom')),
  add column if not exists persona text,
  add column if not exists includes_brand boolean default false,
  add column if not exists includes_competitor boolean default false,
  add column if not exists strategic_value smallint check (strategic_value between 1 and 10),
  add column if not exists conversion_intent smallint check (conversion_intent between 1 and 10),
  add column if not exists ai_search_likelihood smallint check (ai_search_likelihood between 1 and 10),
  add column if not exists priority_score smallint check (priority_score between 1 and 100),
  add column if not exists research_reason text,
  add column if not exists coverage_area text;
    `,
  },
  {
    name: "0006_create_prompt_candidates",
    sql: `
-- =============================================================================
-- 0006: Tabla temporal para candidatos del GEO Research Wizard
-- =============================================================================

create table prompt_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  session_id uuid not null,
  prompt text not null,
  intent text check (intent in (
    'discovery', 'comparison', 'reputation', 'branded',
    'decision', 'local', 'price', 'employability', 'product_specific'
  )),
  funnel_stage text check (funnel_stage in ('top', 'middle', 'bottom')),
  persona text,
  country text default 'ES',
  includes_brand boolean default false,
  includes_competitor boolean default false,
  strategic_value smallint check (strategic_value between 1 and 10),
  conversion_intent smallint check (conversion_intent between 1 and 10),
  ai_search_likelihood smallint check (ai_search_likelihood between 1 and 10),
  priority_score smallint check (priority_score between 1 and 100),
  priority_rank integer,
  reason text,
  coverage_area text,
  risk_if_brand_absent text check (risk_if_brand_absent in ('low', 'medium', 'high')),
  tags text[] default '{}',
  selected boolean default true not null,
  activated boolean default false not null,
  created_at timestamptz default now() not null
);

alter table prompt_candidates enable row level security;

create policy "pc: member select" on prompt_candidates
  for select using (is_workspace_member(workspace_id));

create policy "pc: admin insert" on prompt_candidates
  for insert with check (can_manage_workspace(workspace_id));

create policy "pc: admin update" on prompt_candidates
  for update using (can_manage_workspace(workspace_id));

create policy "pc: admin delete" on prompt_candidates
  for delete using (can_manage_workspace(workspace_id));

create or replace function cleanup_old_prompt_candidates()
returns void language sql as $$
  delete from prompt_candidates
  where created_at < now() - interval '7 days' and activated = false;
$$;
    `,
  },
];

function question(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function migrate() {
  console.log("🚀 neo-geo Database Migration\n");

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ DATABASE_URL no está en .env.local");
    console.log("\n📋 Obtén la connection string desde Supabase:");
    console.log("   1. Dashboard → Connect");
    console.log("   2. Connection info → Direct Connection");
    console.log("   3. Copia la URL completa");
    console.log("   4. Agrega a .env.local:\n");
    console.log("      DATABASE_URL=postgresql://postgres:PASSWORD@host:5432/postgres\n");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
  });

  try {
    console.log("🔗 Conectando a Supabase...\n");
    await client.connect();
    console.log("✅ Conectado a Supabase\n");

    for (let i = 0; i < migrations.length; i++) {
      const migration = migrations[i];
      if (!migration) continue;

      console.log(`📝 Ejecutando ${migration.name}...`);

      try {
        await client.query(migration.sql);
        console.log(`  ✓ Completado\n`);
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          console.log(`  ⚠ Saltado (ya existe)\n`);
        } else {
          console.error(`  ❌ Error: ${error.message}\n`);
          throw error;
        }
      }
    }

    console.log("✅ Todas las migraciones completadas\n");
    console.log("📊 Estado de la BD:");
    console.log("   ✓ Tablas de autenticación y workspaces");
    console.log("   ✓ Tablas de prompts y monitorización");
    console.log("   ✓ Políticas de Row Level Security (RLS)");
    console.log("   ✓ Funciones SQL para KPIs");
    console.log("   ✓ Metadatos GEO Research\n");

    console.log("🌱 Siguiente paso: pnpm seed\n");
  } catch (error) {
    console.error("❌ Error durante migración:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
