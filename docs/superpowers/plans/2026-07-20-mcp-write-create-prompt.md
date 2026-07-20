# MCP Write: create_prompt (scope mcp:write) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir la primera capacidad de escritura al servidor MCP de Mentio — una tool `create_prompt` disponible solo para conexiones OAuth con el nuevo alcance `mcp:write`.

**Architecture:** El alcance concedido se fija en el servidor (nunca lo propone el cliente) al autorizar, se persiste en `mcp_oauth_codes.scope` (ya existe) y en una columna nueva `mcp_oauth_tokens.scope`, y se propaga a través de todo el pipeline OAuth (código → token → refresh) hasta `ResolvedWorkspace.scopes` en cada request. El dispatcher JSON-RPC filtra `tools/list` y `tools/call` por ese scope. `create_prompt` inserta con `status: "paused"` — nunca se ejecuta ni genera coste automáticamente.

**Tech Stack:** Next.js 16 (route handlers), Supabase (service role para MCP), PostgreSQL, Zod (reutiliza `createPromptSchema` existente).

**Spec:** `docs/superpowers/specs/2026-07-20-mcp-write-create-prompt-design.md`

## Global Constraints

- **Sin tests unitarios:** el proyecto no tiene runner de tests. Cada tarea se verifica con `pnpm exec tsc --noEmit`, `pnpm lint` (scoped a los archivos tocados — el lint completo del repo tiene ruido preexistente no relacionado), y verificación funcional vía `mcp__plugin_context-mode_context-mode__ctx_execute` (fetch en sandbox) contra el dev server — **nunca uses `curl`/`fetch` directamente en Bash**, un hook lo intercepta.
- **Las API keys manuales (`mnt_live_`) NUNCA ganan escritura.** Siempre resuelven `scopes: ["mcp:read"]` fijo, sin leer ninguna columna de scope (esa tabla no la tiene).
- **El scope se fija en el servidor, nunca lo propone el cliente.** La constante `GRANTED_SCOPE = "mcp:read mcp:write"` en `/authorize` es la única fuente — no se acepta un parámetro `scope` de la query del cliente.
- **Conexiones OAuth ya emitidas antes de la migración quedan en `mcp:read` para siempre** (default de columna), nunca se actualizan retroactivamente.
- **`create_prompt` inserta con `status: "paused"`**, nunca `"active"` — no debe existir ningún camino en este plan que cree un prompt activo desde el MCP.
- **Biome:** `noExplicitAny` es error. `noNonNullAssertion` es warn (permitido, ya usado en los mismos archivos con `redirectUri!`).
- **Git:** rama `codex/mcp-write-create-prompt` (ya creada desde `master`). Commits frecuentes. No `git push` sin confirmación explícita del usuario.
- **Migraciones:** vía `mcp__supabase__apply_migration`, no vía `scripts/migrate.ts` (legacy).

---

## File Structure

**Nuevo:**
- `supabase/migrations/0045_mcp_oauth_token_scope.sql` — columna `scope` en `mcp_oauth_tokens`.

**Modificados:**
- `src/app/api/mcp/oauth/authorize/route.ts` — consentimiento con 2 permisos; `GRANTED_SCOPE` fijo en el insert de `mcp_oauth_codes`.
- `src/app/api/mcp/oauth/token/route.ts` — `issueTokens` recibe y persiste `scope`; ambos grants lo propagan.
- `src/lib/mcp/auth.ts` — `ResolvedWorkspace.scopes: string[]`; `loadWorkspace` lo recibe como parámetro.
- `src/lib/mcp/tools.ts` — `McpTool.requiredScope?`; tool nueva `create_prompt`.
- `src/app/api/mcp/route.ts` — filtrado por scope en `tools/list`/`tools/call`; `instructions` dinámicas según scope.
- `docs/mcp-server.md` — documentar el alcance `mcp:write` y la tool.

---

## Task 1: Migración — columna `scope` en `mcp_oauth_tokens`

**Files:**
- Create: `supabase/migrations/0045_mcp_oauth_token_scope.sql`

