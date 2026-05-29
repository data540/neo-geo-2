// Backfill parse-only: recorre prompt_runs completados sin sources y reaplica
// extractSourcesFromResponse sobre el raw_response existente. NO llama a OpenRouter.
// Coste $0. Útil para casos donde el LLM dejó URLs en el texto pero el path antiguo
// las ignoró por algún motivo.
//
// Uso:
//   pnpm tsx scripts/backfill-sources.ts             # todos los workspaces
//   pnpm tsx scripts/backfill-sources.ts air-europa  # solo ese slug

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { extractSourcesFromResponse } from "../src/lib/detection/extractSources";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const BATCH_SIZE = 200;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const slugArg = process.argv[2];
  let workspaceFilterId: string | null = null;
  if (slugArg) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, slug")
      .eq("slug", slugArg)
      .single();
    if (!ws) {
      console.error(`Workspace "${slugArg}" no encontrado`);
      process.exit(1);
    }
    workspaceFilterId = ws.id;
    console.log(`Filtrando por workspace: ${ws.slug} (${ws.id})\n`);
  } else {
    console.log("Recorriendo todos los workspaces\n");
  }

  let totalRunsScanned = 0;
  let totalRunsWithUrls = 0;
  let totalSourcesInserted = 0;
  let lastCreatedAt: string | null = null;

  for (let page = 0; ; page += 1) {
    let query = supabase
      .from("prompt_runs")
      .select("id, workspace_id, raw_response, created_at")
      .eq("status", "completed")
      .not("raw_response", "is", null)
      .order("created_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (workspaceFilterId) query = query.eq("workspace_id", workspaceFilterId);
    if (lastCreatedAt) query = query.lt("created_at", lastCreatedAt);

    const { data: runs, error } = await query;
    if (error) {
      console.error("Error leyendo runs:", error.message);
      process.exit(1);
    }
    if (!runs || runs.length === 0) break;

    const runIds = runs.map((r) => r.id);
    const { data: existing } = await supabase
      .from("sources")
      .select("prompt_run_id")
      .in("prompt_run_id", runIds);
    const existingSet = new Set((existing ?? []).map((s) => s.prompt_run_id));

    const candidates = runs.filter((r) => !existingSet.has(r.id));

    for (const run of candidates) {
      totalRunsScanned += 1;
      const rawResponse = run.raw_response as string | null;
      if (!rawResponse) continue;
      const extracted = extractSourcesFromResponse(rawResponse);
      if (extracted.length === 0) continue;

      const rows = extracted.map((s) => ({
        workspace_id: run.workspace_id,
        prompt_run_id: run.id,
        url: s.url,
        domain: s.domain,
        title: s.title,
        cited_by_llm: true,
        source_type: "inline" as const,
        citation_index: null as number | null,
        quote_text: null as string | null,
      }));

      const { error: insErr } = await supabase.from("sources").insert(rows);
      if (insErr) {
        console.error(`  ! error inserting for run ${run.id}: ${insErr.message}`);
        continue;
      }
      totalRunsWithUrls += 1;
      totalSourcesInserted += rows.length;
    }

    lastCreatedAt = runs[runs.length - 1]?.created_at ?? null;
    console.log(
      `  page ${page + 1}: ${candidates.length} sin sources, scanned=${totalRunsScanned}, with_urls=${totalRunsWithUrls}, inserted=${totalSourcesInserted}`
    );

    if (runs.length < BATCH_SIZE) break;
  }

  console.log(`\n✓ Backfill completado`);
  console.log(`  runs escaneados sin sources: ${totalRunsScanned}`);
  console.log(`  runs con URLs en texto:       ${totalRunsWithUrls}`);
  console.log(`  sources insertadas:           ${totalSourcesInserted}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
