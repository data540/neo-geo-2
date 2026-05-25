-- Pipeline runs: trazabilidad de cada fase del pipeline propietario de generación de prompts.
-- Permite analizar coste, latencia, cache hits y errores por fase.

create table pipeline_runs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  session_id      uuid not null,
  phase           text not null check (phase in (
                    'init', 'retrieve_knowledge',
                    'generation_a', 'generation_b',
                    'dedup', 'normalize', 'validate',
                    'audit', 'prioritize', 'finalize'
                  )),
  model_used      text,
  status          text not null check (status in (
                    'queued', 'running', 'completed',
                    'failed', 'cancelled', 'cache_hit'
                  )),
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(10,6),
  duration_ms     integer,
  cache_hit       boolean not null default false,
  cache_id        uuid references pipeline_cache(id),
  retry_count     integer not null default 0,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index pipeline_runs_session
  on pipeline_runs(session_id, created_at);

create index pipeline_runs_workspace
  on pipeline_runs(workspace_id, created_at desc);

-- RLS
alter table pipeline_runs enable row level security;

create policy "workspace members can read pipeline_runs"
  on pipeline_runs for select
  using (is_workspace_member(workspace_id));

create policy "service role can manage pipeline_runs"
  on pipeline_runs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
