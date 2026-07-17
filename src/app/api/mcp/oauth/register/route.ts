import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { hashApiKey, mcpServiceClient } from "@/lib/mcp/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip || "unknown";
}

async function isRateLimited(ipHash: string): Promise<boolean> {
  const service = mcpServiceClient();
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await service
    .from("mcp_oauth_register_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  return (count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  const ipHash = hashApiKey(getClientIp(request));
  if (await isRateLimited(ipHash)) {
    return NextResponse.json(
      {
        error: "rate_limited",
        error_description: "Demasiados registros desde esta IP. Intenta más tarde.",
      },
      { status: 429, headers: CORS }
    );
  }

  let body: { client_name?: string; redirect_uris?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: CORS });
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];

  const invalidRedirectUriResponse = NextResponse.json(
    { error: "invalid_redirect_uri", error_description: "redirect_uris requerido" },
    { status: 400, headers: CORS }
  );

  if (redirectUris.length === 0) {
    return invalidRedirectUriResponse;
  }

  const isValidRedirectUri = (value: string): boolean => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
      return true;
    }
    return false;
  };

  if (!redirectUris.every(isValidRedirectUri)) {
    return invalidRedirectUriResponse;
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

  await service.from("mcp_oauth_register_attempts").insert({ ip_hash: ipHash });

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
