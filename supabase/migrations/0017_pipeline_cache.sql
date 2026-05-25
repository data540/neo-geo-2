-- Pipeline cache: caché semántico por fase del pipeline propietario de generación de prompts.
-- Estrategia: lookup exacto por input_hash (sha256), fallback a cosine similarity con threshold 0.95.

create table pipeline_cache (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  phase           text not null check (phase in ('generation', 'normalize', 'audit', 'prioritize')),
  input_hash      text not null,
  input_embedding vector(1536) not null,
  input_summary   text not null,
  output_jsonb    jsonb not null,
  model_used      text not null,
  hit_count       integer not null default 0,
  cost_saved_usd  numeric(10,6) not null default 0,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  invalidated_at  timestamptz
);

create unique index pipeline_cache_exact
  on pipeline_cache(workspace_id, phase, input_hash)
  where invalidated_at is null;

create index pipeline_cache_embedding
  on pipeline_cache using ivfflat (input_embedding vector_cosine_ops)
  with (lists = 32);

create index pipeline_cache_expires
  on pipeline_cache(expires_at)
  where invalidated_at is null;

-- RLS
alter table pipeline_cache enable row level security;

create policy "workspace members can read pipeline_cache"
  on pipeline_cache for select
  using (is_workspace_member(workspace_id));

create policy "service role can manage pipeline_cache"
  on pipeline_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- RPC para búsqueda semántica
create or replace function match_pipeline_cache(
  p_workspace_id  uuid,
  p_phase         text,
  p_query_embedding vector(1536),
  p_threshold     float default 0.95
)
returns table (
  id              uuid,
  output_jsonb    jsonb,
  model_used      text,
  similarity      float
)
language sql stable
as $$
  select
    pc.id,
    pc.output_jsonb,
    pc.model_used,
    1 - (pc.input_embedding <=> p_query_embedding) as similarity
  from pipeline_cache pc
  where
    pc.workspace_id = p_workspace_id
    and pc.phase = p_phase
    and pc.invalidated_at is null
    and pc.expires_at > now()
    and 1 - (pc.input_embedding <=> p_query_embedding) >= p_threshold
  order by pc.input_embedding <=> p_query_embedding
  limit 1;
$$;
