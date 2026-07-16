import { type NextRequest, NextResponse } from "next/server";
import { mcpServiceClient } from "@/lib/mcp/auth";
import { CODE_PREFIX, CODE_TTL_SECONDS, generateOpaqueToken, oauthBaseUrl } from "@/lib/mcp/oauth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ManageableWorkspace {
  id: string;
  name: string;
  slug: string;
}

function htmlPage(inner: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conectar con Mentio</title><style>
      body{font-family:system-ui,sans-serif;background:#f8fafc;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;max-width:420px;width:90%;box-shadow:0 1px 3px rgba(0,0,0,.06)}
      h1{font-size:18px;margin:0 0 8px;color:#0f172a}p{color:#475569;font-size:14px;line-height:1.5}
      select{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;margin:12px 0;font-size:14px}
      .row{display:flex;gap:8px;margin-top:16px}button{flex:1;padding:10px;border-radius:8px;font-size:14px;cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#334155}
      button.primary{background:#4f46e5;color:#fff;border-color:#4f46e5}code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12px}
    </style></head><body><div class="card">${inner}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function redirectError(redirectUri: string, state: string | null, err: string): NextResponse {
  const u = new URL(redirectUri);
  u.searchParams.set("error", err);
  if (state) u.searchParams.set("state", state);
  return NextResponse.redirect(u.toString());
}

async function validateClient(clientId: string | null, redirectUri: string | null) {
  if (!clientId || !redirectUri) return null;
  const service = mcpServiceClient();
  const { data } = await service
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return null;
  if (!(data.redirect_uris as string[]).includes(redirectUri)) return null;
  return { clientName: (data.client_name as string | null) ?? "una aplicación" };
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const clientId = p.get("client_id");
  const redirectUri = p.get("redirect_uri");
  const state = p.get("state");
  const codeChallenge = p.get("code_challenge");
  const codeChallengeMethod = p.get("code_challenge_method");
  const responseType = p.get("response_type");

  const client = await validateClient(clientId, redirectUri);
  if (!client)
    return htmlPage(
      `<h1>Solicitud inválida</h1><p>El cliente o la URL de retorno no son válidos.</p>`
    );
  if (responseType !== "code")
    return redirectError(redirectUri!, state, "unsupported_response_type");
  if (codeChallengeMethod !== "S256" || !codeChallenge)
    return redirectError(redirectUri!, state, "invalid_request");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // La página /login solo acepta redirects RELATIVOS (startsWith("/") y no "//").
    // Por eso `back` debe ser una ruta relativa, no una URL absoluta.
    const back = `/api/mcp/oauth/authorize?${p.toString()}`;
    const loginUrl = new URL("/login", oauthBaseUrl());
    loginUrl.searchParams.set("redirect", back);
    return NextResponse.redirect(loginUrl.toString());
  }

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"]);

  const workspaces: ManageableWorkspace[] = (memberships ?? [])
    .map((m) => m.workspaces as unknown as ManageableWorkspace)
    .filter(Boolean);

  if (workspaces.length === 0) {
    return htmlPage(
      `<h1>Sin permisos</h1><p>Tu cuenta no es propietaria ni administradora de ningún workspace, así que no puede conectar por MCP.</p>`
    );
  }

  const options = workspaces.map((w) => `<option value="${w.id}">${w.name}</option>`).join("");

  return htmlPage(`
    <h1>Conectar con Mentio</h1>
    <p><strong>${client.clientName}</strong> quiere leer los datos GEO (solo lectura) de tu workspace:</p>
    <form method="POST">
      ${Array.from(p.entries())
        .map(([k, v]) => `<input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}">`)
        .join("")}
      <select name="workspace_id">${options}</select>
      <div class="row">
        <button type="submit" name="decision" value="deny">Cancelar</button>
        <button type="submit" name="decision" value="allow" class="primary">Autorizar</button>
      </div>
    </form>`);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const clientId = form.get("client_id") as string | null;
  const redirectUri = form.get("redirect_uri") as string | null;
  const state = form.get("state") as string | null;
  const codeChallenge = form.get("code_challenge") as string | null;
  const workspaceId = form.get("workspace_id") as string | null;
  const decision = form.get("decision") as string | null;

  const client = await validateClient(clientId, redirectUri);
  if (!client)
    return htmlPage(`<h1>Solicitud inválida</h1><p>Cliente o URL de retorno no válidos.</p>`);
  if (decision !== "allow") return redirectError(redirectUri!, state, "access_denied");
  if (!codeChallenge || !workspaceId) return redirectError(redirectUri!, state, "invalid_request");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectError(redirectUri!, state, "access_denied");

  // Re-verificar que el usuario gestiona ESE workspace (no confiar en el form).
  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return redirectError(redirectUri!, state, "access_denied");

  const { token: code, hash: codeHash } = generateOpaqueToken(CODE_PREFIX);
  const service = mcpServiceClient();
  const { error } = await service.from("mcp_oauth_codes").insert({
    code_hash: codeHash,
    client_id: clientId,
    workspace_id: workspaceId,
    user_id: user.id,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "mcp:read",
    expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) return redirectError(redirectUri!, state, "server_error");

  const u = new URL(redirectUri!);
  u.searchParams.set("code", code);
  if (state) u.searchParams.set("state", state);
  return NextResponse.redirect(u.toString(), { status: 303 });
}
