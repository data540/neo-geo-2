"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, LlmProviderKey, WorkspaceLlmConfigWithProvider } from "@/types";

// Prefix patterns to group OpenRouter models by provider
const PROVIDER_PREFIXES: Record<LlmProviderKey, string[]> = {
  chatgpt: ["openai/"],
  claude: ["anthropic/"],
  gemini: ["google/gemini"],
  perplexity: ["perplexity/"],
  deepseek: ["deepseek/"],
};

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
}

export async function getOpenRouterModelsAction(
  providerKey: LlmProviderKey
): Promise<ActionResult<OpenRouterModel[]>> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 }, // cache 1h
    });
    if (!res.ok) return { success: false, error: "No se pudo cargar modelos de OpenRouter" };

    const json = (await res.json()) as {
      data?: Array<{
        id?: string;
        name?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
      }>;
    };

    const prefixes = PROVIDER_PREFIXES[providerKey];
    const models = (json.data ?? [])
      .filter((m) => m.id && prefixes.some((p) => m.id!.startsWith(p)))
      .map((m) => ({
        id: m.id!,
        name: m.name ?? m.id!,
        context_length: m.context_length ?? 0,
        pricing: {
          prompt: m.pricing?.prompt ?? "0",
          completion: m.pricing?.completion ?? "0",
        },
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, data: models };
  } catch {
    return { success: false, error: "Error al conectar con OpenRouter" };
  }
}

const upsertLlmConfigSchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceSlug: z.string().min(1),
  configs: z
    .array(
      z.object({
        llmProviderId: z.string().uuid(),
        promptsPerDay: z.number().int().min(0).max(50),
        model: z.string().optional(),
      })
    )
    .min(1)
    .max(10),
});

export async function getLlmConfigAction(
  workspaceId: string
): Promise<ActionResult<WorkspaceLlmConfigWithProvider[]>> {
  const supabase = await createClient();

  const { data: isMember } = await supabase.rpc("is_workspace_member", {
    p_workspace_id: workspaceId,
  });
  if (!isMember) return { success: false, error: "Sin permisos" };

  const { data, error } = await supabase
    .from("workspace_llm_config")
    .select("*, llm_providers(key, name)")
    .eq("workspace_id", workspaceId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as WorkspaceLlmConfigWithProvider[] };
}

export async function upsertLlmConfigAction(input: unknown): Promise<ActionResult> {
  const parsed = upsertLlmConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, workspaceSlug, configs } = parsed.data;
  const supabase = await createClient();

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return { success: false, error: "Sin permisos" };

  const rows = configs.map((c) => ({
    workspace_id: workspaceId,
    llm_provider_id: c.llmProviderId,
    prompts_per_day: c.promptsPerDay,
    enabled: c.promptsPerDay > 0,
    model: c.model ?? null,
  }));

  const { error } = await supabase
    .from("workspace_llm_config")
    .upsert(rows, { onConflict: "workspace_id,llm_provider_id" });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/${workspaceSlug}/settings`);
  return { success: true };
}
