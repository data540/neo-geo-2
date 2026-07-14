-- API keys para el servidor MCP (Model Context Protocol).
-- Cada key pertenece a un workspace y da acceso de SOLO LECTURA a sus datos
-- a través del endpoint /api/mcp. Las keys se acuñan server-side (service role)
-- y solo se guarda el hash sha256 — el valor en claro se muestra una única vez.
create table if not exists public.mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null default 'default',
  key_prefix text not null,                 -- primeros chars para identificar la key en la UI (no secreto)
  key_hash text not null unique,            -- sha256 hex de la key completa
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists mcp_api_keys_workspace_idx on public.mcp_api_keys (workspace_id);
create index if not exists mcp_api_keys_hash_idx on public.mcp_api_keys (key_hash) where revoked_at is null;

comment on table public.mcp_api_keys is
  'API keys de solo lectura para el servidor MCP (/api/mcp). Se guarda solo el hash; una key por línea de acceso de LLM (Claude, ChatGPT).';

-- RLS: los gestores del workspace pueden LISTAR sus keys (metadatos, nunca el hash útil).
-- La escritura y la resolución de keys las hace exclusivamente el service role (bypassea RLS).
alter table public.mcp_api_keys enable row level security;

drop policy if exists "mcp_keys_select_managers" on public.mcp_api_keys;
create policy "mcp_keys_select_managers" on public.mcp_api_keys
  for select using (public.can_manage_workspace(workspace_id));
