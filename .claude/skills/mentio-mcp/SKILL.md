---
name: mentio-mcp
description: Use when the user wants to connect Mentio (the GEO / AI brand-visibility monitoring app) to an LLM — configuring the Mentio MCP server in Claude Desktop, Claude.ai, Claude Code, or ChatGPT; generating an MCP API key; or querying a workspace's GEO data (visibility, share of voice, competitors, sources, recommendations) over MCP.
---

# Mentio MCP server

Mentio expone sus datos de monitorización GEO (visibilidad de marca en ChatGPT,
Gemini/AI Overviews y Perplexity) como un **servidor MCP remoto de solo lectura**.
Cualquier cliente MCP (Claude Desktop, Claude.ai, Claude Code, ChatGPT) puede
conectarse con la URL del servidor y una **API key** que acota el acceso a un
único workspace.

- **URL del servidor:** `https://neogeo-three.vercel.app/api/mcp`
- **Transporte:** Streamable HTTP (JSON-RPC 2.0 sobre POST), stateless.
- **Auth:** `Authorization: Bearer <api-key>` en cada petición.
- **Alcance:** solo lectura, acotado al workspace de la API key.

## 1. Generar la API key (una por workspace)

En el repo, con `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`:

```bash
pnpm mcp:key <workspace-slug> "Nombre descriptivo"
# ej: pnpm mcp:key air-europa "Claude Desktop de David"
```

Imprime la key en claro **una sola vez** (formato `mnt_live_…`). En la BD solo
queda el hash sha256 (tabla `mcp_api_keys`). Para revocarla:
`update mcp_api_keys set revoked_at = now() where key_prefix = 'mnt_live_xxxxxxxx';`

## 2. Configurar el cliente

### Claude Code (CLI)
```bash
claude mcp add --transport http mentio https://neogeo-three.vercel.app/api/mcp \
  --header "Authorization: Bearer mnt_live_TU_KEY"
```

### Claude Desktop / Claude.ai (Custom Connector)
Settings → Connectors → **Add custom connector**:
- URL: `https://neogeo-three.vercel.app/api/mcp`
- Authentication: header `Authorization` = `Bearer mnt_live_TU_KEY`

Si el cliente solo admite stdio (Claude Desktop config JSON), usar el puente
`mcp-remote`:
```json
{
  "mcpServers": {
    "mentio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://neogeo-three.vercel.app/api/mcp",
               "--header", "Authorization: Bearer mnt_live_TU_KEY"]
    }
  }
}
```

### ChatGPT (Developer mode / Connectors)
Settings → Connectors → **Create** → tipo MCP:
- Server URL: `https://neogeo-three.vercel.app/api/mcp`
- Authentication: Bearer token = `mnt_live_TU_KEY`

Guía completa y solución de problemas: [docs/mcp-server.md](../../../docs/mcp-server.md).

## 3. Herramientas disponibles (todas read-only)

| Tool | Qué devuelve |
|------|--------------|
| `get_workspace_overview` | Marca, dominio, país, nº competidores y prompts activos. **Empieza por aquí.** |
| `get_dashboard_kpis` | Visibilidad, SOV, sentiment, posición media (arg: `llm_provider`, `country`). |
| `get_market_share` | Cuota de mercado propia vs competidores (`days`, `llm_provider`, `country`). |
| `get_top_competitors` | Ranking de competidores con tendencia (`days`, `limit`, `llm_provider`, `country`). |
| `get_top_sources` | Dominios más citados por los LLMs. |
| `get_mention_breakdown` | Menciones por tipo (recomendación, lista, comparación…). |
| `get_llm_comparison` | Visibilidad comparada entre proveedores LLM. |
| `get_prompt_performance` | Rendimiento por prompt. |
| `list_prompts` | Prompts monitorizados (`status`, `limit`). |
| `get_recommendations` | Recomendaciones GEO accionables con fuentes. |
| `get_company_bio` | Inteligencia de negocio de la marca. |

`llm_provider` ∈ `chatgpt` · `gemini` (AI Overviews) · `perplexity`. `country` es
ISO (`ES`, `CO`). Omitir para agregado global.

## 4. Cómo usarlo al responder al usuario
1. Llama a `get_workspace_overview` para saber qué marca y país cubre la key.
2. Para preguntas de visibilidad/competencia usa `get_dashboard_kpis` +
   `get_market_share` + `get_top_competitors`.
3. Cita siempre el período (`days`) y el `llm_provider` que usaste, porque los
   números cambian según el filtro.
