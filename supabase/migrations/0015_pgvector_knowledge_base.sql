-- =============================================================================
-- 0015: pgvector knowledge base for GEO recommendations RAG
-- =============================================================================

create extension if not exists vector;

create table if not exists knowledge_chunks (
  id              uuid primary key default gen_random_uuid(),
  source_file     text not null,
  source_title    text not null,
  heading_path    text[] not null default '{}',
  content         text not null,
  content_hash    text not null,
  tags            text[] not null default '{}',
  category        text,
  token_count     integer not null,
  embedding       vector(1536) not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists knowledge_chunks_dedup
  on knowledge_chunks(source_file, content_hash);

create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 16);

create index if not exists knowledge_chunks_tags_gin
  on knowledge_chunks using gin(tags);

create index if not exists knowledge_chunks_source_file_idx
  on knowledge_chunks(source_file);

alter table knowledge_chunks enable row level security;

drop policy if exists "knowledge_chunks_read_authenticated" on knowledge_chunks;
create policy "knowledge_chunks_read_authenticated"
  on knowledge_chunks for select to authenticated using (true);

create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  similarity_threshold float default 0.3
)
returns table (
  id uuid,
  source_file text,
  source_title text,
  heading_path text[],
  content text,
  tags text[],
  similarity float
)
language sql stable as $$
  select
    kc.id,
    kc.source_file,
    kc.source_title,
    kc.heading_path,
    kc.content,
    kc.tags,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where 1 - (kc.embedding <=> query_embedding) > similarity_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function match_knowledge_chunks(vector, int, float)
  to authenticated, service_role;

create or replace function set_updated_at_knowledge_chunks()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_knowledge_chunks_updated_at on knowledge_chunks;
create trigger trg_knowledge_chunks_updated_at
  before update on knowledge_chunks
  for each row execute function set_updated_at_knowledge_chunks();
