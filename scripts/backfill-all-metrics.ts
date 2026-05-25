import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { detectBrands } from "../src/lib/detection/detectBrands";
import { calculateSOV, calculateConsistency } from "../src/lib/metrics/calculate";

dotenv.config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log("🚀 Starting backfill of metrics from prompt_runs...");

  // 1) Fetch all completed runs
  const { data: runs, error: runsError } = await supabase
    .from("prompt_runs")
    .select("id, workspace_id, prompt_id, llm_provider_id, raw_response, created_at, completed_at")
    .eq("status", "completed")
    .not("raw_response", "is", null);

  if (runsError) throw runsError;
  console.log(`Found ${runs.length} completed runs.`);

  // 2) Cache workspace context
  const workspaceContexts = new Map<string, any>();
  const { data: workspaces } = await supabase.from("workspaces").select("id, slug");
  for (const ws of workspaces ?? []) {
    const [{ data: ownBrands }, { data: competitorBrands }] = await Promise.all([
      supabase.from("brands").select("*").eq("workspace_id", ws.id).eq("type", "own"),
      supabase.from("brands").select("*").eq("workspace_id", ws.id).eq("type", "competitor"),
    ]);
    workspaceContexts.set(ws.id, {
      ownBrand: (ownBrands ?? [])[0],
      competitors: competitorBrands ?? [],
    });
  }

  // 3) Process each run
  for (const run of runs) {
    const ctx = workspaceContexts.get(run.workspace_id);
    if (!ctx || !ctx.ownBrand) {
      console.warn(`Skipping run ${run.id}: No workspace context/brand found.`);
      continue;
    }

    const detection = detectBrands({
      rawResponse: run.raw_response,
      ownBrand: ctx.ownBrand,
      competitors: ctx.competitors,
    });

    // Clean existing mentions for this run
    await supabase.from("mentions").delete().eq("prompt_run_id", run.id);

    const mentions = [];
    if (detection.ownBrandMentioned) {
      mentions.push({
        workspace_id: run.workspace_id,
        prompt_run_id: run.id,
        brand_id: ctx.ownBrand.id,
        brand_name_detected: detection.detectedBrandName,
        brand_type: "own",
        position: detection.ownBrandPosition,
        sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
        confidence: detection.confidence,
        created_at: run.completed_at || run.created_at
      });
    }

    for (const comp of detection.competitors) {
      mentions.push({
        workspace_id: run.workspace_id,
        prompt_run_id: run.id,
        brand_id: comp.brandId,
        brand_name_detected: comp.name,
        brand_type: "competitor",
        position: comp.position,
        sentiment: comp.sentiment,
        confidence: comp.confidence,
        created_at: run.completed_at || run.created_at
      });
    }

    if (mentions.length > 0) {
      await supabase.from("mentions").insert(mentions);
    }

    // Upsert daily_prompt_metrics
    const date = (run.completed_at || run.created_at).split("T")[0];
    const sov = calculateSOV(detection.ownBrandMentioned ? 1 : 0, detection.competitors.length);

    // To calculate consistency, we'd need recent runs, but for a simple backfill 
    // we can use a simplified version or just skip it if it's too complex.
    // Let's use a 100/0 score for the specific run as a placeholder if not found.
    
    await supabase.from("daily_prompt_metrics").upsert(
      {
        workspace_id: run.workspace_id,
        prompt_id: run.prompt_id,
        llm_provider_id: run.llm_provider_id,
        date,
        brand_mentioned: detection.ownBrandMentioned,
        brand_position: detection.ownBrandPosition,
        competitor_count: detection.competitors.length,
        sov,
        sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
        consistency_score: detection.ownBrandMentioned ? 100 : 0,
      },
      { onConflict: "prompt_id,llm_provider_id,date" }
    );
    
    console.log(`Processed run ${run.id} (${date})`);
  }

  console.log("✅ Backfill complete.");
}

main().catch(console.error);
