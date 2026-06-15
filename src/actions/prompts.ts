"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { remainingRunsToday } from "@/lib/llm/dailyCap";
import { splitPromptLines } from "@/lib/prompts/parsePromptLines";
import { createClient } from "@/lib/supabase/server";
import {
  bulkCreatePromptsSchema,
  createPromptSchema,
  runPromptSchema,
  togglePromptStatusSchema,
} from "@/lib/validations/schemas";
import type {
  ActionResult,
  PromptDetail,
  PromptDetailCompetitor,
  PromptDetailRun,
  PromptDetailSource,
} from "@/types";

const UNLIMITED_EMAILS = ["tester@gmail.com"];

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function isUnlimitedUser(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return UNLIMITED_EMAILS.includes(user?.email ?? "");
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

  const { promptId, workspaceId } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const supabase = getServiceClient();

  // Cargar todos los LLMs habilitados del workspace
  const { data: llmConfigs } = await supabase
    .from("workspace_llm_config")
    .select("llm_provider_id")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);

  const providerIds = (llmConfigs ?? []).map((c) => c.llm_provider_id as string);
  if (providerIds.length === 0) {
    return { success: false, error: "No hay LLMs habilitados en este workspace" };
  }

  // Cap duro diario: no superar el remanente del día
  const unlimited = await isUnlimitedUser();
  const remaining = unlimited ? 999_999 : await remainingRunsToday(supabase, workspaceId);
  if (remaining <= 0) {
    return { success: false, error: "Límite diario de ejecuciones alcanzado. Inténtalo mañana." };
  }

  // Crear N runs (uno por LLM habilitado), recortado al remanente diario
  const { data: runs, error: runError } = await supabase
    .from("prompt_runs")
    .insert(
      providerIds.slice(0, remaining).map((llmProviderId) => ({
        workspace_id: workspaceId,
        prompt_id: promptId,
        llm_provider_id: llmProviderId,
        status: "queued",
      }))
    )
    .select("id");

  if (runError || !runs || runs.length === 0) {
    return { success: false, error: "No se pudieron crear los runs" };
  }

  const runIds = runs.map((r) => r.id as string);

  try {
    await inngest.send({
      name: "prompt/run.multi",
      data: { promptId, workspaceId, runIds },
    });
  } catch (err) {
    console.warn(
      "[runPromptNowAction] Inngest no disponible, runs queued en BD:",
      err instanceof Error ? err.message : String(err)
    );
  }

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
): Promise<ActionResult<{ created: number; queued: number; warning?: string }>> {
  const parsed = bulkCreatePromptsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, country, prompts, rawText, runAfterImport } = parsed.data;

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
  let warning: string | undefined;
  if (runAfterImport && insertedPrompts && insertedPrompts.length > 0) {
    const service = getServiceClient();

    const { data: llmConfigs } = await service
      .from("workspace_llm_config")
      .select("llm_provider_id")
      .eq("workspace_id", workspaceId)
      .eq("enabled", true);

    const providerIds = (llmConfigs ?? []).map((c) => c.llm_provider_id as string);

    const unlimitedBulk = await isUnlimitedUser();
    const remaining = providerIds.length > 0 ? (unlimitedBulk ? 999_999 : await remainingRunsToday(service, workspaceId)) : 0;

    if (providerIds.length > 0 && remaining <= 0) {
      warning =
        "Los prompts se importaron, pero se alcanzó el límite diario de ejecuciones. Se ejecutarán mañana.";
    } else if (providerIds.length > 0) {
      const runRows = insertedPrompts
        .flatMap((p) =>
          providerIds.map((llmProviderId) => ({
            workspace_id: workspaceId,
            prompt_id: p.id as string,
            llm_provider_id: llmProviderId,
            status: "queued",
          }))
        )
        .slice(0, remaining);

      const { data: createdRuns, error: runsError } = await service
        .from("prompt_runs")
        .insert(runRows)
        .select("id, prompt_id");

      if (runsError) {
        warning =
          "Los prompts se importaron, pero no se pudieron crear las ejecuciones automáticas.";
      }

      if (!runsError && createdRuns && createdRuns.length > 0) {
        const events = insertedPrompts
          .map((p) => {
            const promptRunIds = createdRuns
              .filter((r) => r.prompt_id === p.id)
              .map((r) => r.id as string);
            return {
              name: "prompt/run.multi" as const,
              data: { promptId: p.id as string, workspaceId, runIds: promptRunIds },
            };
          })
          .filter((event) => event.data.runIds.length > 0);

        if (events.length > 0) {
          try {
            await inngest.send(events);
            queued = createdRuns.length;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Error desconocido";
            warning =
              "Los prompts se importaron, pero no se pudieron encolar en Inngest. Comprueba que Inngest dev esté arrancado o desactiva la ejecución automática al importar.";

            await service
              .from("prompt_runs")
              .delete()
              .in(
                "id",
                createdRuns.map((run) => run.id as string)
              );

            console.warn(`[createPromptsBulkAction] Inngest enqueue failed: ${message}`);
          }
        }
      }
    } else {
      warning = "Los prompts se importaron, pero no hay LLMs habilitados para ejecutarlos.";
    }
  }

  const workspaceSlug = await getWorkspaceSlug(workspaceId);
  if (workspaceSlug) revalidatePath(`/${workspaceSlug}/prompts`);

  return { success: true, data: { created: normalizedPrompts.length, queued, warning } };
}

