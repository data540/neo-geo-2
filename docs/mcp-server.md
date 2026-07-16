# Servidor MCP de Mentio

Mentio expone los datos de monitorización GEO de cada workspace como un
**servidor MCP (Model Context Protocol) remoto y de solo lectura**, para que
cualquier LLM compatible —Claude (Desktop, web, Code) o ChatGPT— pueda
consultarlos en lenguaje natural.

- **Endpoint:** `https://neogeo-three.vercel.app/api/mcp`
- **Transporte:** Streamable HTTP — JSON-RPC 2.0 sobre `POST`, stateless (sin sesión, sin SSE).
- **Autenticación:** `Authorization: Bearer <api-key>` en **cada** petición.
- **Alcance:** solo lectura, acotado al workspace al que pertenece la API key.

## Arquitectura

```
Cliente LLM (Claude / ChatGPT)
  → POST /api/mcp  (JSON-RPC 2.0 + Authorization: Bearer mnt_live_…)
    → resolveWorkspaceFromAuth() valida el hash de la key en mcp_api_keys
    → dispatch(initialize | tools/list | tools/call)
      → tools llaman a las RPCs del workspace vía service role (RLS bypass acotado por la key)
    → respuesta JSON-RPC
```

- Código: [`src/app/api/mcp/route.ts`](../src/app/api/mcp/route.ts),
  [`src/lib/mcp/auth.ts`](../src/lib/mcp/auth.ts),
  [`src/lib/mcp/tools.ts`](../src/lib/mcp/tools.ts).
- No usa el SDK de MCP ni dependencias nuevas (evita el conflicto zod v3/v4);
  implementa el protocolo directamente.
- Se despliega con la app en Vercel — no hay proceso aparte.

> **Visibilidad:** la sección MCP en la app (menú lateral **"MCP"** →
> `/{workspace}/mcp`) es visible para **dueños y administradores del workspace**
> (mismo nivel de permisos que Settings / Admin). El gate está en
> [`src/lib/auth/getWorkspaceMember.ts`](../src/lib/auth/getWorkspaceMember.ts).

## 1. Conexión vía OAuth (recomendada para Claude.ai / ChatGPT)

**Sin API key, sin copiar-pegar tokens.** Si eres dueño o admin de un workspace
en Mentio, puedes conectar directamente desde Claude.ai o ChatGPT con solo la URL
del servidor MCP — el flujo OAuth se encarga de la identidad y los permisos.

### Cómo funciona

1. En Claude.ai o ChatGPT, ve a **Settings → Connectors → Add custom connector**.
2. Pega solo la URL: `https://neogeo-three.vercel.app/api/mcp`
3. Haz clic en **Connect**.
4. Se abre una ventana: inicia sesión en tu cuenta de Mentio (si no lo estás ya).
5. Ves una pantalla de **Autorizar** listando los workspace(s) donde eres
   dueño/admin.
6. Haz clic en **Autorizar** para conectar.
7. Listo — las herramientas de Mentio aparecen en el selector de Claude / ChatGPT.

**Requisito:** debes ser **dueño o administrador** de al menos un workspace.
Si no ves ninguno en la pantalla de consentimiento, contacta con el dueño del
workspace para que te añada.

### Diferencia vs API keys

- **OAuth:** ideal para usuarios humanos en Claude.ai o ChatGPT. Flujo interactivo,
  identidad verificada, sin secretos guardados en texto.
- **API keys** (`mnt_live_…`): ideales para Claude Code (CLI), scripts, y acceso
  programático. Una key por consumidor, revocable en cualquier momento. Ver
  apartados 2 a 4 abajo.

---

## 2. Generar una API key

Cada línea de acceso (un LLM, una persona) debería tener su propia key.

**Opción A — desde la app (recomendada):** menú **MCP** →
escribe un nombre → **Generar**. La key se muestra una sola vez con un botón de
copiar y un snippet listo para Claude Code. También puedes listar y revocar keys.

