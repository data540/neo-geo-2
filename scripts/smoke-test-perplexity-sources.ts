import dotenv from "dotenv";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { persistSourcesForRun } from "../src/lib/llm/persistSources";
import { runPrompt } from "../src/lib/llm/runner";

dotenv.config();

async function main() {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, slug, brand_name")
    .eq("slug", "air-europa")
    .single();

  if (!ws) throw new Error("workspace air-europa not found");

  const { data: prov } = await supabase
    .from("llm_providers")
    .select("id, key")
    .eq("key", "perplexity")
    .single();

  if (!prov) throw new Error("perplexity provider not found");

  const prompt = "¿Cuáles son las mejores aerolíneas para volar de Madrid a Buenos Aires en 2025?";

  console.log(`\n[1] Calling Perplexity via runner...`);
  const llmResult = await runPrompt({
    provider: "perplexity",
    prompt,
    workspace: { id: ws.id, slug: ws.slug },
    brand: { name: ws.brand_name, aliases: [] },
    competitors: [],
  });

  console.log(`    model=${llmResult.model}`);
  console.log(`    rawResponse length=${llmResult.rawResponse.length}`);
  console.log(`    citations=${llmResult.citations?.length ?? 0}`);
  if (llmResult.citations?.length) {
    console.log(`    first 3 citations:`);
    for (const c of llmResult.citations.slice(0, 3)) {
      console.log(`      - [${c.citationIndex}] ${c.domain} (${c.sourceType})  ${c.url}`);
    }
  }

  console.log(`\n[2] Inserting prompt_run...`);
  const { data: run, error: runErr } = await supabase
    .from("prompt_runs")
    .insert({
      workspace_id: ws.id,
      prompt_id: null,
      llm_provider_id: prov.id,
      status: "completed",
      raw_response: llmResult.rawResponse,
      model: llmResult.model,
      input_tokens: llmResult.inputTokens ?? null,
      output_tokens: llmResult.outputTokens ?? null,
      cost_usd: llmResult.costUsd ?? null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runErr || !run) {
    console.error("    failed to insert run:", runErr);
    process.exit(1);
  }
  console.log(`    run_id=${run.id}`);

  console.log(`\n[3] Persisting sources...`);
  const inserted = await persistSourcesForRun({
    supabase,
    workspaceId: ws.id,
    promptRunId: run.id,
    rawResponse: llmResult.rawResponse,
    citations: llmResult.citations,
  });
  console.log(`    inserted ${inserted} sources`);

  console.log(`\n[4] Reading back...`);
  const { data: sources } = await supabase
    .from("sources")
    .select("url, domain, source_type, citation_index, quote_text, title")
    .eq("prompt_run_id", run.id)
    .order("citation_index", { ascending: true, nullsFirst: false });
  console.log(`    rows in DB: ${sources?.length ?? 0}`);
  for (const s of sources ?? []) {
    console.log(
      `      [${s.citation_index ?? "-"}] ${s.source_type}  ${s.domain}  "${s.title ?? s.url.slice(0, 60)}"`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
