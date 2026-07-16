"use server";

import { generateApiKey, mcpServiceClient } from "@/lib/mcp/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

export interface McpKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Gate: el usuario debe poder gestionar el workspace (owner/admin). */
async function requireManager(workspaceId: string): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return { error: "Sin permisos" };
  return null;
}

export async function listMcpKeysAction(workspaceId: string): Promise<ActionResult<McpKeyRow[]>> {
  const gate = await requireManager(workspaceId);
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
  const gate = await requireManager(workspaceId);
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

export async function revokeMcpKeyAction(keyId: string): Promise<ActionResult<{ id: string }>> {
  const service = mcpServiceClient();
  const { data: key } = await service
    .from("mcp_api_keys")
    .select("workspace_id")
    .eq("id", keyId)
    .maybeSingle();
  if (!key) return { success: false, error: "Key no encontrada" };
  const gate = await requireManager(key.workspace_id as string);
  if (gate) return { success: false, error: gate.error };

  const { error } = await service
    .from("mcp_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { id: keyId } };
}

export interface McpConnectionRow {
  id: string;
  clientName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export async function listMcpConnectionsAction(
  workspaceId: string
): Promise<ActionResult<McpConnectionRow[]>> {
  const gate = await requireManager(workspaceId);
  if (gate) return { success: false, error: gate.error };

  const service = mcpServiceClient();
  const { data, error } = await service
    .from("mcp_oauth_tokens")
    .select("id, client_name, created_at, last_used_at, revoked_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      clientName: (r.client_name as string | null) ?? null,
      createdAt: r.created_at as string,
      lastUsedAt: (r.last_used_at as string | null) ?? null,
      revokedAt: (r.revoked_at as string | null) ?? null,
    })),
  };
}

export async function revokeMcpConnectionAction(id: string): Promise<ActionResult<{ id: string }>> {
  const service = mcpServiceClient();
  const { data: tok } = await service
    .from("mcp_oauth_tokens")
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (!tok) return { success: false, error: "Conexión no encontrada" };
  const gate = await requireManager(tok.workspace_id as string);
  if (gate) return { success: false, error: gate.error };

  const { error } = await service
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { id } };
}
