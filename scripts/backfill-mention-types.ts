import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { classifyMentionType } from "../src/lib/detection/detectBrands";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const BATCH_SIZE = 200;

interface MentionRow {
  id: string;
  prompt_run_id: string;
  brand_id: string | null;
  brand_name_detected: string | null;
  position: number | null;
}

interface RunRow {
  id: string;
  raw_response: string | null;
}

interface BrandRow {
  id: string;
  name: string;
}

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

  console.log("Cargando menciones sin mention_type...");
  const { count, error: countError } = await supabase
    .from("mentions")
    .select("*", { count: "exact", head: true })
    .is("mention_type", null);

  if (countError) {
    console.error("Error al contar mentions:", countError);
    process.exit(1);
  }

  const totalRows = count ?? 0;
  if (totalRows === 0) {
    console.log("No hay menciones pendientes de clasificar.");
    return;
  }
  console.log(`Total a procesar: ${totalRows.toLocaleString()}`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  const runCache = new Map<string, string | null>();
  const brandCache = new Map<string, string>();

  while (true) {
    const { data: mentions, error: selError } = await supabase
      .from("mentions")
      .select("id, prompt_run_id, brand_id, brand_name_detected, position")
      .is("mention_type", null)
      .limit(BATCH_SIZE);

    if (selError) {
      console.error("Error seleccionando mentions:", selError);
      process.exit(1);
    }
    const rows = (mentions ?? []) as MentionRow[];
    if (rows.length === 0) break;

    // Pre-cargar runs y brands no cacheados
    const runIdsNeeded = [
      ...new Set(rows.map((m) => m.prompt_run_id).filter((id) => !runCache.has(id))),
    ];
    const brandIdsNeeded = [
      ...new Set(
        rows
          .map((m) => m.brand_id)
          .filter((id): id is string => Boolean(id) && !brandCache.has(id!))
      ),
    ];

    if (runIdsNeeded.length > 0) {
      const { data: runRows } = await supabase
        .from("prompt_runs")
        .select("id, raw_response")
        .in("id", runIdsNeeded);
      for (const r of (runRows ?? []) as RunRow[]) {
        runCache.set(r.id, r.raw_response);
      }
    }
    if (brandIdsNeeded.length > 0) {
      const { data: brandRows } = await supabase
        .from("brands")
        .select("id, name")
        .in("id", brandIdsNeeded);
      for (const b of (brandRows ?? []) as BrandRow[]) {
        brandCache.set(b.id, b.name);
      }
    }

    // Clasificar y actualizar individualmente (no es un hot path)
    for (const m of rows) {
      processed += 1;
      const raw = runCache.get(m.prompt_run_id);
      const brandName =
        m.brand_name_detected ?? (m.brand_id ? (brandCache.get(m.brand_id) ?? null) : null);

      if (!raw || !brandName) {
        // Sin contexto suficiente — marcar como general_mention para que no se reintente
        const { error: updErr } = await supabase
          .from("mentions")
          .update({ mention_type: "general_mention" })
          .eq("id", m.id);
        if (updErr) console.error(`  fallo update mention ${m.id}:`, updErr.message);
        else skipped += 1;
        continue;
      }

      const mtype = classifyMentionType(raw, brandName, m.position);
      const { error: updErr } = await supabase
        .from("mentions")
        .update({ mention_type: mtype })
        .eq("id", m.id);
      if (updErr) {
        console.error(`  fallo update mention ${m.id}:`, updErr.message);
        continue;
      }
      updated += 1;
    }

    const pct = ((processed / totalRows) * 100).toFixed(1);
    console.log(`  ${processed}/${totalRows} (${pct}%) — updated ${updated}, skipped ${skipped}`);
  }

  console.log("\n=== Backfill completado ===");
  console.log(`Procesadas: ${processed}`);
  console.log(`Actualizadas: ${updated}`);
  console.log(`Sin contexto (marcadas general_mention): ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
