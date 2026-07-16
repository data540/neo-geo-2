import { type NextRequest, NextResponse } from "next/server";
import { hashApiKey, mcpServiceClient } from "@/lib/mcp/auth";
import {
  ACCESS_PREFIX,
  ACCESS_TTL_SECONDS,
  generateOpaqueToken,
  REFRESH_PREFIX,
  verifyPkceS256,
} from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function oauthError(err: string, status = 400) {
  return NextResponse.json({ error: err }, { status, headers: CORS });
}

async function issueTokens(params: {
  clientId: string;
  workspaceId: string;
  userId: string;
  clientName: string | null;
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
    expires_at: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000).toISOString(),
  });
  if (insertError) return oauthError("server_error", 500);
  return NextResponse.json(
    {
      access_token: access.token,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refresh.token,
      scope: "mcp:read",
    },
    { headers: CORS }
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const grantType = form.get("grant_type") as string | null;
  const service = mcpServiceClient();

  if (grantType === "authorization_code") {
    const code = form.get("code") as string | null;
    const codeVerifier = form.get("code_verifier") as string | null;
    const clientId = form.get("client_id") as string | null;
    const redirectUri = form.get("redirect_uri") as string | null;
    if (!code || !codeVerifier || !clientId || !redirectUri) return oauthError("invalid_request");

    const { data: row } = await service
      .from("mcp_oauth_codes")
      .select(
        "id, client_id, workspace_id, user_id, redirect_uri, code_challenge, expires_at, consumed_at"
      )
      .eq("code_hash", hashApiKey(code))
      .maybeSingle();

    if (!row || row.consumed_at) return oauthError("invalid_grant");
    if (row.client_id !== clientId || row.redirect_uri !== redirectUri)
      return oauthError("invalid_grant");
    if (new Date(row.expires_at as string) < new Date()) return oauthError("invalid_grant");
    if (!verifyPkceS256(codeVerifier, row.code_challenge as string))
      return oauthError("invalid_grant");

    const { data: consumedRows, error: consumeError } = await service
      .from("mcp_oauth_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("consumed_at", null)
      .select("id");
    if (consumeError || !consumedRows || consumedRows.length === 0)
      return oauthError("invalid_grant");

    const { data: client } = await service
      .from("mcp_oauth_clients")
      .select("client_name")
      .eq("client_id", clientId)
      .maybeSingle();

    return issueTokens({
      clientId,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      clientName: (client?.client_name as string | null) ?? null,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token") as string | null;
    if (!refreshToken) return oauthError("invalid_request");

    const { data: row } = await service
      .from("mcp_oauth_tokens")
      .select("id, client_id, workspace_id, user_id, client_name, revoked_at")
      .eq("refresh_hash", hashApiKey(refreshToken))
      .maybeSingle();

    if (!row || row.revoked_at) return oauthError("invalid_grant");

    // Rotación: revoca el token viejo y emite uno nuevo.
    const { data: revokedRows, error: revokeError } = await service
      .from("mcp_oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("revoked_at", null)
      .select("id");
    if (revokeError || !revokedRows || revokedRows.length === 0) return oauthError("invalid_grant");

    return issueTokens({
      clientId: row.client_id as string,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      clientName: (row.client_name as string | null) ?? null,
    });
  }

  return oauthError("unsupported_grant_type");
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
