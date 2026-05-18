/**
 * Backfill cost_usd for prompt_runs that have tokens but no cost.
 * Uso: npx tsx scripts/backfill-costs.ts
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { estimateCostForModel } from "../src/lib/llm/pricing";

dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log("🚀 Backfill de cost_usd en prompt_runs...\n");

  const { data: runs, error } = await supabase
    .from("prompt_runs")
    .select("id, model, input_tokens, output_tokens")
    .eq("status", "completed")
    .is("cost_usd", null)
    .not("input_tokens", "is", null)
    .not("output_tokens", "is", null)
    .not("model", "is", null);

  if (error) throw error;
  console.log(`Runs sin coste encontrados: ${runs?.length ?? 0}\n`);

  if (!runs || runs.length === 0) {
    console.log("Nada que hacer.");
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const run of runs) {
    const cost = await estimateCostForModel(
      run.model as string,
      run.input_tokens as number,
      run.output_tokens as number
    );

    if (cost === null) {
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("prompt_runs")
      .update({ cost_usd: cost })
      .eq("id", run.id);

    if (updateError) {
      console.error(`  ❌ Error en run ${run.id}: ${updateError.message}`);
    } else {
      updated++;
    }

    if (updated % 10 === 0) {
      process.stdout.write(`  Actualizados: ${updated}/${runs.length}\r`);
    }
  }

  console.log(`\n✅ Actualizados: ${updated}`);
  console.log(`⏭  Sin precio conocido: ${skipped}`);
  console.log("\n✅ Backfill completado.");
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
