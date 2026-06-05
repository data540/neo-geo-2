// Refresca los datos de Google Search Console (GSC) y GA4 para todos los
// workspaces que tengan configurado gsc_site_url y/o ga4_property_id.
//
// Estrategia:
//   - CRON diario a las 04:00 UTC + evento manual "google/analytics.refresh".
//   - GSC tiene ~2-3 días de latencia: se reprocesa una ventana de 30 días con
//     UPSERT idempotente por (workspace_id, data_date, query).
//   - GA4: runReport por (date, sessionSource), mapeo a LLM, UPSERT por
//     (workspace_id, data_date, llm_key).
//   - Las APIs de Google son gratuitas; el coste es solo 1 lectura/día/workspace.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import { fetchLlmConversions } from "@/lib/google/analytics";
import { hasGoogleServiceAccount } from "@/lib/google/auth";
import { fetchSearchAnalyticsByDate } from "@/lib/google/searchConsole";

const WINDOW_DAYS = 30;
const BATCH_DELAY_MS = 500;

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const refreshGoogleAnalytics = inngest.createFunction(
  {
    id: "refresh-google-analytics",
    name: "Refresh Google Search Console + GA4 (daily)",
    triggers: [{ cron: "0 4 * * *" }, { event: "google/analytics.refresh" }],
    concurrency: { limit: 1 },
    retries: 1,
  },
  async ({ step }) => {
    if (!hasGoogleServiceAccount()) {
      return { skipped: true, reason: "Service Account de Google no configurada" };
    }

    const supabase = getServiceClient();

    // Workspaces con alguna integración Google configurada
    const workspaces = await step.run("fetch-workspaces", async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("id, slug, gsc_site_url, ga4_property_id")
        .or("gsc_site_url.not.is.null,ga4_property_id.not.is.null");
      return (data ?? []) as Array<{
        id: string;
        slug: string;
        gsc_site_url: string | null;
        ga4_property_id: string | null;
      }>;
    });

    if (workspaces.length === 0) {
      return { workspaces: 0, reason: "ningún workspace con integración Google" };
    }

    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - WINDOW_DAYS);
    const startDate = isoDate(start);
    const endDate = isoDate(end);

    let gscRows = 0;
    let ga4Rows = 0;
    let errors = 0;

    for (const ws of workspaces) {
      // ── Search Console ──────────────────────────────────────────────────
      const gscSiteUrl = ws.gsc_site_url;
      if (gscSiteUrl) {
        await step.run(`gsc-${ws.id}`, async () => {
          try {
            const rows = await fetchSearchAnalyticsByDate(gscSiteUrl, startDate, endDate);
            if (rows.length > 0) {
              const payload = rows.map((r) => ({
                workspace_id: ws.id,
                data_date: r.date,
                query: r.query,
                clicks: r.clicks,
                impressions: r.impressions,
                ctr: r.ctr,
                position: r.position,
                fetched_at: new Date().toISOString(),
              }));
              await supabase
                .from("workspace_gsc_cache")
                .upsert(payload, { onConflict: "workspace_id,data_date,query" });
              gscRows += payload.length;
            }
          } catch (err) {
            errors++;
            console.error(`GSC error ws=${ws.slug}:`, err instanceof Error ? err.message : err);
          }
          await sleep(BATCH_DELAY_MS);
        });
      }

      // ── GA4 ─────────────────────────────────────────────────────────────
      const ga4PropertyId = ws.ga4_property_id;
      if (ga4PropertyId) {
        await step.run(`ga4-${ws.id}`, async () => {
          try {
            const rows = await fetchLlmConversions(ga4PropertyId, startDate, endDate);
            if (rows.length > 0) {
              const payload = rows.map((r) => ({
                workspace_id: ws.id,
                data_date: r.date,
                llm_key: r.llmKey,
                conversions: r.conversions,
                sessions: r.sessions,
                total_users: r.totalUsers,
                fetched_at: new Date().toISOString(),
              }));
              await supabase
                .from("workspace_ga4_llm_cache")
                .upsert(payload, { onConflict: "workspace_id,data_date,llm_key" });
              ga4Rows += payload.length;
            }
          } catch (err) {
            errors++;
            console.error(`GA4 error ws=${ws.slug}:`, err instanceof Error ? err.message : err);
          }
          await sleep(BATCH_DELAY_MS);
        });
      }
    }

    return { workspaces: workspaces.length, gscRows, ga4Rows, errors };
  }
);
