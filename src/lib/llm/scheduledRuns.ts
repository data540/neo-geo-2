/**
 * Ejecuciones programadas del día sin Inngest (las dispara pg_cron de Supabase
 * vía /api/internal/cron-run-prompts). Misma regla que runPromptScheduled:
 * por cada (workspace, LLM habilitado) hasta `prompts_per_day` prompts activos
 * al día (UTC). Air Europa solo ejecuta prompts de España.
 *
 * Es idempotente: un prompt+LLM con un run completado o en curso hoy no se
 * vuelve a lanzar, así que las llamadas repetidas del cron solo completan lo
 * que falte.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAirEuropaWorkspace } from "@/lib/workspace-country";
import type { LlmProviderKey } from "@/types";
import type { PromptRunInput } from "./promptRunPipeline";

/** Un run 'running' más antiguo que esto se considera colgado y se reintenta. */
const STALE_RUNNING_MS = 15 * 60 * 1000;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

export async function listPendingScheduledRuns(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<PromptRunInput[]> {
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const [{ data: configs }, { data: prompts }, { data: workspaces }, { data: todayRuns }] =
    await Promise.all([
      supabase
        .from("workspace_llm_config")
        .select("workspace_id, prompts_per_day, llm_provider_id, llm_providers!inner(key, enabled)")
        .eq("enabled", true)
        .eq("llm_providers.enabled", true)
        .gt("prompts_per_day", 0),
      supabase.from("prompts").select("id, workspace_id, country").eq("status", "active"),
      supabase.from("workspaces").select("id, slug"),
      supabase
        .from("prompt_runs")
        .select("prompt_id, llm_provider_id, status, created_at")
        .gte("created_at", todayStart.toISOString())
        .in("status", ["completed", "running", "queued"]),
    ]);

  const restricted = new Set(
    (workspaces ?? [])
      .filter((w) => isAirEuropaWorkspace(w.slug as string))
      .map((w) => w.id as string)
  );

  // prompt+LLM ya hechos o en curso hoy (los 'running' colgados no cuentan)
  const taken = new Set<string>();
  const usedByWorkspaceLlm = new Map<string, number>();
  const promptWorkspace = new Map((prompts ?? []).map((p) => [p.id as string, p.workspace_id as string]));
  for (const r of todayRuns ?? []) {
    const stale =
      r.status !== "completed" &&
      now.getTime() - new Date(r.created_at as string).getTime() > STALE_RUNNING_MS;
    if (stale) continue;
    taken.add(`${r.prompt_id}:${r.llm_provider_id}`);
    const wid = promptWorkspace.get(r.prompt_id as string);
    if (wid) {
      const key = `${wid}:${r.llm_provider_id}`;
      usedByWorkspaceLlm.set(key, (usedByWorkspaceLlm.get(key) ?? 0) + 1);
    }
  }

  const promptsByWorkspace = new Map<string, string[]>();
  for (const p of prompts ?? []) {
    const wid = p.workspace_id as string;
    if (restricted.has(wid) && p.country !== "ES") continue;
    const list = promptsByWorkspace.get(wid) ?? [];
    list.push(p.id as string);
    promptsByWorkspace.set(wid, list);
  }

  const jobs: PromptRunInput[] = [];
  for (const cfg of configs ?? []) {
    const wid = cfg.workspace_id as string;
    const providerId = cfg.llm_provider_id as string;
    const llmKey = (cfg.llm_providers as unknown as { key: string }).key as LlmProviderKey;
    const used = usedByWorkspaceLlm.get(`${wid}:${providerId}`) ?? 0;
    const remaining = Math.max(0, (cfg.prompts_per_day as number) - used);
    if (remaining === 0) continue;
    const available = (promptsByWorkspace.get(wid) ?? []).filter(
      (pid) => !taken.has(`${pid}:${providerId}`)
    );
    for (const promptId of shuffle(available).slice(0, remaining)) {
      jobs.push({ promptId, workspaceId: wid, llmKey });
    }
  }
  return shuffle(jobs);
}