**Interfaces:**
- Produces: columna `public.mcp_oauth_tokens.scope` (`text not null default 'mcp:read'`).

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/0045_mcp_oauth_token_scope.sql`:

```sql
-- Alcance concedido a cada token OAuth del MCP. Las filas existentes antes de
-- esta migración quedan en 'mcp:read' (default) — ninguna conexión ya emitida
-- gana escritura silenciosamente; solo las que vuelvan a pasar por /authorize
-- tras este cambio reciben 'mcp:read mcp:write'.
alter table public.mcp_oauth_tokens
  add column if not exists scope text not null default 'mcp:read';

comment on column public.mcp_oauth_tokens.scope is
  'Alcance OAuth concedido al emitir el token (espacio-separado, p. ej. "mcp:read mcp:write"). Filas previas a esta migración quedan en mcp:read por defecto.';
```

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con `name: "0045_mcp_oauth_token_scope"` y el SQL de arriba.

- [ ] **Step 3: Verificar**

Vía `mcp__supabase__execute_sql`:
```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_name = 'mcp_oauth_tokens' and column_name = 'scope';
```
Expected: 1 fila — `scope | text | 'mcp:read'::text | NO`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0045_mcp_oauth_token_scope.sql
git commit -m "feat(mcp): migración 0045 columna scope en mcp_oauth_tokens"
```

---

## Task 2: `/authorize` — consentimiento con 2 permisos + scope fijo

**Files:**
- Modify: `src/app/api/mcp/oauth/authorize/route.ts`

**Interfaces:**
- Consumes: nada nuevo (usa lo ya existente en el archivo).
- Produces: constante `GRANTED_SCOPE = "mcp:read mcp:write"`; `mcp_oauth_codes.scope` pasa a llevar ese valor en vez del `"mcp:read"` hardcodeado anterior.

- [ ] **Step 1: Añadir la constante `GRANTED_SCOPE`**

En `src/app/api/mcp/oauth/authorize/route.ts`, añadir junto a `const CSRF_COOKIE = "mcp_oauth_csrf";`:

```ts
const CSRF_COOKIE = "mcp_oauth_csrf";
// El scope se fija en el servidor, nunca lo propone el cliente — toda
// conexión OAuth nueva recibe ambos permisos juntos (sin selector granular).
const GRANTED_SCOPE = "mcp:read mcp:write";
```

- [ ] **Step 2: Actualizar el texto de consentimiento en el GET handler**

Reemplazar:
```ts
    <p><strong>${escapeHtml(client.clientName)}</strong> quiere leer los datos GEO (solo lectura) de tu workspace:</p>
```
por:
```ts
    <p><strong>${escapeHtml(client.clientName)}</strong> solicita estos permisos sobre tu workspace:</p>
    <ul style="margin:0 0 4px;padding-left:20px;font-size:14px;color:#475569;">
      <li>Leer tus datos GEO (visibilidad, competidores, prompts, recomendaciones).</li>
      <li>Crear prompts nuevos (quedan en pausa hasta que los actives tú en la app).</li>
    </ul>
```

- [ ] **Step 3: Fijar `GRANTED_SCOPE` en el insert de `mcp_oauth_codes`**

