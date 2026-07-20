# Diseño — Escritura en el MCP: crear prompts (`mcp:write`)

**Fecha:** 2026-07-20
**Estado:** aprobado, pendiente de plan de implementación
**Autor:** David + Claude Code

## Objetivo

Permitir que un cliente MCP conectado por OAuth (Claude, ChatGPT) **cree prompts**
en el workspace, además de leer datos. Hasta ahora el servidor MCP de Mentio es
estrictamente de solo lectura — este cambio introduce la primera capacidad de
escritura, con un alcance (`scope`) OAuth explícito y separado de la lectura,
para no otorgar silenciosamente un permiso nuevo a conexiones ya autorizadas.

## Alcance

**Incluye:**
- Alcance OAuth nuevo `mcp:write`, mostrado explícitamente en la pantalla de
  consentimiento junto al de lectura (`mcp:read`).
- Columna `scope` en `mcp_oauth_tokens` (no existe hoy), propagada en la emisión
  de tokens (`authorization_code` y `refresh_token`).
- Tool MCP nueva: `create_prompt` (crea un prompt en estado `paused`, sin
  ejecución automática).
- Filtrado de `tools/list` según el scope del token: `create_prompt` solo se
  lista si el token tiene `mcp:write`.

**No incluye:**
- Cualquier otra escritura (editar, borrar, activar/pausar, ejecutar prompts,
  crear/editar competidores, etc.) — estrictamente `create_prompt`, nada más.
- Selector granular de permisos en el consentimiento (checkboxes por permiso)
  — se autorizan `mcp:read` + `mcp:write` juntos con un único clic.
- Cambios en las API keys manuales (`mnt_live_`): siguen siendo exclusivamente
  de solo lectura, sin ningún camino para obtener `mcp:write`.
- Cambios en el modelo de negociación de scope del cliente (no se parsea un
  parámetro `scope` en la request de `/authorize`): el servidor concede siempre
  el conjunto fijo `mcp:read mcp:write` a toda conexión OAuth nueva.

## Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Alcance de la escritura | **OAuth únicamente, nunca API keys manuales** | Las API keys no tienen concepto de scope; introducirlo ahí es una superficie nueva innecesaria para un único caso de uso (Claude Code ya usa solo lectura). |
| Conexiones OAuth ya autorizadas | **Quedan en `mcp:read` para siempre** | No se puede otorgar silenciosamente un permiso nuevo a un consentimiento ya dado; el usuario debe volver a autorizar para conceder escritura. |
| Estado inicial del prompt creado | **`paused`, no `active`** | Un cliente LLM que cree varios prompts sin supervisión humana en el momento no debe generar coste real de OpenRouter hasta que un humano los revise y active en `/prompts`. |
| Selector de permisos en consentimiento | **Fijo (ambos juntos), no granular** | Una sola capacidad de escritura no justifica una UI de selección por permiso; YAGNI. Se revisita si se añaden más tools de escritura en el futuro. |

## Flujo

```
Cliente OAuth nuevo → /authorize
  → pantalla de consentimiento: "Leer tus datos GEO" + "Crear prompts en tu workspace"
  → Autorizar → code (scope: "mcp:read mcp:write") → /token
  → access_token con scope "mcp:read mcp:write" (persistido en mcp_oauth_tokens.scope)
  → tools/list → incluye create_prompt (porque el token tiene mcp:write)
  → tools/call create_prompt {text, country?}
  → insert prompts (status: "paused") → el humano lo activa manualmente en /prompts
```

Una conexión OAuth **anterior a este cambio** (o una API key `mnt_live_`) sigue
viendo `tools/list` sin `create_prompt`, y si de todos modos se llama a la tool
por nombre, la respuesta es un error MCP explícito (no un 500, no un insert
silencioso).

## Arquitectura técnica

### Modelo de datos (migración nueva)

```sql
alter table public.mcp_oauth_tokens
  add column if not exists scope text not null default 'mcp:read';
```

- El valor por defecto (`'mcp:read'`) cubre las filas existentes: ninguna
  conexión ya emitida gana escritura por la migración en sí.
- `mcp_oauth_codes` ya tiene columna `scope` (migración 0043) — se usa tal cual,
  copiando su valor a `mcp_oauth_tokens.scope` al emitir el access token.

### Cambios en `src/app/api/mcp/oauth/authorize/route.ts`

- La pantalla de consentimiento (GET) añade una segunda línea de permiso:
  "Crear prompts en tu workspace" junto a la de lectura ya existente.
- El insert en `mcp_oauth_codes` (POST) fija `scope: "mcp:read mcp:write"` para
  toda autorización nueva (constante, no viene del cliente).

### Cambios en `src/app/api/mcp/oauth/token/route.ts`

- `issueTokens()` recibe y persiste `scope` (columna nueva) al insertar en
  `mcp_oauth_tokens`.
