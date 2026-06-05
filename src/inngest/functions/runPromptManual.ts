import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { detectBrands } from "@/lib/detection/detectBrands";
import { persistSourcesForRun } from "@/lib/llm/persistSources";
import { estimateCostForModel } from "@/lib/llm/pricing";
import { runPrompt } from "@/lib/llm/runner";
import { countRunsToday, getWorkspaceDailyCap } from "@/lib/llm/dailyCap";
import { analyzeMentionsBatch } from "@/lib/llm/mentionAnalyzer";
import { calculateConsistency, calculateSOV } from "@/lib/metrics/calculate";
import { upsertDailyWorkspaceMetrics } from "@/lib/metrics/upsertDailyWorkspaceMetrics";
import type { Brand, LlmProviderKey } from "@/types";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const runPromptManual = inngest.createFunction(
  {
    id: "prompt-run-manual",
    name: "Run Prompt Manual",
    triggers: [{ event: "prompt/run.manual" }],
    concurrency: { limit: 5 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { promptId, workspaceId, llmKey } = event.data as {
      promptId: string;
      workspaceId: string;
      llmKey: LlmProviderKey;
    };

    const supabase = getServiceClient();

    // 0. Guard: cap duro GLOBAL de runs por workspace (suma de todos los proveedores).
    // Evita picos accidentales desde cron o acciones manuales.
    const dailyGuard = await step.run("check-daily-limit", async () => {
      const [hardCap, runsToday] = await Promise.all([
        getWorkspaceDailyCap(supabase, workspaceId),
        countRunsToday(supabase, workspaceId),
      ]);
      return { runsToday, hardCap };
    });

    if (dailyGuard.runsToday >= dailyGuard.hardCap) {
      return {
        skipped: true,
        reason: `Daily cap reached: ${dailyGuard.runsToday}/${dailyGuard.hardCap} runs for workspace ${workspaceId} (${llmKey})`,
      };
    }

    // 1. Obtener datos de contexto
    const context = await step.run("fetch-context", async () => {
      const [p, w, b, c, l] = await Promise.all([
        supabase.from("prompts").select("*").eq("id", promptId).single(),
        supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
        supabase.from("brands").select("*").eq("workspace_id", workspaceId).eq("type", "own"),
        supabase
          .from("brands")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("type", "competitor"),
        supabase.from("llm_providers").select("*").eq("key", llmKey).eq("enabled", true).single(),
      ]);

      // Fetch workspace model override for this provider
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

      return {
        prompt: p.data,
        workspace: w.data,
        ownBrands: b.data ?? [],
        competitorBrands: c.data ?? [],
        llmProvider: l.data,
        modelOverride,
      };
    });

    if (!context.prompt || !context.workspace || !context.llmProvider) {
      throw new Error("Datos de contexto no encontrados");
    }

    const ownBrand = context.ownBrands[0] as Brand | undefined;
    if (!ownBrand) throw new Error("No hay brand propia en el workspace");

    // 2. Crear prompt_run
    const runId = await step.run("create-run", async () => {
      const { data, error } = await supabase
        .from("prompt_runs")
        .insert({
          workspace_id: workspaceId,
          prompt_id: promptId,
          llm_provider_id: context.llmProvider!.id,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !data) throw new Error("No se pudo crear el prompt_run");
      return data.id as string;
    });

    // 3. Llamar al LLM
    const llmResult = await step.run("call-llm", () =>
      runPrompt({
        provider: llmKey,
        prompt: context.prompt!.text as string,
        workspace: { id: context.workspace!.id as string, slug: context.workspace!.slug as string },
        brand: { name: ownBrand.name, aliases: ownBrand.aliases },
        competitors: (context.competitorBrands as Brand[]).map((c) => ({
          name: c.name,
          aliases: c.aliases,
        })),
        modelOverride: context.modelOverride ?? undefined,
      })
    );

    // 4. Guardar raw_response y marcar como completed
    await step.run("save-response", async () => {
      const estimatedCost =
        llmResult.costUsd ??
        (await estimateCostForModel(
          llmResult.model,
          llmResult.inputTokens,
          llmResult.outputTokens
        ));

      await supabase
        .from("prompt_runs")
        .update({
          raw_response: llmResult.rawResponse,
          model: llmResult.model,
          input_tokens: llmResult.inputTokens ?? null,
          output_tokens: llmResult.outputTokens ?? null,
          cost_usd: estimatedCost,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    });

    // 5. Detectar marcas
    const detection = await step.run("detect-brands", () =>
      Promise.resolve(
        detectBrands({
          rawResponse: llmResult.rawResponse,
          ownBrand: { id: ownBrand.id, name: ownBrand.name, aliases: ownBrand.aliases },
          competitors: (context.competitorBrands as Brand[]).map((c) => ({
            id: c.id,
            name: c.name,
            aliases: c.aliases,
          })),
        })
      )
    );

    // 5.1 Detectar e insertar fuentes citadas (annotations + URLs en texto plano)
    await step.run("insert-sources", async () => {
      await persistSourcesForRun({
        supabase,
        workspaceId,
        promptRunId: runId,
        rawResponse: llmResult.rawResponse,
        citations: llmResult.citations,
      });
    });

    // 6. Insertar mentions
    await step.run("insert-mentions", async () => {
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
        await supabase.from("mentions").insert(mentions);
      }
    });

    // 6.5. Análisis combinado (sentiment + ranking) en UNA sola llamada LLM.
    // Sustituye a las dos llamadas separadas para reducir coste (3→2 por run).
    // - El sentiment se aplica siempre.
    // - El rank solo se aplica cuando la heurística regex no detectó lista
    //   (todas las mentions son appearance_order/null), para no pisar posiciones fiables.
    await step.run("analyze-mentions-llm", async () => {
      const { data: mentionsRun } = await supabase
        .from("mentions")
        .select("brand_name_detected, position_source")
        .eq("prompt_run_id", runId);

      const brandNames = (mentionsRun ?? [])
        .map((m) => m.brand_name_detected)
        .filter((n): n is string => Boolean(n));
      if (brandNames.length === 0) return;

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
    });

    // 7. Calcular y upsert daily_prompt_metrics
    await step.run("upsert-metrics", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const competitorCount = detection.competitors.length;
      const sov = calculateSOV(detection.ownBrandMentioned ? 1 : 0, competitorCount);

      const { data: recentRuns } = await supabase
        .from("prompt_runs")
        .select("id")
        .eq("prompt_id", promptId)
        .eq("llm_provider_id", context.llmProvider!.id as string)
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
          llm_provider_id: context.llmProvider!.id as string,
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

      await upsertDailyWorkspaceMetrics({
        supabase,
        workspaceId,
        llmProviderId: context.llmProvider!.id as string,
        date: today,
      });
    });

    // 8. Revalidar rutas
    await step.run("revalidate", async () => {
      revalidatePath(`/${context.workspace!.slug}/prompts`);
      revalidatePath(`/${context.workspace!.slug}/dashboard`);
    });

    return { success: true, runId };
  }
);
