-- OAuth 2.1 para el servidor MCP (/api/mcp).
-- Permite que clientes MCP (Claude, ChatGPT) se conecten sin pegar API key:
-- se registran solos (DCR), el usuario autoriza en una pantalla de consentimiento,
-- y reciben tokens opacos (solo se guarda el hash sha256). Solo lectura, un token
-- resuelve a un único workspace. Convive con mcp_api_keys (keys manuales mnt_live_).

-- Clientes MCP que se auto-registran (Dynamic Client Registration, RFC 7591).
create table if not exists public.mcp_oauth_clients (
  client_id     text primary key,
  client_name   text,
  redirect_uris text[] not null,
  created_at    timestamptz not null default now()
);

comment on table public.mcp_oauth_clients is
  'Clientes MCP registrados vía Dynamic Client Registration. Públicos (sin secreto), PKCE obligatorio.';

-- Códigos de autorización efímeros (un solo uso, ~60s).
create table if not exists public.mcp_oauth_codes (
  id                    uuid primary key default gen_random_uuid(),
  code_hash             text not null unique,
  client_id             text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  redirect_uri          text not null,
  code_challenge        text not null,
  code_challenge_method text not null default 'S256',
  scope                 text,
  expires_at            timestamptz not null,
  consumed_at           timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists mcp_oauth_codes_hash_idx on public.mcp_oauth_codes (code_hash) where consumed_at is null;

comment on table public.mcp_oauth_codes is
  'Códigos de autorización OAuth de un solo uso. Ligados a PKCE (code_challenge S256).';

-- Tokens emitidos (access + refresh). Mismo patrón hash que mcp_api_keys.
create table if not exists public.mcp_oauth_tokens (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  refresh_hash text unique,
  client_id    text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  client_name  text,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists mcp_oauth_tokens_access_idx on public.mcp_oauth_tokens (token_hash) where revoked_at is null;
create index if not exists mcp_oauth_tokens_refresh_idx on public.mcp_oauth_tokens (refresh_hash) where revoked_at is null;
create index if not exists mcp_oauth_tokens_workspace_idx on public.mcp_oauth_tokens (workspace_id);

comment on table public.mcp_oauth_tokens is
  'Tokens OAuth de solo lectura para el servidor MCP. Solo se guarda el hash. Revocables (revoked_at).';

-- RLS. La resolución/emisión de tokens la hace solo el service role (bypassea RLS).
-- Los gestores del workspace pueden LISTAR sus conexiones OAuth para revocarlas.
alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes   enable row level security;
alter table public.mcp_oauth_tokens  enable row level security;

drop policy if exists "mcp_oauth_tokens_select_managers" on public.mcp_oauth_tokens;
create policy "mcp_oauth_tokens_select_managers" on public.mcp_oauth_tokens
  for select using (public.can_manage_workspace(workspace_id));
