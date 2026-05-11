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

-- updated_at triggers
create trigger prompts_updated_at
  before update on prompts
  for each row execute function update_updated_at();