En el POST handler, reemplazar:
```ts
    scope: "mcp:read",
```
por:
```ts
    scope: GRANTED_SCOPE,
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `pnpm exec tsc --noEmit && pnpm exec biome check --config-path biome.json src/app/api/mcp/oauth/authorize`
Expected: sin errores (si aparece un diff de formato CRLF-only, correr el mismo comando con `--write`).

- [ ] **Step 5: Verificar en vivo**

Con el dev server corriendo (`pnpm dev` en background si no lo está ya, esperar a que responda en `http://localhost:3000`), vía `ctx_execute`:
```js
const reg = await fetch("http://localhost:3000/api/mcp/oauth/register", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ redirect_uris: ["https://example.com/cb"] }),
}).then(r => r.json());
console.log("client_id:", reg.client_id);
```
Anotar el `client_id` para el resto de tareas (no hace falta completar el consentimiento todavía — eso se prueba en la Task 8 end-to-end).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/mcp/oauth/authorize/route.ts
git commit -m "feat(mcp): consentimiento con 2 permisos y scope mcp:read+write fijo en /authorize"
```

---

## Task 3: `/token` — propagar `scope` en ambos grants

**Files:**
- Modify: `src/app/api/mcp/oauth/token/route.ts`

**Interfaces:**
- Consumes: columna `scope` de `mcp_oauth_codes` (ya existente) y de `mcp_oauth_tokens` (Task 1).
- Produces: `issueTokens(params: { clientId, workspaceId, userId, clientName, scope })` — `scope` ahora obligatorio; la respuesta JSON del endpoint devuelve el `scope` real concedido (no un valor fijo).

- [ ] **Step 1: Añadir `scope` a la firma y al insert de `issueTokens`**

Reemplazar la función completa:

```ts
async function issueTokens(params: {
  clientId: string;
  workspaceId: string;
  userId: string;
  clientName: string | null;
  scope: string;
}) {
  const access = generateOpaqueToken(ACCESS_PREFIX);
  const refresh = generateOpaqueToken(REFRESH_PREFIX);
  const service = mcpServiceClient();
  const { error: insertError } = await service.from("mcp_oauth_tokens").insert({
    token_hash: access.hash,
    refresh_hash: refresh.hash,
    client_id: params.clientId,
    workspace_id: params.workspaceId,
    user_id: params.userId,
    client_name: params.clientName,
    scope: params.scope,
    expires_at: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000).toISOString(),
  });
  if (insertError) return oauthError("server_error", 500);
  return NextResponse.json(
    {
      access_token: access.token,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refresh.token,
      scope: params.scope,
    },
    { headers: CORS }
  );
}
```

- [ ] **Step 2: Leer `scope` del código en el grant `authorization_code`**

Reemplazar el select de `mcp_oauth_codes`:
```ts
    const { data: row } = await service
      .from("mcp_oauth_codes")
      .select(
        "id, client_id, workspace_id, user_id, redirect_uri, code_challenge, expires_at, consumed_at"
      )
      .eq("code_hash", hashApiKey(code))
      .maybeSingle();
```
por (añade `scope` a la lista de columnas):
```ts
    const { data: row } = await service
      .from("mcp_oauth_codes")
      .select(
        "id, client_id, workspace_id, user_id, redirect_uri, code_challenge, expires_at, consumed_at, scope"
      )
      .eq("code_hash", hashApiKey(code))
      .maybeSingle();
```

Y en la llamada a `issueTokens` de ese mismo bloque, reemplazar:
```ts
    return issueTokens({
      clientId,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      clientName: (client?.client_name as string | null) ?? null,
    });
```
por:
```ts
    return issueTokens({
      clientId,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      clientName: (client?.client_name as string | null) ?? null,
      scope: row.scope as string,
    });
```

- [ ] **Step 3: Leer y propagar `scope` en el grant `refresh_token`**

Reemplazar el select de `mcp_oauth_tokens`:
```ts
    const { data: row } = await service
      .from("mcp_oauth_tokens")
      .select("id, client_id, workspace_id, user_id, client_name, revoked_at")
      .eq("refresh_hash", hashApiKey(refreshToken))
      .maybeSingle();
```
por (añade `scope`):
```ts
    const { data: row } = await service
      .from("mcp_oauth_tokens")
      .select("id, client_id, workspace_id, user_id, client_name, revoked_at, scope")
      .eq("refresh_hash", hashApiKey(refreshToken))
      .maybeSingle();
```

Y en la llamada a `issueTokens` de ese bloque (tras la rotación), reemplazar:
```ts
    return issueTokens({
      clientId: row.client_id as string,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      clientName: (row.client_name as string | null) ?? null,
    });
```
por:
```ts
    return issueTokens({
      clientId: row.client_id as string,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      clientName: (row.client_name as string | null) ?? null,
      scope: row.scope as string,
    });
```

Esto preserva el scope al rotar — un refresh nunca amplía ni reduce el alcance original.

- [ ] **Step 4: Verificar tipos y lint**

Run: `pnpm exec tsc --noEmit && pnpm exec biome check --config-path biome.json src/app/api/mcp/oauth/token`
Expected: sin errores (aplicar `--write` si aparece un diff de formato CRLF-only).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mcp/oauth/token/route.ts
git commit -m "feat(mcp): propagar scope en la emisión y rotación de tokens OAuth"
```

