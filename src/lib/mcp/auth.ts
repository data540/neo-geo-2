import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con service role para el servidor MCP.
 * Bypassea RLS: la autorización se hace por API key acotada a un workspace.
 */
export function mcpServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

const KEY_PREFIX = "mnt_live_";

/** Genera una API key nueva y su hash. El valor en claro solo se muestra una vez. */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const secret = randomBytes(24).toString("hex"); // 48 chars hex
  const key = `${KEY_PREFIX}${secret}`;
  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: key.slice(0, KEY_PREFIX.length + 8), // mnt_live_xxxxxxxx
  };
}

export interface ResolvedWorkspace {
  workspaceId: string;
  slug: string;
  name: string;
  brandName: string | null;
  domain: string | null;
  country: string | null;
}

/**
 * Resuelve el workspace a partir del header Authorization: Bearer <key>.
 * Devuelve null si falta la key, es inválida o está revocada.
 * Actualiza last_used_at de forma best-effort (no bloquea la respuesta).
 */
export async function resolveWorkspaceFromAuth(
  authorizationHeader: string | null
): Promise<ResolvedWorkspace | null> {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return null;

  const supabase = mcpServiceClient();

  // Access token OAuth (mnt_at_): tabla mcp_oauth_tokens.
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

    void supabase
      .from("mcp_oauth_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tok.id)
      .then(() => undefined);

    return workspace;
  }

  // API key manual (mnt_live_): tabla mcp_api_keys (comportamiento existente).
  const keyHash = hashApiKey(token);
  const { data: keyRow, error } = await supabase
    .from("mcp_api_keys")
    .select("id, workspace_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRow || keyRow.revoked_at) return null;

  const workspace = await loadWorkspace(supabase, keyRow.workspace_id as string);
  if (!workspace) return null;

  void supabase
    .from("mcp_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => undefined);

  return workspace;
}

/** Carga y mapea un workspace a ResolvedWorkspace. Compartido por las dos vías de auth. */
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