- Grant `authorization_code`: `scope` viene de la fila de `mcp_oauth_codes`.
- Grant `refresh_token`: `scope` se copia del token viejo al nuevo (rotación
  preserva el scope, no lo amplía ni reduce).

### Cambios en `src/lib/mcp/auth.ts`

- `ResolvedWorkspace` gana un campo `scopes: string[]` (el `scope` almacenado,
  p. ej. `"mcp:read mcp:write"`, se separa por espacios al resolverlo — nunca
  se guarda ni se compara como string completo).
- La rama `mnt_at_` de `resolveWorkspaceFromAuth` lee `scope` de
  `mcp_oauth_tokens`, lo divide por espacios y lo incluye como `scopes` en el
  `ResolvedWorkspace` devuelto.
- La rama `mnt_live_` (API keys manuales) siempre devuelve `scopes: ["mcp:read"]`
  fijo — nunca lee ninguna columna de scope (no existe para esa tabla).

### Cambios en `src/lib/mcp/tools.ts`

- `McpTool` gana un campo opcional `requiredScope?: string` (ausente = disponible
  para cualquier scope, incluido solo lectura).
- Tool nueva `create_prompt`: `requiredScope: "mcp:write"`, input schema
  `{ text: string (requerido), country?: string (default "ES") }`. Valida
  `text`/`country` reutilizando las mismas reglas de `createPromptSchema`
  (`src/lib/validations/schemas.ts`) — mismo formato de país (ISO, default
  `"ES"`) y misma longitud/no-vacío de `text` que exige el formulario de la
  app — sin el campo `workspaceId` (viene de `ctx.workspace`, no del input).
  El handler hace el mismo insert que `createPromptAction`, pero con
  `status: "paused"` en vez de `"active"`.

### Cambios en `src/app/api/mcp/route.ts`

- `tools/list` filtra `MCP_TOOLS` por `!tool.requiredScope || ctx.workspace.scope.includes(tool.requiredScope)`
  antes de devolver la lista.
- `tools/call` comprueba el mismo criterio antes de ejecutar el handler; si no
  cumple, devuelve un error JSON-RPC (`-32602`, "Herramienta no disponible con
  el alcance actual de este token") en vez de ejecutar el insert.

## Seguridad

- El scope se fija en el servidor (constante `"mcp:read mcp:write"` en el POST
  de `/authorize`), nunca se acepta un `scope` propuesto por el cliente vía
  query param — evita que un cliente pida escritura sin pasar por el
  consentimiento visible.
- Todo insert de `create_prompt` sigue acotado a `workspace.workspaceId` del
  `ResolvedWorkspace` — igual que las tools de lectura, imposible especificar
  otro workspace.
- El prompt se crea `paused`: cero coste de LLM hasta activación manual humana.
- Las API keys manuales no ganan ninguna vía nueva hacia escritura.

## Manejo de errores

| Situación | Respuesta |
|---|---|
| Token sin `mcp:write` llama a `create_prompt` | Error JSON-RPC `-32602`, sin insert. |
| `tools/list` con token sin `mcp:write` | Lista sin `create_prompt` (no aparece). |
| `text` vacío o inválido en `create_prompt` | Error JSON-RPC `-32602` con el mensaje de validación (reutiliza `createPromptSchema` si aplica, o una versión mínima equivalente). |
| Conexión OAuth anterior a este cambio | `scope = "mcp:read"` (default de la migración), sin acceso a `create_prompt`, sin necesidad de revocar nada. |

## Testing / verificación

- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`.
- Verificación en vivo (patrón ya usado en este proyecto): flujo OAuth completo
  con un cliente de prueba, confirmar que el token recién emitido tiene
  `scope` con `mcp:write`, que `tools/list` incluye `create_prompt`, que
  `tools/call create_prompt` inserta un prompt con `status: "paused"`, y que
  una API key `mnt_live_` existente sigue sin ver la tool ni poder llamarla.
- Verificación de no-regresión: una conexión OAuth ya emitida (fila con
  `scope` default `mcp:read` tras la migración) no debe ver `create_prompt`.

## Archivos afectados (estimación)

- `supabase/migrations/0045_mcp_oauth_token_scope.sql` — nuevo.
- `src/app/api/mcp/oauth/authorize/route.ts` — consentimiento + scope fijo en el insert de código.
- `src/app/api/mcp/oauth/token/route.ts` — persistir y propagar `scope` en `issueTokens`.
- `src/lib/mcp/auth.ts` — `ResolvedWorkspace.scope`, lectura de la columna nueva.
- `src/lib/mcp/tools.ts` — campo `requiredScope`, tool `create_prompt`.
- `src/app/api/mcp/route.ts` — filtrado por scope en `tools/list` y `tools/call`.
- `docs/mcp-server.md` — documentar el nuevo alcance y la tool de escritura.