---

## Task 4: `auth.ts` — `ResolvedWorkspace.scopes`

**Files:**
- Modify: `src/lib/mcp/auth.ts`

**Interfaces:**
- Consumes: columna `scope` de `mcp_oauth_tokens` (Task 1).
- Produces: `ResolvedWorkspace.scopes: string[]`; `loadWorkspace(supabase, workspaceId, scopes)` — firma cambiada, ahora recibe `scopes` como tercer parámetro.

- [ ] **Step 1: Añadir `scopes` a la interfaz `ResolvedWorkspace`**

Reemplazar:
```ts
export interface ResolvedWorkspace {
  workspaceId: string;
  slug: string;
  name: string;
  brandName: string | null;
  domain: string | null;
  country: string | null;
}
```
por:
```ts
export interface ResolvedWorkspace {
  workspaceId: string;
  slug: string;
  name: string;
  brandName: string | null;
  domain: string | null;
  country: string | null;
  scopes: string[];
}
```

- [ ] **Step 2: Actualizar `loadWorkspace` para recibir y devolver `scopes`**

Reemplazar la función completa:
```ts
async function loadWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<ResolvedWorkspace | null> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name, brand_name, domain, country")
    .eq("id", workspaceId)
    .single();

  if (!workspace) return null;

  return {
    workspaceId: workspace.id as string,
    slug: workspace.slug as string,
    name: workspace.name as string,
    brandName: (workspace.brand_name as string | null) ?? null,
    domain: (workspace.domain as string | null) ?? null,
    country: (workspace.country as string | null) ?? null,
  };
}
```
por:
```ts
async function loadWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  scopes: string[]
): Promise<ResolvedWorkspace | null> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name, brand_name, domain, country")
    .eq("id", workspaceId)
    .single();

  if (!workspace) return null;

  return {
    workspaceId: workspace.id as string,
    slug: workspace.slug as string,
    name: workspace.name as string,
    brandName: (workspace.brand_name as string | null) ?? null,
    domain: (workspace.domain as string | null) ?? null,
    country: (workspace.country as string | null) ?? null,
    scopes,
  };
}
```

- [ ] **Step 3: Rama `mnt_at_` — seleccionar `scope` y pasarlo a `loadWorkspace`**

Reemplazar:
```ts
  if (token.startsWith("mnt_at_")) {
    const tokenHash = hashApiKey(token);
    const { data: tok } = await supabase
      .from("mcp_oauth_tokens")
      .select("id, workspace_id, revoked_at, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!tok || tok.revoked_at || new Date(tok.expires_at as string) < new Date()) return null;

    const workspace = await loadWorkspace(supabase, tok.workspace_id as string);
    if (!workspace) return null;
```
por:
```ts
  if (token.startsWith("mnt_at_")) {
    const tokenHash = hashApiKey(token);
    const { data: tok } = await supabase
      .from("mcp_oauth_tokens")
      .select("id, workspace_id, revoked_at, expires_at, scope")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!tok || tok.revoked_at || new Date(tok.expires_at as string) < new Date()) return null;

    const scopes = ((tok.scope as string | null) ?? "mcp:read").split(" ").filter(Boolean);
    const workspace = await loadWorkspace(supabase, tok.workspace_id as string, scopes);
    if (!workspace) return null;
```

- [ ] **Step 4: Rama `mnt_live_` — `scopes` fijo**

