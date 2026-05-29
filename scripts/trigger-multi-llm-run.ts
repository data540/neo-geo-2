// Crea N runs (uno por LLM habilitado del workspace) para 1 prompt y los ejecuta
// invocando runPrompt() + persistSourcesForRun() directamente.
// NO depende de Inngest dev server ni del runtime de Next.
// Útil para verificar el nuevo flujo de captura de citations.
//
// Uso:
//   pnpm tsx scripts/trigger-multi-llm-run.ts [workspace_slug] [prompt_id?]

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { persistSourcesForRun } from "../src/lib/llm/persistSources";
import { runPrompt } from "../src/lib/llm/runner";
import type { LlmProviderKey } from "../src/types";

dotenv.config();

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const slug = process.argv[2] ?? "air-europa";
  const overridePromptId = process.argv[3];

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, slug, brand_name")
    .eq("slug", slug)
    .single();
  if (!ws) throw new Error(`workspace ${slug} not found`);

  let promptId = overridePromptId;
  let promptText: string;
  if (!promptId) {
    const { data: prompt } = await supabase
      .from("prompts")
      .select("id, text")
      .eq("workspace_id", ws.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!prompt) throw new Error("no active prompts in workspace");
    promptId = prompt.id;
    promptText = prompt.text;
  } else {
    const { data: prompt } = await supabase
      .from("prompts")
      .select("text")
      .eq("id", promptId)
      .single();
    if (!prompt) throw new Error(`prompt ${promptId} not found`);
    promptText = prompt.text;
  }
  console.log(`Prompt: "${promptText.slice(0, 100)}..."  (${promptId})`);

  const { data: ownBrand } = await supabase
    .from("brands")
    .select("id, name, aliases")
    .eq("workspace_id", ws.id)
    .eq("type", "own")
    .limit(1)
    .single();
  const { data: competitors } = await supabase
    .from("brands")
    .select("id, name, aliases")
    .eq("workspace_id", ws.id)
    .eq("type", "competitor");

  const { data: llmConfigs } = await supabase
    .from("workspace_llm_config")
    .select("llm_provider_id, model, llm_providers(key, name)")
    .eq("workspace_id", ws.id)
    .eq("enabled", true);

  if (!llmConfigs || llmConfigs.length === 0) {
    throw new Error("no enabled LLMs in workspace");
  }
  console.log(
    `\nLLMs habilitados: ${llmConfigs
      .map((c: any) => c.llm_providers?.key)
      .join(", ")}\n`
  );

  // Crear N runs queued
  const { data: runs, error: runErr } = await supabase
    .from("prompt_runs")
    .insert(
      llmConfigs.map((c: any) => ({
        workspace_id: ws.id,
        prompt_id: promptId,
        llm_provider_id: c.llm_provider_id,
        status: "queued",
      }))
    )
    .select("id, llm_provider_id, llm_providers(key)");
  if (runErr || !runs) throw new Error(`insert prompt_runs failed: ${runErr?.message}`);

  console.log(`Created ${runs.length} runs. Executing...\n`);

  for (const run of runs as any[]) {
    const key = run.llm_providers?.key as LlmProviderKey;
    const cfg = (llmConfigs as any[]).find((c) => c.llm_provider_id === run.llm_provider_id);
    const modelOverride: string | undefined = cfg?.model ?? undefined;
    console.log(`▶ ${key}  (model: ${modelOverride ?? "default"})  run=${run.id}`);

    const t0 = Date.now();
    await supabase
      .from("prompt_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", run.id);

    try {
      const result = await runPrompt({
        provider: key,
        prompt: promptText,
        workspace: { id: ws.id, slug: ws.slug },
        brand: {
          name: ownBrand?.name ?? ws.brand_name,
          aliases: (ownBrand?.aliases as string[]) ?? [],
        },
        competitors: (competitors ?? []).map((c) => ({
          name: c.name,
          aliases: (c.aliases as string[]) ?? [],
        })),
        modelOverride,
      });

      await supabase
        .from("prompt_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          raw_response: result.rawResponse,
          model: result.model,
          input_tokens: result.inputTokens ?? null,
          output_tokens: result.outputTokens ?? null,
          cost_usd: result.costUsd ?? null,
        })
        .eq("id", run.id);

      const inserted = await persistSourcesForRun({
        supabase,
        workspaceId: ws.id,
        promptRunId: run.id,
        rawResponse: result.rawResponse,
        citations: result.citations,
      });

      const dt = Date.now() - t0;
      console.log(
        `  ✓ ${dt}ms — citations=${result.citations?.length ?? 0}  inserted=${inserted}\n`
      );
    } catch (e: any) {
      await supabase
        .from("prompt_runs")
        .update({ status: "failed", error_message: e.message })
        .eq("id", run.id);
      console.error(`  ✗ failed: ${e.message}\n`);
    }
  }

  const { data: summary } = await supabase
    .from("sources")
    .select("source_type")
    .in("prompt_run_id", runs.map((r: any) => r.id));
  const byType = (summary ?? []).reduce<Record<string, number>>((acc, s: any) => {
    acc[s.source_type] = (acc[s.source_type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Resumen sources: ${JSON.stringify(byType)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
