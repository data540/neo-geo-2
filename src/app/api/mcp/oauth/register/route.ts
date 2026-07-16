import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { mcpServiceClient } from "@/lib/mcp/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(request: NextRequest) {
  let body: { client_name?: string; redirect_uris?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: CORS });
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];

  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris requerido" },
      { status: 400, headers: CORS }
    );
  }

  const clientId = `mcp_${randomUUID().replace(/-/g, "")}`;
  const clientName = typeof body.client_name === "string" ? body.client_name : null;

  const service = mcpServiceClient();
  const { error } = await service.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
  });
  if (error) {
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: CORS });
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: CORS }
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
