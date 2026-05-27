import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { detectBrands } from "@/lib/detection/detectBrands";
import { extractSourcesFromResponse } from "@/lib/detection/extractSources";
import { estimateCostForModel } from "@/lib/llm/pricing";
import { runPrompt } from "@/lib/llm/runner";
import { analyzeSentimentBatch } from "@/lib/llm/sentimentAnalyzer";
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

export const runPromptManualMulti = inngest.createFunction(
  {
    id: "prompt-run-manual-multi",
    name: "Run Prompt Manual (Multi-LLM)",
    triggers: [{ event: "prompt/run.multi" }],
    concurrency: { limit: 5 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { promptId, workspaceId, runIds } = event.data as {
      promptId: string;
      workspaceId: string;
      runIds: string[];
    };

    const supabase = getServiceClient();

    // 1. Obtener contexto base (prompt, workspace, brands)
    const context = await step.run("fetch-base-context", async () => {
      const [p, w, b, c] = await Promise.all([
        supabase.from("prompts").select("*").eq("id", promptId).single(),
        supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
        supabase.from("brands").select("*").eq("workspace_id", workspaceId).eq("type", "own"),
        supabase
          .from("brands")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("type", "competitor"),
      ]);
      return {
        prompt: p.data,
        workspace: w.data,
        ownBrands: b.data ?? [],
        competitorBrands: c.data ?? [],
      };
    });

    if (!context.prompt || !context.workspace) {
      throw new Error("Datos de contexto no encontrados");
    }

    const ownBrand = context.ownBrands[0] as Brand | undefined;
    if (!ownBrand) throw new Error("No hay brand propia en el workspace");

    // 2. Ejecutar cada runId en paralelo
    await Promise.all(
      runIds.map((runId) =>
        step.run(`execute-run-${runId}`, async () => {
          // Obtener el LLM provider del run
          const { data: run } = await supabase
            .from("prompt_runs")
            .select("llm_provider_id")
            .eq("id", runId)
            .single();

          if (!run) throw new Error(`Run ${runId} no encontrado`);

          const { data: provider } = await supabase
            .from("llm_providers")
            .select("key, id")
            .eq("id", run.llm_provider_id)
            .single();

          if (!provider) throw new Error(`Provider para run ${runId} no encontrado`);

          const llmKey = provider.key as LlmProviderKey;

          // Model override
          const { data: cfg } = await supabase
            .from("workspace_llm_config")
            .select("model")
            .eq("workspace_id", workspaceId)
            .eq("llm_provider_id", provider.id)
            .single();
          const modelOverride = (cfg as { model: string | null } | null)?.model ?? null;

          // Marcar como running
          await supabase
            .from("prompt_runs")
            .update({ status: "running", started_at: new Date().toISOString() })
            .eq("id", runId);

          // Llamar al LLM
          const llmResult = await runPrompt({
            provider: llmKey,
            prompt: context.prompt!.text as string,
            workspace: {
              id: context.workspace!.id as string,
              slug: context.workspace!.slug as string,
            },
            brand: { name: ownBrand.name, aliases: ownBrand.aliases },
            competitors: (context.competitorBrands as Brand[]).map((comp) => ({
              name: comp.name,
              aliases: comp.aliases,
            })),
            modelOverride: modelOverride ?? undefined,
          });

          // Guardar respuesta y marcar completed
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

          // Detectar marcas
          const detection = detectBrands({
            rawResponse: llmResult.rawResponse,
            ownBrand: { id: ownBrand.id, name: ownBrand.name, aliases: ownBrand.aliases },
            competitors: (context.competitorBrands as Brand[]).map((comp) => ({
              id: comp.id,
              name: comp.name,
              aliases: comp.aliases,
            })),
          });

          // Fuentes
          const sources = extractSourcesFromResponse(llmResult.rawResponse);
          if (sources.length > 0) {
            await supabase.from("sources").insert(
              sources.map((s) => ({
                workspace_id: workspaceId,
                prompt_run_id: runId,
                url: s.url,
                domain: s.domain,
                title: s.title,
                cited_by_llm: true,
              }))
            );
          }

          // Mentions
          const mentions: Record<string, unknown>[] = [];
          if (detection.ownBrandMentioned) {
            mentions.push({
              workspace_id: workspaceId,
              prompt_run_id: runId,
              brand_id: ownBrand.id,
              brand_name_detected: detection.detectedBrandName,
              brand_type: "own",
              position: detection.ownBrandPosition,
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
              sentiment: comp.sentiment,
              mention_type: comp.mentionType,
              confidence: comp.confidence,
            });
          }
          if (mentions.length > 0) {
            await supabase.from("mentions").insert(mentions);
          }

          // Análisis de sentimiento con LLM (refina los scores heurísticos)
          {
            const brandsForSentiment: string[] = [];
            if (detection.ownBrandMentioned && detection.detectedBrandName) {
              brandsForSentiment.push(detection.detectedBrandName);
            }
            for (const comp of detection.competitors) {
              brandsForSentiment.push(comp.name);
            }
            if (brandsForSentiment.length > 0) {
              try {
                const results = await analyzeSentimentBatch(
                  llmResult.rawResponse,
                  brandsForSentiment
                );
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
                }
              } catch (err) {
                console.error("[sentiment-llm multi] failed, keeping heuristic fallback:", err);
              }
            }
          }

          // Métricas diarias
          const today = new Date().toISOString().slice(0, 10);
          const competitorCount = detection.competitors.length;
          const sov = calculateSOV(detection.ownBrandMentioned ? 1 : 0, competitorCount);

          const { data: recentRuns } = await supabase
            .from("prompt_runs")
            .select("id")
            .eq("prompt_id", promptId)
            .eq("llm_provider_id", provider.id)
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
              llm_provider_id: provider.id,
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
            llmProviderId: provider.id,
            date: today,
          });
        })
      )
    );

    // 3. Revalidar rutas
    await step.run("revalidate", async () => {
      revalidatePath(`/${context.workspace!.slug}/prompts`);
      revalidatePath(`/${context.workspace!.slug}/dashboard`);
    });

    return { success: true, runIds };
  }
);
