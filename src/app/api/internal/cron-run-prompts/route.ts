/**
 * Cron de ejecución de prompts SIN Inngest. Lo llama pg_cron (Supabase) cada
 * 5 minutos en la franja de la mañana (migración 0050). Cada llamada procesa
 * ejecuciones pendientes del día durante ~4 minutos y termina; la siguiente
 * llamada continúa donde quedó (ver listPendingScheduledRuns).
 *
 * Autenticación: cabecera `x-cron-secret` comparada con el secreto guardado en
 * el Vault de Supabase (RPC get_cron_run_prompts_secret, solo service_role).
 * El secreto no está en el código ni en las variables de Vercel.
 */
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { runPromptPipeline } from "@/lib/llm/promptRunPipeline";
import { listPendingScheduledRuns } from "@/lib/llm/scheduledRuns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONCURRENCY = 6;
/** Deja de coger trabajos nuevos pasado este tiempo (margen hasta maxDuration). */
const TIME_BUDGET_MS = 200_000;

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const provided = request.headers.get("x-cron-secret") ?? "";
  const { data: expected, error: secretError } = await supabase.rpc("get_cron_run_prompts_secret");
  if (secretError || typeof expected !== "string" || !expected) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 });
  }
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const pending = await listPendingScheduledRuns(supabase);
  const queue = [...pending];
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  const slugs = new Set<string>();

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (Date.now() - started < TIME_BUDGET_MS) {
        const job = queue.shift();
        if (!job) return;
        try {
          const res = await runPromptPipeline(supabase, job);
          if (res.skipped) skipped++;
          else ok++;
          if (res.workspaceSlug) slugs.add(res.workspaceSlug);
        } catch (err) {
          failed++;
          console.error(
            `[cron-run-prompts] ${job.llmKey} ${job.promptId}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    })
  );

  for (const slug of slugs) {
    revalidatePath(`/${slug}/dashboard`);
    revalidatePath(`/${slug}/prompts`);
  }

  const result = {
    pending: pending.length,
    ok,
    failed,
    skipped,
    remaining: queue.length,
    ms: Date.now() - started,
  };
  console.log("[cron-run-prompts]", JSON.stringify(result));
  return NextResponse.json(result);
}
