-- Rate limit para /api/mcp/oauth/register (Dynamic Client Registration).
-- DCR es público por diseño (RFC 7591, sin credencial previa) — este log
-- por IP acota el abuso sin bloquear el uso legítimo (varios clientes MCP
-- reales pueden registrarse desde la misma IP/NAT corporativa).
create table if not exists public.mcp_oauth_register_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_register_attempts_ip_idx
  on public.mcp_oauth_register_attempts (ip_hash, created_at);

comment on table public.mcp_oauth_register_attempts is
  'Log de intentos de registro DCR por IP (hasheada), para throttling. Sin RLS: solo el service role del servidor MCP escribe/lee aquí.';

alter table public.mcp_oauth_register_attempts enable row level security;
-- Sin policies: deny-all para clientes normales; el service role bypassea RLS.
