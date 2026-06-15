import type { SupabaseClient } from "@supabase/supabase-js";

// Cap duro de ejecuciones diarias por workspace. Se calcula como la suma de
// prompts_per_day de los proveedores habilitados, con un margen del 20% para
// absorber ejecuciones manuales legítimas. Ni el cron ni las acciones manuales
// pueden superar este tope — protege contra picos accidentales de coste.

const SAFETY_MARGIN = 1.2;
const MIN_DAILY_CAP = 60;
// Tope de seguridad absoluto por si la config quedara vacía o desconfigurada.
const FALLBACK_CAP = 200;

export async function getWorkspaceDailyCap(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { data } = await supabase
    .from("workspace_llm_config")
    .select("prompts_per_day, enabled")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);

  const sum = (data ?? []).reduce(
    (acc, c) => acc + (Number((c as { prompts_per_day: number }).prompts_per_day) || 0),
    0
  );

  if (sum <= 0) return FALLBACK_CAP;
  return Math.max(MIN_DAILY_CAP, Math.ceil(sum * SAFETY_MARGIN));
}

export async function countRunsToday(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("prompt_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", todayStart.toISOString());
  return count ?? 0;
}

// Devuelve cuántos runs más se permiten hoy para el workspace (>= 0).
export async function remainingRunsToday(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const [cap, used] = await Promise.all([
    getWorkspaceDailyCap(supabase, workspaceId),
    countRunsToday(supabase, workspaceId),
  ]);
  return Math.max(0, cap - used);
}
