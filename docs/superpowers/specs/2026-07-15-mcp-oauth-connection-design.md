# Diseño — Conexión OAuth para el servidor MCP de Mentio

**Fecha:** 2026-07-15
**Estado:** aprobado, pendiente de plan de implementación
**Autor:** David + Claude Code

## Objetivo

Que un cliente de Mentio pueda conectar Claude (Claude.ai / Desktop) o ChatGPT
a su workspace vía MCP **sin copiar ni pegar ninguna API key**: pega solo la URL
del servidor, pulsa *Connect*, hace login en Mentio, autoriza, y queda conectado.

Es la única vía que hace la unión "de un clic" para el chat web de Claude/ChatGPT,
porque esas superficies **no pueden** auto-configurarse un conector MCP ni generar
credenciales desde dentro de la conversación (limitación de plataforma, no de
Mentio). El token OAuth se negocia por debajo, sin intervención manual del usuario.

## Alcance

**Incluye:**
- Servidor de autorización OAuth 2.1 propio (PKCE + Dynamic Client Registration),
  self-hosted dentro de la misma app Next.js.
- Endpoints de metadata que los clientes MCP descubren automáticamente.
- Pantalla de login + consentimiento reutilizando la sesión Supabase existente.
- Validación de los nuevos access tokens en el endpoint `/api/mcp` ya existente,
  **conviviendo** con las API keys `mnt_live_` actuales.
- Gestión (listado + revocación) de conexiones OAuth activas en la página MCP del
  workspace.

**No incluye:**
- Deprecar las API keys manuales (`mnt_live_`): se mantienen para Claude Code /
  agentes CLI / curl.
- Publicar Mentio en el directorio de conectores de Anthropic.
- Cambiar las 11 tools ni su lógica (siguen resolviendo a un único `ResolvedWorkspace`).

## Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Servidor OAuth | **Propio, en Next.js** | Sin dependencias ni coste; reutiliza login Supabase y el patrón hash+BD de `mcp_api_keys`; control total. |
| Quién autoriza | **Solo owners/admins** del workspace | Coherente con las API keys (owners-only); una conexión OAuth da lectura a todas las métricas del workspace. |
| API keys manuales | **Se mantienen** | OAuth para chat web; keys para Claude Code / CLI / curl, donde un Bearer fijo es más cómodo. |
| Formato de token | **Opaco, hasheado en BD** | Revocable desde la UI (a diferencia de un JWT); mismo patrón que `mcp_api_keys`. |
| Alcance del token | **Un token = un workspace** | Mantiene el aislamiento actual: ninguna tool acepta workspace como parámetro. |

## Flujo del usuario final

```
1. Claude.ai / ChatGPT → Ajustes → Conectores → Añadir
2. Pega la URL:  https://neogeo-three.vercel.app/api/mcp
3. El cliente hace POST /api/mcp sin token → 401 + WWW-Authenticate
     → descubre el authorization server vía /.well-known/*
4. El cliente se registra solo (Dynamic Client Registration) → obtiene client_id
5. El cliente abre /authorize en una ventana:
     - sin sesión Mentio → redirige a /login → vuelve a /authorize
     - con sesión → pantalla de consentimiento:
         "Claude quiere leer los datos GEO (solo lectura) de: [selector workspace]"
         (solo workspaces donde el usuario es owner/admin)
     - Autorizar → genera authorization_code → redirige al redirect_uri del cliente
6. El cliente intercambia el code en /token (con PKCE code_verifier)
     → access_token (mnt_at_, ~1h) + refresh_token (mnt_rt_, rota)
7. El cliente usa access_token como Bearer en POST /api/mcp → conectado
```

## Arquitectura técnica

Todo vive en la app Next.js existente (App Router), desplegada con Vercel. No hay
proceso aparte. El servidor MCP sigue sin usar el SDK de MCP (evita el conflicto
zod v3/v4); el OAuth se implementa directamente sobre los estándares.

### Endpoints nuevos (todos públicos, fuera del middleware de auth)