Reemplazar:
```ts
  const workspace = await loadWorkspace(supabase, keyRow.workspace_id as string);
  if (!workspace) return null;
```
(la que está en la rama de API key manual, después del bloque `mnt_at_`) por:
```ts
  const workspace = await loadWorkspace(supabase, keyRow.workspace_id as string, ["mcp:read"]);
  if (!workspace) return null;
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `pnpm exec tsc --noEmit && pnpm exec biome check --config-path biome.json src/lib/mcp/auth.ts`
Expected: sin errores. Nota: este archivo es consumido por `tools.ts` y `route.ts` (Tasks 5-6) — hasta que esas tareas se completen, `tsc` sobre el repo completo puede señalar que `ResolvedWorkspace.scopes` no se usa en ningún sitio todavía; eso es solo un aviso de "unused", no un error de tipos, y desaparece al terminar la Task 6.

- [ ] **Step 6: Verificar no-regresión con la API key existente**

Vía `ctx_execute` contra el dev server, con una API key `mnt_live_` real activa (o generar una temporal vía `mcp__supabase__execute_sql` insertando en `mcp_api_keys` y borrándola después, como se hizo en tareas anteriores de este mismo proyecto):
```js
const res = await fetch("http://localhost:3000/api/mcp", {
  method: "POST",
  headers: { Authorization: "Bearer <key>", "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_workspace_overview", arguments: {} } }),
});
console.log(res.status, JSON.stringify(await res.json()));
```
Expected: `200` con los datos del workspace, igual que siempre (esta tarea no cambia el comportamiento observable todavía, solo el tipo interno).

- [ ] **Step 7: Commit**

```bash
git add src/lib/mcp/auth.ts
git commit -m "feat(mcp): ResolvedWorkspace.scopes — resolución de alcance por token"
```

---

## Task 5: `tools.ts` — tool `create_prompt`

**Files:**
- Modify: `src/lib/mcp/tools.ts`

**Interfaces:**
- Consumes: `ResolvedWorkspace.scopes` (Task 4), `createPromptSchema` de `@/lib/validations/schemas` (ya existe, sin `"use server"` — importable directamente).
- Produces: `McpTool.requiredScope?: string`; tool `create_prompt` en `MCP_TOOLS`.

- [ ] **Step 1: Añadir `requiredScope` a la interfaz `McpTool`**

Reemplazar:
```ts
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}
```
por:
```ts
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Si se define, la tool solo aparece en tools/list y solo se ejecuta si
   * ctx.workspace.scopes incluye este valor. Ausente = disponible para
   * cualquier scope (incluido solo-lectura). */
  requiredScope?: string;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}
