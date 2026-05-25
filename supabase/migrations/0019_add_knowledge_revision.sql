-- Añade knowledge_revision a workspaces para invalidar pipeline_cache cuando cambia la KB.
-- El indexer actualiza este campo tras cada reindexación; el hash del input canónico lo incluye,
-- por lo que el cambio invalida automáticamente el caché sin necesidad de DELETE.

alter table workspaces
  add column if not exists knowledge_revision text not null default 'v0';

comment on column workspaces.knowledge_revision is
  'Incrementa cada vez que se reindexa la knowledge base (pnpm kb:index). Incluido en el input canónico del pipeline_cache para invalidación automática.';