| Endpoint | Método | Estándar | Función |
|---|---|---|---|
| `/.well-known/oauth-protected-resource` | GET | RFC 9728 | Declara qué authorization server protege `/api/mcp`. |
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 | Metadata: authorize/token/registration endpoints, `code_challenge_methods_supported: ["S256"]`, grant types `authorization_code` + `refresh_token`. |
| `/api/mcp/oauth/register` | POST | RFC 7591 | Dynamic Client Registration. Alta de cliente público (sin secreto). Persiste `client_id` + `redirect_uris`. |
| `/api/mcp/oauth/authorize` | GET/POST | OAuth 2.1 | GET: pantalla de login+consentimiento. POST: submit del consentimiento → emite código y redirige. |
| `/api/mcp/oauth/token` | POST | OAuth 2.1 | Intercambia `code`+`code_verifier` por tokens; también `grant_type=refresh_token`. |

### Cambios en endpoints existentes

- **`src/app/api/mcp/route.ts`** — el `401` pasa a devolver
  `WWW-Authenticate: Bearer resource_metadata="https://…/.well-known/oauth-protected-resource"`
  para arrancar el flujo OAuth en clientes que aún no tienen token.
- **`src/lib/mcp/auth.ts`** — `resolveWorkspaceFromAuth` distingue por prefijo del
  token:
  - `mnt_live_…` → tabla `mcp_api_keys` (comportamiento actual, sin cambios).
  - `mnt_at_…` → tabla `mcp_oauth_tokens` (valida no-expirado y no-revocado,
    actualiza `last_used_at`).
  Ambos caminos devuelven el mismo `ResolvedWorkspace`; las 11 tools no cambian.
- **`middleware.ts`** — añadir a la exclusión del matcher los paths públicos nuevos
  (`/.well-known/oauth-*` y `/api/mcp/oauth/*`). `/authorize` gestiona su propio
  login (lee la cookie Supabase; si no hay sesión, redirige a `/login`).

### Modelo de datos (migración nueva)

```sql
-- Clientes MCP que se auto-registran (Dynamic Client Registration).
mcp_oauth_clients (
  client_id      text primary key,      -- generado por nosotros en /register
  client_name    text,
  redirect_uris  text[] not null,       -- lista blanca para validar en /authorize y /token
  created_at     timestamptz default now()
)

-- Códigos de autorización efímeros (un solo uso).
mcp_oauth_codes (
  id                    uuid primary key default gen_random_uuid(),
  code_hash             text not null unique,     -- sha256 del código
  client_id             text not null references mcp_oauth_clients,
  workspace_id          uuid not null references workspaces,
  user_id               uuid not null,            -- auth.users
  redirect_uri          text not null,
  code_challenge        text not null,            -- PKCE
  code_challenge_method text not null default 'S256',
  expires_at            timestamptz not null,     -- ~60s
  consumed_at           timestamptz,
  created_at            timestamptz default now()
)

-- Tokens emitidos (access + refresh), mismo patrón que mcp_api_keys.
mcp_oauth_tokens (
  id             uuid primary key default gen_random_uuid(),
  token_hash     text not null unique,   -- sha256 del access token  (mnt_at_)
  refresh_hash   text unique,            -- sha256 del refresh token (mnt_rt_)
  client_id      text not null references mcp_oauth_clients,
  workspace_id   uuid not null references workspaces,
  user_id        uuid not null,
  expires_at     timestamptz not null,   -- access ~1h
  revoked_at     timestamptz,
  last_used_at   timestamptz,
  created_at     timestamptz default now()
)
```

Todas con RLS activo. El servidor MCP y los endpoints OAuth acceden con service
role (como el resto del MCP). La UI de la app (listar/revocar conexiones) usa el
cliente con cookies + `can_manage_workspace`.

### Tokens

- **Access token** (`mnt_at_` + 48 hex): TTL ~1h, guardado hasheado (sha256).
- **Refresh token** (`mnt_rt_` + 48 hex): larga duración, **rota en cada uso**
  (el `/token` con `grant_type=refresh_token` emite uno nuevo e invalida el
  anterior).
- Reutiliza `generateApiKey()`/`hashApiKey()` de `auth.ts` generalizados por prefijo.

## Autorización y consentimiento