```

- [ ] **Step 2: Importar `createPromptSchema`**

Añadir al principio del archivo, junto a los imports existentes:
```ts
import { createPromptSchema } from "@/lib/validations/schemas";
```

- [ ] **Step 3: Añadir la tool `create_prompt` al final de `MCP_TOOLS`**

Justo antes del cierre `];` del array `MCP_TOOLS` (después del objeto de `get_company_bio`), añadir:

```ts
  {
    name: "create_prompt",
    description:
      "Crea un prompt nuevo para monitorizar en este workspace. Se crea en pausa " +
      "(status 'paused') — no se ejecuta ni genera coste hasta que un humano lo " +
      "active manualmente en la app (/prompts). Requiere el alcance mcp:write.",
    requiredScope: "mcp:write",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Texto del prompt a monitorizar (entre 10 y 500 caracteres).",
        },
        country: {
          type: "string",
          description: "Código de país ISO de 2 letras (default 'ES').",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      const parsed = createPromptSchema.omit({ workspaceId: true }).safeParse({
        text: str(args, "text") ?? "",
        country: str(args, "country") ?? "ES",
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      }
      const { text, country } = parsed.data;
      const { data, error } = await supabase
        .from("prompts")
        .insert({ workspace_id: workspace.workspaceId, text, country, status: "paused" })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo crear el prompt");
      return { id: data.id, status: "paused" };
    },
  },
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `pnpm exec tsc --noEmit && pnpm exec biome check --config-path biome.json src/lib/mcp/tools.ts`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/tools.ts
git commit -m "feat(mcp): tool create_prompt (requiere scope mcp:write, crea en pausa)"
```

---

## Task 6: `route.ts` — filtrado por scope

**Files:**
- Modify: `src/app/api/mcp/route.ts`

**Interfaces:**
- Consumes: `McpTool.requiredScope` (Task 5), `ctx.workspace.scopes` (Task 4).
- Produces: `tools/list` y `tools/call` respetan el scope del token conectado.

- [ ] **Step 1: Filtrar `tools/list` por scope**

Reemplazar:
```ts
    case "tools/list":
      return result(id, {
        tools: MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
```
por:
```ts
    case "tools/list":
      return result(id, {
        tools: MCP_TOOLS.filter(
          (t) => !t.requiredScope || ctx.workspace.scopes.includes(t.requiredScope)
        ).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
```

- [ ] **Step 2: Rechazar `tools/call` sin el scope requerido**

Reemplazar:
```ts
    case "tools/call": {
      const name = msg.params?.name as string | undefined;
      const args = (msg.params?.arguments as Record<string, unknown> | undefined) ?? {};
      const tool = name ? MCP_TOOLS_BY_NAME.get(name) : undefined;
      if (!tool) return error(id, -32602, `Herramienta desconocida: ${name}`);
      try {
```
por:
```ts
    case "tools/call": {
      const name = msg.params?.name as string | undefined;
      const args = (msg.params?.arguments as Record<string, unknown> | undefined) ?? {};
      const tool = name ? MCP_TOOLS_BY_NAME.get(name) : undefined;
      if (!tool) return error(id, -32602, `Herramienta desconocida: ${name}`);
      if (tool.requiredScope && !ctx.workspace.scopes.includes(tool.requiredScope)) {
        return error(
          id,
          -32602,
          `Herramienta no disponible con el alcance actual de este token: ${name}`
        );
      }
      try {
```

- [ ] **Step 3: Hacer `INSTRUCTIONS` dinámico según scope**

Reemplazar la constante fija:
```ts
const INSTRUCTIONS =
  "Servidor MCP de Mentio (monitorización GEO / visibilidad de marca en LLMs). " +
  "La API key acota todas las respuestas a un único workspace. Empieza por get_workspace_overview " +
  "para orientarte y luego usa get_dashboard_kpis, get_market_share, get_top_competitors, etc. " +
  "Todas las herramientas son de solo lectura.";
```
por una función:
```ts
function buildInstructions(scopes: string[]): string {
  const base =
    "Servidor MCP de Mentio (monitorización GEO / visibilidad de marca en LLMs). " +
    "La API key acota todas las respuestas a un único workspace. Empieza por get_workspace_overview " +
    "para orientarte y luego usa get_dashboard_kpis, get_market_share, get_top_competitors, etc.";
  if (scopes.includes("mcp:write")) {
    return (
      base +
      " La mayoría de herramientas son de solo lectura; create_prompt es la excepción: " +
      "crea un prompt en pausa, sin ejecutarlo ni generar coste, hasta que un humano lo active."
    );
  }
  return base + " Todas las herramientas son de solo lectura.";
}
```

Y en el `case "initialize"` del `dispatch`, reemplazar:
```ts
        instructions: INSTRUCTIONS,
```
por:
```ts
        instructions: buildInstructions(ctx.workspace.scopes),
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `pnpm exec tsc --noEmit && pnpm exec biome check --config-path biome.json src/app/api/mcp/route.ts`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mcp/route.ts
git commit -m "feat(mcp): filtrar tools/list y tools/call por scope del token"
```

---

## Task 7: Documentación

**Files:**
- Modify: `docs/mcp-server.md`

**Interfaces:** ninguna (solo docs).

- [ ] **Step 1: Documentar el alcance `mcp:write` y la tool**

Añadir una sección nueva explicando: qué es `mcp:write`, que solo se concede vía OAuth (nunca a API keys manuales), que la pantalla de consentimiento lo muestra explícitamente, que las conexiones OAuth autorizadas antes de este cambio quedan en solo lectura hasta que el usuario reautorice, y documentar `create_prompt` en la tabla de herramientas existente (argumentos, que crea en `status: "paused"`, que requiere reautorizar si la conexión es antigua).

- [ ] **Step 2: Commit**

```bash
git add docs/mcp-server.md
git commit -m "docs(mcp): documentar el alcance mcp:write y la tool create_prompt"
```

---

## Task 8: Verificación end-to-end completa

**Files:** ninguno (solo verificación).

**Interfaces:**
- Consumes: todo lo de las Tasks 1-6.

- [ ] **Step 1: Flujo completo con scope nuevo**

Con el dev server corriendo, vía `ctx_execute` y `mcp__supabase__execute_sql` (mismo patrón usado en las verificaciones E2E anteriores de este proyecto — sin navegador disponible en este entorno, se simula el POST de `/authorize` insertando directamente un `mcp_oauth_codes` real con un owner/admin real de un workspace):

1. Registrar un cliente de prueba vía `/api/mcp/oauth/register`.
2. Generar un par PKCE (verifier + challenge S256).
3. Insertar directamente en `mcp_oauth_codes` (vía `mcp__supabase__execute_sql`) con `scope: "mcp:read mcp:write"`, un `workspace_id`/`user_id` reales de un owner/admin, y el `code_challenge` generado.
4. Intercambiar el código por token en `/api/mcp/oauth/token` — confirmar que la respuesta incluye `"scope": "mcp:read mcp:write"`.
5. Llamar a `tools/list` con ese token — confirmar que `create_prompt` **aparece** en la lista.
6. Llamar a `tools/call create_prompt` con un `text` válido (≥10 caracteres) — confirmar `200` y que la respuesta indica `status: "paused"`.
7. Verificar en la BD (`select status from prompts where id = '<id-devuelto>'`) que el prompt quedó `paused`, no `active`.
8. Limpiar: borrar el prompt de prueba, el código/token/cliente de prueba.

- [ ] **Step 2: No-regresión — conexión OAuth con scope antiguo**

1. Insertar directamente otro `mcp_oauth_codes` de prueba con `scope: "mcp:read"` (simulando una conexión autorizada ANTES de este cambio).
2. Intercambiar por token — confirmar `"scope": "mcp:read"` en la respuesta (no gana escritura).
3. Llamar a `tools/list` con ese token — confirmar que `create_prompt` **NO aparece**.
4. Llamar a `tools/call create_prompt` de todos modos con ese token — confirmar que devuelve el error `-32602` "Herramienta no disponible con el alcance actual de este token", **sin** insertar ningún prompt (confirmar en BD que no se creó nada).
5. Limpiar los datos de prueba.

- [ ] **Step 3: No-regresión — API key manual**

Con una API key `mnt_live_` real (o una temporal insertada vía SQL y borrada después):
1. `tools/list` — confirmar que `create_prompt` **NO aparece**.
2. `tools/call create_prompt` — confirmar el mismo error `-32602`, sin insert.
3. `tools/call get_workspace_overview` — confirmar que sigue funcionando igual que siempre (no-regresión de las tools de lectura).

- [ ] **Step 4: Build completo**

Run: `pnpm build`
Expected: build exitoso, sin errores, rutas `/api/mcp/*` y `.well-known/*` presentes en el resumen de rutas.

- [ ] **Step 5: Commit final (si algo quedó sin commitear)**

```bash
git status --short
```
Si hay cambios sin commitear de esta verificación (no debería haberlos, es solo lectura/pruebas contra BD), commitear con un mensaje descriptivo.

---

## Self-Review (completado por el autor del plan)

- **Cobertura de la spec:** alcance nuevo `mcp:write` (Task 2), columna `scope` en tokens (Task 1), propagación en emisión/refresh (Task 3), `ResolvedWorkspace.scopes` (Task 4), tool `create_prompt` con `status: "paused"` (Task 5), filtrado de `tools/list`/`tools/call` (Task 6), API keys manuales sin cambios (verificado explícitamente en Task 8 Step 3), conexiones antiguas quedan en solo lectura (verificado en Task 8 Step 2), documentación (Task 7). ✓
- **Placeholders:** ninguno; todo el código de cada paso está completo y es el diff real a aplicar.
- **Consistencia de tipos:** `scopes: string[]` es el nombre usado consistentemente desde `ResolvedWorkspace` (Task 4) hasta `tools.ts`/`route.ts` (Tasks 5-6); `requiredScope` (singular, un solo string) es el nombre usado en `McpTool` y en ambos puntos de `route.ts` que lo consumen; `GRANTED_SCOPE` se define una vez (Task 2) y es la única fuente del valor de scope en todo el flujo de autorización.
