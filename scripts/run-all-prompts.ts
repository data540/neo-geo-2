/**
 * Ejecuta todos los prompts activos de un workspace y registra métricas del día.
 * Uso: npx tsx scripts/run-all-prompts.ts [workspace-slug] [llm-key]
 * Ejemplo: npx tsx scripts/run-all-prompts.ts air-europa chatgpt
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

// Importamos las funciones del proyecto directamente
import { detectBrands } from "../src/lib/detection/detectBrands";
import { estimateCostForModel } from "../src/lib/llm/pricing";
import { runPrompt } from "../src/lib/llm/runner";
import { calculateConsistency, calculateSOV } from "../src/lib/metrics/calculate";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const WORKSPACE_SLUG = process.argv[2] ?? "air-europa";
const LLM_KEY = (process.argv[3] ?? "chatgpt") as "chatgpt" | "claude" | "gemini" | "perplexity" | "deepseek";
const TODAY = new Date().toISOString().slice(0, 10);

async function upsertWorkspaceMetrics(workspaceId: string, llmProviderId: string) {
  const { data: metrics } = await supabase
    .from("daily_prompt_metrics")
    .select("brand_mentioned, brand_position, sov, consistency_score")
    .eq("workspace_id", workspaceId)
    .eq("llm_provider_id", llmProviderId)
    .eq("date", TODAY);

  const rows = metrics ?? [];
  if (rows.length === 0) return;

  const activePrompts = rows.length;
  const brandMentions = rows.filter((m) => m.brand_mentioned).length;
  const positions = rows
    .filter((m) => m.brand_mentioned && m.brand_position !== null)
    .map((m) => m.brand_position as number);
  const avgPosition = positions.length
    ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
    : null;
  const consistencyHigh = rows.filter((m) => (m.consistency_score ?? 0) >= 70).length;
  const brandConsistency = Math.round((consistencyHigh / activePrompts) * 1000) / 10;
  const sovValues = rows.filter((m) => m.sov !== null).map((m) => m.sov as number);
  const avgSov = sovValues.length
    ? Math.round((sovValues.reduce((a, b) => a + b, 0) / sovValues.length) * 10) / 10
    : null;

  await supabase.from("daily_workspace_metrics").upsert(
    {
      workspace_id: workspaceId,
      llm_provider_id: llmProviderId,
      date: TODAY,
      active_prompts_count: activePrompts,
      brand_mentions_count: brandMentions,
      avg_position: avgPosition,
      brand_consistency: brandConsistency,
      avg_sov: avgSov,
    },
    { onConflict: "workspace_id,llm_provider_id,date" }
  );
}

async function main() {
  console.log(`\n🚀 Ejecutando prompts de [${WORKSPACE_SLUG}] con [${LLM_KEY}] — ${TODAY}\n`);

  // 1. Obtener workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name")
    .eq("slug", WORKSPACE_SLUG)
    .single();
  if (!workspace) throw new Error(`Workspace '${WORKSPACE_SLUG}' no encontrado`);
  console.log(`✅ Workspace: ${workspace.name} (${workspace.id})`);

  // 2. Obtener LLM provider
  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id, key")
    .eq("key", LLM_KEY)
    .single();
  if (!provider) throw new Error(`LLM provider '${LLM_KEY}' no encontrado`);

  // Fetch workspace model override
  const { data: llmCfg } = await supabase
    .from("workspace_llm_config")
    .select("model")
    .eq("workspace_id", (await supabase.from("workspaces").select("id").eq("slug", WORKSPACE_SLUG).single()).data?.id ?? "")
    .eq("llm_provider_id", provider.id)
    .single();
  const modelOverride = (llmCfg as { model: string | null } | null)?.model ?? undefined;
  console.log(`✅ LLM: ${provider.key}${modelOverride ? ` (${modelOverride})` : ""}`);

  // 3. Obtener brand propia y competidores
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, aliases, type")
    .eq("workspace_id", workspace.id);

  const ownBrand = brands?.find((b) => b.type === "own");
  const competitors = brands?.filter((b) => b.type === "competitor") ?? [];
  if (!ownBrand) throw new Error("No hay brand propia en el workspace");
  console.log(`✅ Brand propia: ${ownBrand.name} | Competidores: ${competitors.length}`);

  // 4. Obtener prompts activos
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("workspace_id", workspace.id)
    .eq("status", "active");

  if (!prompts || prompts.length === 0) throw new Error("No hay prompts activos");
  console.log(`✅ Prompts activos: ${prompts.length}\n`);

  // 5. Ejecutar cada prompt
  let ok = 0, failed = 0;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]!;
    process.stdout.write(`[${i + 1}/${prompts.length}] ${prompt.text.slice(0, 60)}… `);

    try {
      // 5a. Crear prompt_run
      const { data: run } = await supabase
        .from("prompt_runs")
        .insert({
          workspace_id: workspace.id,
          prompt_id: prompt.id,
          llm_provider_id: provider.id,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (!run) throw new Error("No se pudo crear el prompt_run");

      // 5b. Llamar al LLM
      const llmResult = await runPrompt({
        provider: LLM_KEY,
        prompt: prompt.text as string,
        workspace: { id: workspace.id, slug: workspace.slug },
        brand: { name: ownBrand.name, aliases: (ownBrand.aliases as string[]) ?? [] },
        competitors: competitors.map((c) => ({
          name: c.name as string,
          aliases: (c.aliases as string[]) ?? [],
        })),
        modelOverride,
      });

      // 5c. Guardar respuesta
      const costUsd = await estimateCostForModel(
        llmResult.model,
        llmResult.inputTokens,
        llmResult.outputTokens
      );
      await supabase
        .from("prompt_runs")
        .update({
          raw_response: llmResult.rawResponse,
          model: llmResult.model,
          input_tokens: llmResult.inputTokens ?? null,
          output_tokens: llmResult.outputTokens ?? null,
          cost_usd: costUsd,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      // 5d. Detectar menciones
      const detection = detectBrands({
        rawResponse: llmResult.rawResponse,
        ownBrand: { id: ownBrand.id, name: ownBrand.name, aliases: (ownBrand.aliases as string[]) ?? [] },
        competitors: competitors.map((c) => ({
          id: c.id,
          name: c.name as string,
          aliases: (c.aliases as string[]) ?? [],
        })),
      });

      // 5e. Insertar menciones
      const mentions = [];
      if (detection.ownBrandMentioned) {
        mentions.push({
          workspace_id: workspace.id,
          prompt_run_id: run.id,
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
          workspace_id: workspace.id,
          prompt_run_id: run.id,
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

      // 5f. Upsert daily_prompt_metrics
      const { data: recentRuns } = await supabase
        .from("prompt_runs")
        .select("id")
        .eq("prompt_id", prompt.id)
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
      const sov = calculateSOV(detection.ownBrandMentioned ? 1 : 0, detection.competitors.length);

      await supabase.from("daily_prompt_metrics").upsert(
        {
          workspace_id: workspace.id,
          prompt_id: prompt.id,
          llm_provider_id: provider.id,
          date: TODAY,
          brand_mentioned: detection.ownBrandMentioned,
          brand_position: detection.ownBrandPosition,
          competitor_count: detection.competitors.length,
          sov,
          sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
          consistency_score: consistencyScore,
        },
        { onConflict: "prompt_id,llm_provider_id,date" }
      );

      const symbol = detection.ownBrandMentioned ? `✅ pos:${detection.ownBrandPosition ?? "?"}` : "⬜ no mencionada";
      console.log(symbol);
      ok++;
    } catch (e) {
      console.log(`❌ ${(e as Error).message}`);
      failed++;
    }
  }

  // 6. Upsert daily_workspace_metrics agregado
  await upsertWorkspaceMetrics(workspace.id, provider.id);

  console.log(`\n📊 Resultado: ${ok} OK, ${failed} fallidos`);
  console.log(`📅 Métricas del día ${TODAY} registradas en daily_workspace_metrics`);
  console.log("✅ Listo.\n");
}

main().catch((e) => {
  console.error("❌ Error fatal:", e.message);
  process.exit(1);
});