`/api/mcp/oauth/authorize`:
1. Lee la sesión Supabase (cookies). Sin `user` → `redirect('/login?redirect=<authorize-url-con-query>')`.
2. Con `user`, consulta `workspace_members` join `workspaces` filtrando
   `role in ('owner','admin')`.
   - 0 workspaces → pantalla "No tienes permisos para conectar por MCP" (no emite código).
   - 1 → preseleccionado. Varios → selector.
3. Muestra consentimiento: nombre del cliente (de DCR), workspace elegido,
   alcance "solo lectura", botones **Autorizar** / **Cancelar**.
4. **Autorizar** (POST): valida que `redirect_uri` ∈ `mcp_oauth_clients.redirect_uris`
   del `client_id`; genera `authorization_code`; lo persiste con `code_challenge`,
   `workspace_id`, `user_id`, `expires_at`; redirige a `redirect_uri?code=…&state=…`.
5. **Cancelar** → redirige con `error=access_denied`.

`/api/mcp/oauth/token` (`grant_type=authorization_code`):
- Valida el código (existe, no consumido, no caducado, `client_id` y `redirect_uri`
  coinciden).
- Valida PKCE: `SHA256(code_verifier)` base64url == `code_challenge`.
- Marca el código como consumido (un solo uso).
- Emite access + refresh, los persiste hasheados en `mcp_oauth_tokens`.

## Seguridad

- **Solo lectura**, igual que hoy. No hay tools de escritura.
- **Aislamiento por workspace**: un token resuelve a un único `workspace_id`.
- **PKCE S256 obligatorio**; clientes públicos sin secreto.
- **Códigos** de un solo uso, caducidad ~60s, `redirect_uri` en lista blanca.
- **Refresh rotativo**; revocación desde la UI (marca `revoked_at`).
- **Sin secretos en claro en BD**: solo hashes sha256.
- La página MCP del workspace lista **conexiones OAuth activas** (cliente, workspace,
  último uso) con botón Revocar, junto a las API keys manuales.

## Manejo de errores

| Situación | Respuesta |
|---|---|
| POST `/api/mcp` sin token / token inválido / caducado / revocado | `401` + `WWW-Authenticate` con `resource_metadata`. |
| `/authorize` sin sesión Supabase | Redirige a `/login?redirect=…`, vuelve tras login. |
| Usuario sin workspace owner/admin | Pantalla "sin permisos", no emite código. |
| `redirect_uri` no registrado | `400 invalid_request` (no redirige, evita open-redirect). |
| Código caducado/consumido en `/token` | `400 invalid_grant`. |
| PKCE no cuadra | `400 invalid_grant`. |
| Refresh token revocado/desconocido | `400 invalid_grant`. |

## Testing / verificación

- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`.
- **E2E real**: conectar Claude.ai (o ChatGPT) contra el deploy, completar el flujo
  OAuth y confirmar que `get_workspace_overview` responde vía access token OAuth.
- **Casos borde**: usuario no-owner (bloqueado), código caducado, refresh que rota,
  revocación desde la UI corta el acceso.
- **No romper lo existente**: una API key `mnt_live_` sigue funcionando en paralelo.

## Archivos afectados (estimación)

- `middleware.ts` — exclusiones de matcher.
- `src/app/api/mcp/route.ts` — cabecera `WWW-Authenticate` en el 401.
- `src/lib/mcp/auth.ts` — resolución dual de token por prefijo + helpers de token.
- `src/app/.well-known/oauth-protected-resource/route.ts` — nuevo.
- `src/app/.well-known/oauth-authorization-server/route.ts` — nuevo.
- `src/app/api/mcp/oauth/register/route.ts` — nuevo.
- `src/app/api/mcp/oauth/authorize/route.ts` (+ UI de consentimiento) — nuevo.
- `src/app/api/mcp/oauth/token/route.ts` — nuevo.
- `src/lib/mcp/oauth.ts` — lógica compartida (PKCE, códigos, tokens) — nuevo.
- Migración SQL `0043_mcp_oauth.sql` — 3 tablas + RLS.
- `src/actions/mcp.ts` + `McpKeysPanel.tsx` — listar/revocar conexiones OAuth.
- `docs/mcp-server.md` — documentar el flujo OAuth para clientes.
```
