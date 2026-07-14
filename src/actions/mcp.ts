"use server";

import { generateApiKey, mcpServiceClient } from "@/lib/mcp/auth";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/superAdmin";
import type { ActionResult } from "@/types";

export interface McpKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Gate común: solo super-admin (email de plataforma). Devuelve null si OK, o un error. */
async function requireSuperAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };
  if (!isSuperAdmin(user.email)) return { error: "Solo disponible para administradores" };
  return null;
}

export async function listMcpKeysAction(workspaceId: string): Promise<ActionResult<McpKeyRow[]>> {
  const gate = await requireSuperAdmin();
  if (gate) return { success: false, error: gate.error };

  const service = mcpServiceClient();
  const { data, error } = await service
    .from("mcp_api_keys")
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      keyPrefix: r.key_prefix as string,
      createdAt: r.created_at as string,
      lastUsedAt: (r.last_used_at as string | null) ?? null,
      revokedAt: (r.revoked_at as string | null) ?? null,
    })),
  };
}

export async function generateMcpKeyAction(
  workspaceId: string,
  name: string
): Promise<ActionResult<{ key: string; keyPrefix: string }>> {
  const gate = await requireSuperAdmin();
  if (gate) return { success: false, error: gate.error };

  const cleanName = name.trim() || "default";
  const { key, keyHash, keyPrefix } = generateApiKey();

  const service = mcpServiceClient();
  const { error } = await service.from("mcp_api_keys").insert({
    workspace_id: workspaceId,
    name: cleanName,
    key_prefix: keyPrefix,
    key_hash: keyHash,
  });
  if (error) return { success: false, error: error.message };

  return { success: true, data: { key, keyPrefix } };
}

export async function revokeMcpKeyAction(
  keyId: string
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireSuperAdmin();
  if (gate) return { success: false, error: gate.error };

  const service = mcpServiceClient();
  const { error } = await service
    .from("mcp_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId);
  if (error) return { success: false, error: error.message };

  return { success: true, data: { id: keyId } };
}
