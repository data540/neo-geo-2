import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { detectBrands } from "@/lib/detection/detectBrands";
import { calculateConsistency, calculateSOV } from "@/lib/metrics/calculate";
import type { Brand, LlmProvider, LlmProviderKey, Workspace } from "@/types";
import { runPrompt } from "./runner";

export interface SharedRunContext {
  workspace: Pick<Workspace, "id" | "slug">;
  ownBrand: Pick<Brand, "id" | "name" | "aliases">;
  competitors: Pick<Brand, "id" | "name" | "aliases">[];
  llmProvider: Pick<LlmProvider, "id" | "key">;
}

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function executePromptRun(runId: string): Promise<void> {
  const supabase = getServiceClient();

  // 1) Cargar run con su contexto
  const { data: run } = await supabase
    .from("prompt_runs")
    .select("id, workspace_id, prompt_id, llm_provider_id")
    .eq("id", runId)
    .single();

  if (!run) {
    console.error(`[executePromptRun] run not found: ${runId}`);
    return;
  }

  // 2) Marcar como running
  await supabase
    .from("prompt_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);

  try {
    // 3) Obtener prompt, workspace, brands y provider en paralelo
    const [
      { data: prompt },
      { data: workspace },
      { data: ownBrands },
      { data: competitorBrands },
      { data: llmProvider },
    ] = await Promise.all([
      supabase.from("prompts").select("*").eq("id", run.prompt_id).single(),
      supabase.from("workspaces").select("*").eq("id", run.workspace_id).single(),
      supabase.from("brands").select("*").eq("workspace_id", run.workspace_id).eq("type", "own"),
      supabase
        .from("brands")
        .select("*")
        .eq("workspace_id", run.workspace_id)
        .eq("type", "competitor"),
      supabase.from("llm_providers").select("*").eq("id", run.llm_provider_id).single(),
    ]);

    if (!prompt || !workspace || !llmProvider) {
      throw new Error("Contexto del run no encontrado");
    }

    const ownBrand = (ownBrands ?? [])[0] as Brand | undefined;
    if (!ownBrand) throw new Error("No hay brand propia en el workspace");

    // 4) Llamar al LLM
    const llmResult = await runPrompt({
      provider: llmProvider.key as LlmProviderKey,
      prompt: prompt.text as string,
      workspace: { id: workspace.id as string, slug: workspace.slug as string },
      brand: { name: ownBrand.name, aliases: ownBrand.aliases },
      competitors: (competitorBrands ?? []).map((c: Brand) => ({
        name: c.name,
        aliases: c.aliases,
      })),
    });

    // 5) Guardar respuesta y marcar como completed
    await supabase
      .from("prompt_runs")
      .update({
        raw_response: llmResult.rawResponse,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    // 6) Detectar marcas
    const detection = detectBrands({
      rawResponse: llmResult.rawResponse,
      ownBrand: { id: ownBrand.id, name: ownBrand.name, aliases: ownBrand.aliases },
      competitors: (competitorBrands ?? []).map((c: Brand) => ({
        id: c.id,
        name: c.name,
        aliases: c.aliases,
      })),
    });

    // 7) Insertar mentions
    const mentions: Record<string, unknown>[] = [];
    if (detection.ownBrandMentioned) {
      mentions.push({
        workspace_id: run.workspace_id,
        prompt_run_id: runId,
        brand_id: ownBrand.id,
        brand_name_detected: detection.detectedBrandName,
        brand_type: "own",
        position: detection.ownBrandPosition,
        sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
        confidence: detection.confidence,
      });
    }
    for (const comp of detection.competitors) {
      mentions.push({
        workspace_id: run.workspace_id,
        prompt_run_id: runId,
        brand_id: comp.brandId,
        brand_name_detected: comp.name,
        brand_type: "competitor",
        position: comp.position,
        sentiment: comp.sentiment,
        confidence: comp.confidence,
      });
    }
    if (mentions.length > 0) {
      await supabase.from("mentions").insert(mentions);
    }

    // 8) Upsert daily_prompt_metrics
    const today = new Date().toISOString().slice(0, 10);
    const sov = calculateSOV(detection.ownBrandMentioned ? 1 : 0, detection.competitors.length);

    const { data: recentRuns } = await supabase
      .from("prompt_runs")
      .select("id")
      .eq("prompt_id", run.prompt_id)
      .eq("llm_provider_id", run.llm_provider_id)
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

    await supabase.from("daily_prompt_metrics").upsert(
      {
        workspace_id: run.workspace_id,
        prompt_id: run.prompt_id,
        llm_provider_id: run.llm_provider_id,
        date: today,
        brand_mentioned: detection.ownBrandMentioned,
        brand_position: detection.ownBrandPosition,
        competitor_count: detection.competitors.length,
        sov,
        sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
        consistency_score: calculateConsistency(mentionCount, recentRunIds.length || 1),
      },
      { onConflict: "prompt_id,llm_provider_id,date" }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[executePromptRun] run ${runId} failed:`, errMsg);
    await supabase
      .from("prompt_runs")
      .update({ status: "failed", error_message: errMsg, completed_at: new Date().toISOString() })
      .eq("id", runId);
  }
}

/**
 * Variante optimizada para batches grandes: recibe el contexto pre-cargado
 * (workspace, brands, provider) y sólo hace 1 query de lectura (el prompt text)
 * + escrituras en paralelo. Pensada para el flow de creación de workspace donde
 * 50 prompts comparten el mismo contexto.
 */
export async function executePromptRunFast(runId: string, ctx: SharedRunContext): Promise<void> {
  const supabase = getServiceClient();

  // 1) Cargar prompt_run + prompt.text en una sola query
  const { data: run } = await supabase
    .from("prompt_runs")
    .select("id, prompt_id, prompts!inner(text)")
    .eq("id", runId)
    .single<{
      id: string;
      prompt_id: string;
      prompts: { text: string };
    }>();

  if (!run) {
    console.error(`[executePromptRunFast] run not found: ${runId}`);
    return;
  }

  // 2) Marcar como running
  await supabase
    .from("prompt_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);

  try {
    // 3) Llamada al LLM (path caliente — dominante en latencia)
    const llmResult = await runPrompt({
      provider: ctx.llmProvider.key as LlmProviderKey,
      prompt: run.prompts.text,
      workspace: { id: ctx.workspace.id, slug: ctx.workspace.slug },
      brand: { name: ctx.ownBrand.name, aliases: ctx.ownBrand.aliases },
      competitors: ctx.competitors.map((c) => ({ name: c.name, aliases: c.aliases })),
    });

    // 4) Detectar marcas en memoria
    const detection = detectBrands({
      rawResponse: llmResult.rawResponse,
      ownBrand: { id: ctx.ownBrand.id, name: ctx.ownBrand.name, aliases: ctx.ownBrand.aliases },
      competitors: ctx.competitors.map((c) => ({
        id: c.id,
        name: c.name,
        aliases: c.aliases,
      })),
    });

    // 5) Construir mentions
    const mentions: Record<string, unknown>[] = [];
    if (detection.ownBrandMentioned) {
      mentions.push({
        workspace_id: ctx.workspace.id,
        prompt_run_id: runId,
        brand_id: ctx.ownBrand.id,
        brand_name_detected: detection.detectedBrandName,
        brand_type: "own",
        position: detection.ownBrandPosition,
        sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
        confidence: detection.confidence,
      });
    }
    for (const comp of detection.competitors) {
      mentions.push({
        workspace_id: ctx.workspace.id,
        prompt_run_id: runId,
        brand_id: comp.brandId,
        brand_name_detected: comp.name,
        brand_type: "competitor",
        position: comp.position,
        sentiment: comp.sentiment,
        confidence: comp.confidence,
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const sov = calculateSOV(detection.ownBrandMentioned ? 1 : 0, detection.competitors.length);

    // 6) Tres escrituras en paralelo (update run + insert mentions + upsert metrics)
    await Promise.all([
      supabase
        .from("prompt_runs")
        .update({
          raw_response: llmResult.rawResponse,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId),
      mentions.length > 0 ? supabase.from("mentions").insert(mentions) : Promise.resolve(),
      supabase.from("daily_prompt_metrics").upsert(
        {
          workspace_id: ctx.workspace.id,
          prompt_id: run.prompt_id,
          llm_provider_id: ctx.llmProvider.id,
          date: today,
          brand_mentioned: detection.ownBrandMentioned,
          brand_position: detection.ownBrandPosition,
          competitor_count: detection.competitors.length,
          sov,
          sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
          consistency_score: detection.ownBrandMentioned ? 100 : 0,
        },
        { onConflict: "prompt_id,llm_provider_id,date" }
      ),
    ]);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[executePromptRunFast] run ${runId} failed:`, errMsg);
    await supabase
      .from("prompt_runs")
      .update({ status: "failed", error_message: errMsg, completed_at: new Date().toISOString() })
      .eq("id", runId);
  }
}