export async function runAllPromptsNowAction(
  workspaceId: string
): Promise<ActionResult<{ prompts: number; runs: number }>> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const service = getServiceClient();

  // Cargar todos los prompts activos del workspace
  const { data: activePrompts } = await service
    .from("prompts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (!activePrompts || activePrompts.length === 0) {
    return { success: false, error: "No hay prompts activos en este workspace" };
  }

  // Cargar todos los LLM providers habilitados del workspace
  const { data: llmConfigs } = await service
    .from("workspace_llm_config")
    .select("llm_provider_id")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);

  const providerIds = (llmConfigs ?? []).map((c) => c.llm_provider_id as string);
  if (providerIds.length === 0) {
    return { success: false, error: "No hay LLMs habilitados en este workspace" };
  }

  // Cap duro diario: no crear más runs de los que permita el remanente del día
  const unlimitedAll = await isUnlimitedUser();
  const remaining = unlimitedAll ? 999_999 : await remainingRunsToday(service, workspaceId);
  if (remaining <= 0) {
    return { success: false, error: "Límite diario de ejecuciones alcanzado. Inténtalo mañana." };
  }

  // Crear runs: N prompts × M providers, recortado al remanente diario
  const runRows = activePrompts
    .flatMap((p) =>
      providerIds.map((llmProviderId) => ({
        workspace_id: workspaceId,
        prompt_id: p.id as string,
        llm_provider_id: llmProviderId,
        status: "queued",
      }))
    )
    .slice(0, remaining);

  const { data: createdRuns, error: runError } = await service
    .from("prompt_runs")
    .insert(runRows)
    .select("id, prompt_id");

  if (runError || !createdRuns || createdRuns.length === 0) {
    return { success: false, error: "No se pudieron crear los runs" };
  }

  // Disparar un evento prompt/run.multi por cada prompt con runs creados
  const events = activePrompts
    .map((p) => {
      const promptRunIds = createdRuns
        .filter((r) => r.prompt_id === p.id)
        .map((r) => r.id as string);
      return {
        name: "prompt/run.multi" as const,
        data: { promptId: p.id as string, workspaceId, runIds: promptRunIds },
      };
    })
    .filter((event) => event.data.runIds.length > 0);

  if (events.length > 0) {
    try {
      await inngest.send(events);
    } catch (err) {
      console.warn(
        "[runAllPromptsNowAction] Inngest no disponible, runs queued en BD:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  const workspaceSlug = await getWorkspaceSlug(workspaceId);
  if (workspaceSlug) revalidatePath(`/${workspaceSlug}/prompts`);

  return {
    success: true,
    data: { prompts: activePrompts.length, runs: createdRuns.length },
  };
}

export async function runPromptsBulkNowAction(
  promptIds: string[],
  workspaceId: string
): Promise<ActionResult<{ prompts: number; runs: number }>> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const uniquePromptIds = Array.from(new Set(promptIds.map((id) => id.trim()).filter(Boolean)));
  if (uniquePromptIds.length === 0) {
    return { success: false, error: "No hay prompts seleccionados" };
  }

  const service = getServiceClient();

  const { data: prompts, error: promptsError } = await service
    .from("prompts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", uniquePromptIds);

  if (promptsError || !prompts || prompts.length === 0) {
    return { success: false, error: "No se encontraron prompts válidos para ejecutar" };
  }

  const { data: llmConfigs } = await service
    .from("workspace_llm_config")
    .select("llm_provider_id")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);

  const providerIds = (llmConfigs ?? []).map((c) => c.llm_provider_id as string);
  if (providerIds.length === 0) {
    return { success: false, error: "No hay LLMs habilitados en este workspace" };
  }

  // Cap duro diario: recortar los runs al remanente del día
  const unlimitedBulkNow = await isUnlimitedUser();
  const remaining = unlimitedBulkNow ? 999_999 : await remainingRunsToday(service, workspaceId);
  if (remaining <= 0) {
    return { success: false, error: "Límite diario de ejecuciones alcanzado. Inténtalo mañana." };
  }

  const runRows = prompts
    .flatMap((prompt) =>
      providerIds.map((llmProviderId) => ({
        workspace_id: workspaceId,
        prompt_id: prompt.id as string,
        llm_provider_id: llmProviderId,
        status: "queued",
      }))
    )
    .slice(0, remaining);

  const { data: createdRuns, error: runError } = await service
    .from("prompt_runs")
    .insert(runRows)
    .select("id, prompt_id");

  if (runError || !createdRuns || createdRuns.length === 0) {
    return { success: false, error: "No se pudieron crear los runs" };
  }

  const events = prompts
    .map((prompt) => {
      const promptRunIds = createdRuns
        .filter((run) => run.prompt_id === prompt.id)
        .map((run) => run.id as string);
      return {
        name: "prompt/run.multi" as const,
        data: { promptId: prompt.id as string, workspaceId, runIds: promptRunIds },
      };
    })
    .filter((event) => event.data.runIds.length > 0);

  try {
    await inngest.send(events);
  } catch (err) {
    console.warn(
      "[runPromptsBulkNowAction] Inngest no disponible, runs queued en BD:",
      err instanceof Error ? err.message : String(err)
    );
  }

  const workspaceSlug = await getWorkspaceSlug(workspaceId);
  if (workspaceSlug) revalidatePath(`/${workspaceSlug}/prompts`);

  return {
    success: true,
    data: { prompts: prompts.length, runs: createdRuns.length },
  };
}

const EMPTY_PROMPT_DETAIL: PromptDetail = {
  competitors: [],
  sources: [],
  runs: [],
};

const promptIdSchema = z.string().uuid("ID de prompt inválido");

export async function getPromptDetailAction(promptId: string): Promise<ActionResult<PromptDetail>> {
  const parsed = promptIdSchema.safeParse(promptId);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "ID inválido" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_prompt_detail", {
    p_prompt_id: parsed.data,
  });

  if (error) {
    return { success: false, error: "No se pudo cargar el detalle del prompt" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { success: true, data: EMPTY_PROMPT_DETAIL };
  }

  const detail: PromptDetail = {
    competitors: (row.competitors ?? []) as PromptDetailCompetitor[],
    sources: (row.sources ?? []) as PromptDetailSource[],
    runs: (row.runs ?? []) as PromptDetailRun[],
  };

  return { success: true, data: detail };
}
