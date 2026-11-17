/**
 * Ejecuta YA los prompts activos de un workspace en sus LLMs habilitados, sin
 * pasar por Inngest. Usa exactamente el mismo pipeline que el cron
 * (src/lib/llm/promptRunPipeline.ts), así que los datos son idénticos en forma.
 *
 * Coste real: una llamada al modelo + una de análisis por prompt y LLM.
 *
 * Uso:
 *   pnpm exec tsx scripts/run-prompts-now.ts <workspace-slug> [--llm=chatgpt] [--limit=N] [--confirm]
 * Sin --confirm solo muestra cuántas ejecuciones haría.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const CONCURRENCY = 6;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 8000;

async function main() {
  const { runPromptPipeline } = await import("../src/lib/llm/promptRunPipeline");
  const slug = process.argv[2];
  const llmArg = process.argv.find((a) => a.startsWith("--llm="))?.split("=")[1];
  const limitArg = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0);
  const confirm = process.argv.includes("--confirm");
  if (!slug) throw new Error("Uso: tsx scripts/run-prompts-now.ts <workspace-slug> [--confirm]");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: ws } = await supabase.from("workspaces").select("id").eq("slug", slug).single();
  if (!ws) throw new Error(`Workspace no encontrado: ${slug}`);

  const { data: configs } = await supabase
    .from("workspace_llm_config")
    .select("llm_providers!inner(key, enabled)")
    .eq("workspace_id", ws.id)
    .eq("enabled", true)
    .eq("llm_providers.enabled", true)
    .gt("prompts_per_day", 0);
  const llmKeys = (configs ?? [])
    .map((c) => (c.llm_providers as unknown as { key: string }).key)
    .filter((k) => !llmArg || k === llmArg);

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("workspace_id", ws.id)
    .eq("status", "active");

  let jobs = (prompts ?? []).flatMap((p) =>
    llmKeys.map((llmKey) => ({ promptId: p.id as string, workspaceId: ws.id as string, llmKey }))
  );
  // Saltar prompt+LLM que ya tienen un run completado hoy (UTC), para no duplicar
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: todayRuns } = await supabase
    .from("prompt_runs")
    .select("prompt_id, llm_providers!inner(key)")
    .eq("workspace_id", ws.id)
    .eq("status", "completed")
    .gte("created_at", todayStart.toISOString());
  const doneToday = new Set(
    (todayRuns ?? []).map(
      (r) => `${r.prompt_id}:${(r.llm_providers as unknown as { key: string }).key}`
    )
  );
  const before = jobs.length;
  jobs = jobs.filter((j) => !doneToday.has(`${j.promptId}:${j.llmKey}`));
  if (before !== jobs.length) console.log(`Ya hechas hoy: ${before - jobs.length}`);
  if (limitArg > 0) jobs = jobs.slice(0, limitArg);

  console.log(`${slug}: ${prompts?.length ?? 0} prompts × [${llmKeys.join(", ")}] = ${jobs.length} ejecuciones`);
  if (!confirm) {
    console.log("Modo prueba: añade --confirm para ejecutar.");
    return;
  }

  let done = 0;
  let failed = 0;
  let skipped = 0;
  const started = Date.now();
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            // biome-ignore lint/suspicious/noExplicitAny: llmKey validado contra llm_providers
            const res = await runPromptPipeline(supabase, job as any);
            if (res.skipped) skipped++;
            else done++;
            break;
          } catch (err) {
            if (attempt === MAX_ATTEMPTS) {
              failed++;
              console.error(`✗ ${job.llmKey} ${job.promptId}: ${err instanceof Error ? err.message : err}`);
            }
            else await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
          }
        }
        const total = done + failed + skipped;
        if (total % 25 === 0) {
          console.log(`  ${total}/${jobs.length} (${done} ok, ${failed} fallidas, ${skipped} cap) · ${Math.round((Date.now() - started) / 1000)}s`);
        }
      }
    })
  );
  console.log(`Fin: ${done} ok, ${failed} fallidas, ${skipped} omitidas por cap · ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
