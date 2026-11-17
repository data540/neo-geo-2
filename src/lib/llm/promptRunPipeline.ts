/**
 * Pipeline completo de ejecución de un prompt en un LLM, en 3 fases.
 *
 * Es la misma lógica que tenía `runPromptManual` (Inngest) en 13 pasos, ahora
 * compartida para que la usen:
 *   - Inngest (`runPromptManual`): una fase por step → ~4 ejecuciones por run
 *     en lugar de ~14 (el plan Hobby tiene 50.000/mes).
 *   - Ejecutores sin Inngest (scripts / cron alternativo), llamando a
 *     `runPromptPipeline` directamente.
 *
 * Fases:
 *   1. prepareRun      — cap diario + contexto + crear prompt_run ('running')
 *   2. callLlmAndSave  — llamada al modelo + guardar respuesta ('completed').
 *                        Si falla, marca el run como 'failed' y relanza.
 *   3. postProcessRun  — competidores, marcas, fuentes, menciones, análisis
 *                        LLM (sentiment + ranking) y métricas diarias.
 *                        Idempotente: borra las menciones del run antes.
 *
 * No importa nada de Next.js: la revalidación de rutas la hace el llamador.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectBrands } from "@/lib/detection/detectBrands";
import { countRunsToday, getWorkspaceDailyCap } from "@/lib/llm/dailyCap";
import { extractCompetitorsForRun } from "@/lib/llm/extractCompetitorsForRun";
import { analyzeMentionsBatch } from "@/lib/llm/mentionAnalyzer";
import { persistSourcesForRun } from "@/lib/llm/persistSources";
import { estimateCostForModel } from "@/lib/llm/pricing";
import { runPrompt } from "@/lib/llm/runner";
import { calculateConsistency, calculateSOV } from "@/lib/metrics/calculate";
import { upsertDailyWorkspaceMetrics } from "@/lib/metrics/upsertDailyWorkspaceMetrics";
import type { Brand, LlmProviderKey } from "@/types";

export interface PromptRunInput {
  promptId: string;
  workspaceId: string;
  llmKey: LlmProviderKey;
}

export interface PromptRunContext {
  prompt: Record<string, unknown>;
  workspace: Record<string, unknown>;
  ownBrands: Brand[];
  competitorBrands: Brand[];
  llmProvider: Record<string, unknown>;
  modelOverride: string | null;
}

export type PrepareResult =
  | { skipped: true; runsToday: number; hardCap: number }
  | { skipped: false; context: PromptRunContext; runId: string };

export type LlmResult = Awaited<ReturnType<typeof runPrompt>>;

// ── Fase 1 ────────────────────────────────────────────────────────────────────
export async function prepareRun(
  supabase: SupabaseClient,
  { promptId, workspaceId, llmKey }: PromptRunInput
): Promise<PrepareResult> {
  // Guard: cap duro GLOBAL de runs por workspace (suma de todos los proveedores).
  const [hardCap, runsToday] = await Promise.all([
    getWorkspaceDailyCap(supabase, workspaceId),
    countRunsToday(supabase, workspaceId),
  ]);
  if (runsToday >= hardCap) return { skipped: true, runsToday, hardCap };

  const [p, w, b, c, l] = await Promise.all([
    supabase.from("prompts").select("*").eq("id", promptId).single(),
    supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
    supabase.from("brands").select("*").eq("workspace_id", workspaceId).eq("type", "own"),
    supabase.from("brands").select("*").eq("workspace_id", workspaceId).eq("type", "competitor"),
    supabase.from("llm_providers").select("*").eq("key", llmKey).eq("enabled", true).single(),
  ]);

  const llmProviderId = l.data?.id as string | undefined;
  let modelOverride: string | null = null;
  if (llmProviderId) {
    const { data: cfg } = await supabase
      .from("workspace_llm_config")
      .select("model")
      .eq("workspace_id", workspaceId)
      .eq("llm_provider_id", llmProviderId)
      .single();
    modelOverride = (cfg as { model: string | null } | null)?.model ?? null;
  }

  if (!p.data || !w.data || !l.data) throw new Error("Datos de contexto no encontrados");
  const ownBrands = (b.data ?? []) as Brand[];
  if (!ownBrands[0]) throw new Error("No hay brand propia en el workspace");

  // Crear el run al final: si algo anterior falla, un reintento no deja huérfanos.
  const { data, error } = await supabase
    .from("prompt_runs")
    .insert({
      workspace_id: workspaceId,
      prompt_id: promptId,
      llm_provider_id: l.data.id,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear el prompt_run");

  return {
    skipped: false,
    runId: data.id as string,
    context: {
      prompt: p.data,
      workspace: w.data,
      ownBrands,
      competitorBrands: (c.data ?? []) as Brand[],
      llmProvider: l.data,
      modelOverride,
    },
  };
}

// ── Fase 2 ────────────────────────────────────────────────────────────────────
export async function callLlmAndSave(
  supabase: SupabaseClient,
  llmKey: LlmProviderKey,
  context: PromptRunContext,
  runId: string
): Promise<LlmResult> {
  const ownBrand = context.ownBrands[0] as Brand;
  try {
    const result = await runPrompt({
      provider: llmKey,
      prompt: context.prompt.text as string,
      workspace: { id: context.workspace.id as string, slug: context.workspace.slug as string },
      brand: { name: ownBrand.name, aliases: ownBrand.aliases },
      competitors: context.competitorBrands.map((c) => ({ name: c.name, aliases: c.aliases })),
      modelOverride: context.modelOverride ?? undefined,
    });

    const estimatedCost =
      result.costUsd ??
      (await estimateCostForModel(result.model, result.inputTokens, result.outputTokens));

    const { error } = await supabase
      .from("prompt_runs")
      .update({
        raw_response: result.rawResponse,
        model: result.model,
        input_tokens: result.inputTokens ?? null,
        output_tokens: result.outputTokens ?? null,
        cost_usd: estimatedCost,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (error) throw new Error(`No se pudo guardar la respuesta: ${error.message}`);

    return result;
  } catch (err) {
    await supabase
      .from("prompt_runs")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    throw err;
  }
}

// ── Fase 3 ────────────────────────────────────────────────────────────────────
export async function postProcessRun(
  supabase: SupabaseClient,
  { promptId, workspaceId }: PromptRunInput,
  context: PromptRunContext,
  runId: string,
  llmResult: LlmResult
): Promise<void> {
  const ownBrand = context.ownBrands[0] as Brand;
  const llmProviderId = context.llmProvider.id as string;

  // Extraer competidores nuevos (gate LLM). No bloquea si falla.
  try {
    await extractCompetitorsForRun({
      supabase,
      workspaceId,
      promptRunId: runId,
      rawResponse: llmResult.rawResponse,
      ownBrandName: ownBrand.name,
      workspaceDomain: context.workspace.domain as string | null,
      businessContext: context.workspace.brand_statement as string | null,
    });
  } catch (err) {
    console.error("[extract-competitors] failed, run continues:", err);
  }

  // Detectar marcas
  const detection = detectBrands({
    rawResponse: llmResult.rawResponse,
    ownBrand: { id: ownBrand.id, name: ownBrand.name, aliases: ownBrand.aliases },
    competitors: context.competitorBrands.map((c) => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases,
    })),
  });

  // Fuentes citadas (persistSourcesForRun ya borra las previas del run)
  await persistSourcesForRun({
    supabase,
    workspaceId,
    promptRunId: runId,
    rawResponse: llmResult.rawResponse,
    citations: llmResult.citations,
  });

  // Menciones (idempotente ante reintentos)
  await supabase.from("mentions").delete().eq("prompt_run_id", runId);
  const mentions: Record<string, unknown>[] = [];
  if (detection.ownBrandMentioned) {
    mentions.push({
      workspace_id: workspaceId,
      prompt_run_id: runId,
      brand_id: ownBrand.id,
      brand_name_detected: detection.detectedBrandName,
      brand_type: "own",
      position: detection.ownBrandPosition,
      position_source: detection.ownBrandPositionSource,
      sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
      mention_type: detection.mentionType,
      confidence: detection.confidence,
    });
  }
  for (const comp of detection.competitors) {
    mentions.push({
      workspace_id: workspaceId,
      prompt_run_id: runId,
      brand_id: comp.brandId,
      brand_name_detected: comp.name,
      brand_type: "competitor",
      position: comp.position,
      position_source: comp.positionSource,
      sentiment: comp.sentiment,
      mention_type: comp.mentionType,
      confidence: comp.confidence,
    });
  }
  if (mentions.length > 0) {
    const { error } = await supabase.from("mentions").insert(mentions);
    if (error) throw new Error(`No se pudieron insertar menciones: ${error.message}`);
  }

  // Análisis combinado (sentiment + ranking) en UNA llamada LLM.
  // El rank solo se aplica si la heurística no detectó lista.
  const { data: mentionsRun } = await supabase
    .from("mentions")
    .select("brand_name_detected, position_source")
    .eq("prompt_run_id", runId);
  const brandNames = (mentionsRun ?? [])
    .map((m) => m.brand_name_detected)
    .filter((n): n is string => Boolean(n));
  if (brandNames.length > 0) {
    const applyRank = (mentionsRun ?? []).every(
      (m) => m.position_source === "appearance_order" || m.position_source === null
    );
    try {
      const results = await analyzeMentionsBatch(llmResult.rawResponse, brandNames);
      for (const r of results) {
        await supabase
          .from("mentions")
          .update({
            sentiment_score: r.score,
            sentiment_confidence: r.confidence,
            sentiment_source: "llm",
          })
          .eq("prompt_run_id", runId)
          .eq("brand_name_detected", r.brandName);
        if (applyRank && r.rank !== null) {
          await supabase
            .from("mentions")
            .update({ position: r.rank, position_source: "llm" })
            .eq("prompt_run_id", runId)
            .eq("brand_name_detected", r.brandName);
        }
      }
    } catch (err) {
      console.error("[analyze-mentions-llm] failed, keeping heuristic fallback:", err);
    }
  }

  // daily_prompt_metrics + daily_workspace_metrics
  const today = new Date().toISOString().slice(0, 10);
  const competitorCount = detection.competitors.length;
  const sov = calculateSOV(detection.ownBrandMentioned ? 1 : 0, competitorCount);

  const { data: recentRuns } = await supabase
    .from("prompt_runs")
    .select("id")
    .eq("prompt_id", promptId)
    .eq("llm_provider_id", llmProviderId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(5);
  const recentRunIds = (recentRuns ?? []).map((r) => r.id as string);
  let mentionCount = 0;
  if (recentRunIds.length > 0) {
    const { count } = await supabase
      .from("mentions")
      .select("*", { count: "exact", head: true })
      .in("prompt_run_id", recentRunIds)
      .eq("brand_type", "own");
    mentionCount = count ?? 0;
  }
  const consistencyScore = calculateConsistency(mentionCount, recentRunIds.length || 1);

  await supabase.from("daily_prompt_metrics").upsert(
    {
      workspace_id: workspaceId,
      prompt_id: promptId,
      llm_provider_id: llmProviderId,
      date: today,
      brand_mentioned: detection.ownBrandMentioned,
      brand_position: detection.ownBrandPosition,
      competitor_count: competitorCount,
      sov,
      sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
      consistency_score: consistencyScore,
    },
    { onConflict: "prompt_id,llm_provider_id,date" }
  );

  await upsertDailyWorkspaceMetrics({ supabase, workspaceId, llmProviderId, date: today });
}

/** Las 3 fases seguidas, para ejecutores sin Inngest. */
export async function runPromptPipeline(
  supabase: SupabaseClient,
  input: PromptRunInput
): Promise<{ skipped: boolean; runId?: string; workspaceSlug?: string }> {
  const prepared = await prepareRun(supabase, input);
  if (prepared.skipped) return { skipped: true };
  const llmResult = await callLlmAndSave(supabase, input.llmKey, prepared.context, prepared.runId);
  await postProcessRun(supabase, input, prepared.context, prepared.runId, llmResult);
  return {
    skipped: false,
    runId: prepared.runId,
    workspaceSlug: prepared.context.workspace.slug as string,
  };
}
