import { type NextRequest, NextResponse } from "next/server";
import { mcpServiceClient, resolveWorkspaceFromAuth } from "@/lib/mcp/auth";
import { MCP_TOOLS, MCP_TOOLS_BY_NAME, type ToolContext } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "mentio-geo", version: "1.0.0" };
const DEFAULT_PROTOCOL = "2025-06-18";
const INSTRUCTIONS =
  "Servidor MCP de Mentio (monitorización GEO / visibilidad de marca en LLMs). " +
  "La API key acota todas las respuestas a un único workspace. Empieza por get_workspace_overview " +
  "para orientarte y luego usa get_dashboard_kpis, get_market_share, get_top_competitors, etc. " +
  "Todas las herramientas son de solo lectura.";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
};

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

function result(id: JsonRpcId, data: unknown) {
  return { jsonrpc: "2.0" as const, id, result: data };
}
function error(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

async function dispatch(
  msg: JsonRpcRequest,
  ctx: ToolContext
): Promise<object | null> {
  const id = (msg.id ?? null) as JsonRpcId;
  const isNotification = !("id" in msg) || msg.id === undefined;

  switch (msg.method) {
    case "initialize": {
      const clientProtocol = (msg.params?.protocolVersion as string | undefined) ?? DEFAULT_PROTOCOL;
      return result(id, {
        protocolVersion: clientProtocol,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, {
        tools: MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
    case "tools/call": {
      const name = msg.params?.name as string | undefined;
      const args = (msg.params?.arguments as Record<string, unknown> | undefined) ?? {};
      const tool = name ? MCP_TOOLS_BY_NAME.get(name) : undefined;
      if (!tool) return error(id, -32602, `Herramienta desconocida: ${name}`);
      try {
        const data = await tool.handler(args, ctx);
        return result(id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result(id, {
          content: [{ type: "text", text: `Error ejecutando ${name}: ${message}` }],
          isError: true,
        });
      }
    }
    // Métodos que algunos clientes sondean; respondemos vacío para no romper el handshake.
    case "resources/list":
      return result(id, { resources: [] });
    case "resources/templates/list":
      return result(id, { resourceTemplates: [] });
    case "prompts/list":
      return result(id, { prompts: [] });
    default:
      // Notificaciones (p. ej. notifications/initialized) no llevan respuesta.
      if (isNotification) return null;
      return error(id, -32601, `Método no soportado: ${msg.method}`);
  }
}

export async function POST(request: NextRequest) {
  const workspace = await resolveWorkspaceFromAuth(request.headers.get("authorization"));
  if (!workspace) {
    return NextResponse.json(
      error(null, -32001, "No autorizado: falta o es inválida la API key (Authorization: Bearer <key>)."),
      { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": "Bearer" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(error(null, -32700, "JSON inválido"), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const ctx: ToolContext = { supabase: mcpServiceClient(), workspace };
  const isBatch = Array.isArray(body);
  const messages = (isBatch ? body : [body]) as JsonRpcRequest[];

  const responses: object[] = [];
  for (const msg of messages) {
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      responses.push(error((msg?.id ?? null) as JsonRpcId, -32600, "Petición inválida"));
      continue;
    }
    const res = await dispatch(msg, ctx);
    if (res) responses.push(res);
  }

  // Solo había notificaciones → 202 sin cuerpo.
  if (responses.length === 0) {
    return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
  }

  return NextResponse.json(isBatch ? responses : responses[0], { headers: CORS_HEADERS });
}

// Modo stateless: no ofrecemos stream SSE iniciado por el servidor.
export async function GET() {
  return NextResponse.json(
    error(null, -32000, "Este servidor MCP es stateless: usa POST con JSON-RPC 2.0."),
    { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
