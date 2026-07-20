-- Alcance concedido a cada token OAuth del MCP. Las filas existentes antes de
-- esta migración quedan en 'mcp:read' (default) — ninguna conexión ya emitida
-- gana escritura silenciosamente; solo las que vuelvan a pasar por /authorize
-- tras este cambio reciben 'mcp:read mcp:write'.
alter table public.mcp_oauth_tokens
  add column if not exists scope text not null default 'mcp:read';

comment on column public.mcp_oauth_tokens.scope is
  'Alcance OAuth concedido al emitir el token (espacio-separado, p. ej. "mcp:read mcp:write"). Filas previas a esta migración quedan en mcp:read por defecto.';
