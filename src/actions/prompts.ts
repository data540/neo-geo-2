"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { executePromptRun } from "@/lib/llm/executePromptRun";
import { createClient } from "@/lib/supabase/server";
import {
  bulkCreatePromptsSchema,
  createPromptSchema,
  runPromptSchema,
  togglePromptStatusSchema,
} from "@/lib/validations/schemas";
import type { ActionResult } from "@/types";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const PROMPT_HEADER_TOKENS = new Set([
  "prompt",
  "prompts",
  "pregunta",
  "preguntas",
  "question",
  "questions",
  "texto",
  "text",
  "contenido",
  "content",
  "mensaje",
  "mensajes",
  "query",
  "consulta",
]);

function normalizeHeaderToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/["'`]/g, "");
}

function isHeaderLikeLine(value: string): boolean {
  const normalized = normalizeHeaderToken(value);
  return PROMPT_HEADER_TOKENS.has(normalized);
}

function splitPromptLines(text: string): string[] {
  const hasRealLineBreak = /[\r\n\u2028\u2029]/u.test(text);
  const normalizedText = hasRealLineBreak
    ? text.replace(/\r\n|\r|\u2028|\u2029/gu, "\n")
    : text.replace(/\\r\\n|\\n|\\r/g, "\n");

  const lines = normalizedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const firstLine = lines[0];
  if (typeof firstLine === "string" && isHeaderLikeLine(firstLine)) {
    return lines.slice(1);
  }

  return lines;
}

async function requireManage(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  return data === true;
}

async function getWorkspaceSlug(workspaceId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("slug").eq("id", workspaceId).single();
  return data?.slug ?? null;
}

export async function createPromptAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = {
    text: formData.get("text") as string,
    country: (formData.get("country") as string) || "ES",
    workspaceId: formData.get("workspaceId") as string,
  };

  const parsed = createPromptSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { text, country, workspaceId } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompts")
    .insert({ workspace_id: workspaceId, text, country, status: "active" })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: "Error al crear el prompt" };
  }

  const workspaceSlug = await getWorkspaceSlug(workspaceId);
  if (workspaceSlug) revalidatePath(`/${workspaceSlug}/prompts`);

  return { success: true, data: { id: data.id } };
}

export async function deletePromptAction(
  promptId: string,
  workspaceId: string
): Promise<ActionResult> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("prompts")
    .delete()
    .eq("id", promptId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { success: false, error: "Error al eliminar el prompt" };
  }

  const workspaceSlug = await getWorkspaceSlug(workspaceId);
  if (workspaceSlug) revalidatePath(`/${workspaceSlug}/prompts`);

  return { success: true };
}

export async function deletePromptsBulkAction(
  promptIds: string[],
  workspaceId: string
): Promise<ActionResult<{ deleted: number }>> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const uniqueIds = Array.from(new Set(promptIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { success: false, error: "No hay prompts seleccionados" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompts")
    .delete()
    .eq("workspace_id", workspaceId)
    .in("id", uniqueIds)
    .select("id");

  if (error) {
    return { success: false, error: "Error al eliminar prompts" };
  }

  const workspaceSlug = await getWorkspaceSlug(workspaceId);
  if (workspaceSlug) revalidatePath(`/${workspaceSlug}/prompts`);

  return { success: true, data: { deleted: data?.length ?? 0 } };
}

export async function togglePromptStatusAction(data: unknown): Promise<ActionResult> {
  const parsed = togglePromptStatusSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { promptId, workspaceId, status } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("prompts")
    .update({ status })
    .eq("id", promptId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { success: false, error: "Error al actualizar el estado" };
  }

  const workspaceSlug = await getWorkspaceSlug(workspaceId);
  if (workspaceSlug) revalidatePath(`/${workspaceSlug}/prompts`);

  return { success: true };
}

export async function runPromptNowAction(data: unknown): Promise<ActionResult> {
  const parsed = runPromptSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { promptId, workspaceId, llmKey } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const supabase = getServiceClient();

  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", llmKey)
    .single();

  if (!provider) return { success: false, error: "Proveedor LLM no encontrado" };

  const { data: run, error: runError } = await supabase
    .from("prompt_runs")
    .insert({
      workspace_id: workspaceId,
      prompt_id: promptId,
      llm_provider_id: provider.id,
      status: "queued",
    })
    .select("id")
    .single();

  if (runError || !run) return { success: false, error: "No se pudo crear el run" };

  // Fire & forget — el run se ejecuta en background, la UI hace polling
  void executePromptRun(run.id);

  const { data: ws } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();

  if (ws?.slug) {
    revalidatePath(`/${ws.slug}/prompts`);
  }

  return { success: true };
}

export async function createPromptsBulkAction(
  data: unknown
): Promise<ActionResult<{ created: number; queued: number }>> {
  const parsed = bulkCreatePromptsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, country, prompts, rawText, runAfterImport, llmKey } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const fromRawText = splitPromptLines(rawText ?? "");

  const normalizedPrompts = Array.from(
    new Set([...(prompts ?? []), ...fromRawText].map((p) => p.trim()).filter((p) => p.length > 0))
  );

  if (normalizedPrompts.length === 0) {
    return { success: false, error: "No se detectaron prompts para importar" };
  }

  const supabase = await createClient();
  const { data: insertedPrompts, error } = await supabase
    .from("prompts")
    .insert(
    normalizedPrompts.map((text) => ({
      workspace_id: workspaceId,
      text,
      country,
      status: "active",
    }))
    )
    .select("id");

  if (error) {
    return { success: false, error: "Error al importar prompts" };
  }

  let queued = 0;
  if (runAfterImport && insertedPrompts && insertedPrompts.length > 0) {
    const service = getServiceClient();
    const { data: provider } = await service.from("llm_providers").select("id").eq("key", llmKey).single();
    if (provider) {
      const { data: createdRuns } = await service
        .from("prompt_runs")
        .insert(
          insertedPrompts.map((p) => ({
            workspace_id: workspaceId,
            prompt_id: p.id as string,
            llm_provider_id: provider.id,
            status: "queued",
          }))
        )
        .select("id");

      const runIds = (createdRuns ?? []).map((r) => r.id as string);
      queued = runIds.length;

      // Cola secuencial: ejecuta uno a uno para evitar ráfagas.
      void (async () => {
        for (const runId of runIds) {
          try {
            await executePromptRun(runId);
          } catch (e) {
            console.error("[createPromptsBulkAction] run failed:", runId, e);
          }
        }
      })();
    }
  }

  const workspaceSlug = await getWorkspaceSlug(workspaceId);
  if (workspaceSlug) revalidatePath(`/${workspaceSlug}/prompts`);

  return { success: true, data: { created: normalizedPrompts.length, queued } };
}