**Opción B — por CLI** (requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`):

```bash
pnpm mcp:key <workspace-slug> "Nombre descriptivo"
# ejemplo:
pnpm mcp:key air-europa "Claude Desktop de David"
```

La salida muestra la key en claro **una única vez** (`mnt_live_…`). Guárdala en un
gestor de contraseñas: en la base de datos solo se almacena su hash sha256
(tabla `mcp_api_keys`), así que no se puede recuperar.

**Revocar** una key:
```sql
update public.mcp_api_keys set revoked_at = now()
where key_prefix = 'mnt_live_xxxxxxxx';   -- el prefijo se ve en la tabla
```

## 3. Configuración por cliente

### Claude Code (CLI)
```bash
claude mcp add --transport http mentio https://neogeo-three.vercel.app/api/mcp \
  --header "Authorization: Bearer mnt_live_TU_KEY"
```
Compruébalo con `claude mcp list` y luego `/mcp` dentro de una sesión.

### Claude.ai (web) y Claude Desktop — Custom Connector
Disponible en planes de pago. **Settings → Connectors → Add custom connector**:
- **URL:** `https://neogeo-three.vercel.app/api/mcp`
- **Authentication:** cabecera `Authorization` con valor `Bearer mnt_live_TU_KEY`.

### Claude Desktop (config JSON, vía puente stdio)
Si tu versión solo admite servidores locales por stdio, usa `mcp-remote` como
puente. Edita `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mentio": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://neogeo-three.vercel.app/api/mcp",
        "--header", "Authorization: Bearer mnt_live_TU_KEY"
      ]
    }
  }
}
```
Reinicia Claude Desktop. Las herramientas de Mentio aparecerán en el selector.

### ChatGPT (Developer mode / Connectors)
En ChatGPT con acceso a conectores MCP: **Settings → Connectors → Create** (tipo
MCP / servidor remoto):
- **Server URL:** `https://neogeo-three.vercel.app/api/mcp`
- **Authentication:** Bearer token = `mnt_live_TU_KEY`

> Nota: ChatGPT expone las herramientas MCP en el modo desarrollador / conectores.
> El servidor es stateless y responde en JSON (no SSE), compatible con clientes
> que hablan Streamable HTTP.

## 4. Herramientas (todas de solo lectura)

| Herramienta | Argumentos | Descripción |
|---|---|---|
| `get_workspace_overview` | — | Marca, dominio, país, nº de competidores y prompts activos. |
| `get_dashboard_kpis` | `llm_provider?`, `country?` | Visibilidad, SOV, sentiment y posición media. |
| `get_market_share` | `days?`, `llm_provider?`, `country?` | Cuota de mercado propia vs competidores. |
| `get_top_competitors` | `days?`, `limit?`, `llm_provider?`, `country?` | Ranking de competidores con tendencia. |
| `get_top_sources` | `days?`, `limit?`, `llm_provider?`, `country?` | Dominios más citados por los LLMs. |
| `get_mention_breakdown` | `days?`, `llm_provider?`, `country?` | Menciones por tipo. |
| `get_llm_comparison` | `days?`, `country?` | Visibilidad comparada entre proveedores. |
| `get_prompt_performance` | `llm_provider?`, `country?` | Rendimiento por prompt. |
| `list_prompts` | `status?`, `limit?` | Prompts monitorizados. |
| `get_recommendations` | — | Recomendaciones GEO accionables con fuentes. |
| `get_company_bio` | — | Inteligencia de negocio de la marca. |

- `llm_provider` ∈ `chatgpt` · `gemini` (AI Overviews) · `perplexity`.
- `country` en ISO (`ES`, `CO`). Omitir cualquiera de los dos = agregado global.
- `days` por defecto 30.

## 5. Verificación manual (curl)

```bash
KEY="mnt_live_TU_KEY"
URL="https://neogeo-three.vercel.app/api/mcp"

# handshake
curl -s -X POST "$URL" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'

# listar herramientas
curl -s -X POST "$URL" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# ejecutar una herramienta
curl -s -X POST "$URL" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_workspace_overview","arguments":{}}}'
```

## 6. Seguridad

- **Solo lectura.** No hay herramientas que escriban ni disparen ejecuciones/coste.
- **Aislamiento por workspace.** La key resuelve a un único `workspace_id`; ninguna
  herramienta acepta un workspace como parámetro.
- **Sin secretos en claro en BD.** Solo se guarda el hash sha256; revoca con
  `revoked_at`.
- **Trata la key como una contraseña.** Da acceso de lectura a todas las métricas
  del workspace. Usa una key por consumidor y revoca las que se filtren.

## 7. Solución de problemas

| Síntoma | Causa / solución |
|---|---|
| `401` en todas las llamadas | Falta o es inválida la cabecera `Authorization: Bearer …`, o la key está revocada. Genera una nueva con `pnpm mcp:key`. |
| `405` al hacer `GET /api/mcp` | Es lo esperado: el servidor es stateless y solo acepta `POST`. |
| El cliente no ve herramientas | Confirma que el handshake `initialize` responde 200 y que `tools/list` devuelve 11 herramientas (curl arriba). |
| `Herramienta desconocida` | El nombre no existe; consulta la tabla de la sección 4. |
| Datos vacíos | El workspace puede no tener datos para ese `days`/`llm_provider`/`country`. Prueba sin filtros. |
