/**
 * Ejecuta el refresh de Google Search Console + GA4 manualmente para todos
 * los workspaces configurados. Replica la lógica de refreshGoogleAnalytics
 * sin depender de Inngest/Next.js.
 * Uso: npx tsx scripts/refresh-google-analytics-now.mts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SA_EMAIL = process.env.GOOGLE_SA_CLIENT_EMAIL?.trim();
const SA_KEY = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!SA_EMAIL || !SA_KEY) {
  console.error("Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const auth = new google.auth.JWT({
  email: SA_EMAIL,
  key: SA_KEY,
  scopes: [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
  ],
});

const LLM_SOURCE_MAP: Record<string, string> = {
  "chatgpt.com": "chatgpt",
  "chat.openai.com": "chatgpt",
  "perplexity.ai": "perplexity",
  "www.perplexity.ai": "perplexity",
  "gemini.google.com": "gemini",
  "bard.google.com": "gemini",
  "copilot.microsoft.com": "chatgpt",
  "bing.com": "chatgpt",
};

function mapSourceToLlm(source: string): string | null {
  const normalized = source.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  for (const [key, llm] of Object.entries(LLM_SOURCE_MAP)) {
    if (normalized === key || normalized.endsWith(`.${key}`)) return llm;
  }
  return null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeGa4Date(raw: string): string {
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

async function fetchGsc(siteUrl: string, startDate: string, endDate: string) {
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["date", "query"],
      rowLimit: 5000,
      dataState: "all",
    },
  });
  return (res.data.rows ?? []).map((r) => ({
    date: r.keys?.[0] ?? "",
    query: r.keys?.[1] ?? "",
    clicks: Math.round(r.clicks ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

async function fetchGa4(propertyId: string, startDate: string, endDate: string) {
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const res = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }, { name: "sessionSource" }],
      metrics: [{ name: "conversions" }, { name: "sessions" }, { name: "totalUsers" }],
      limit: "100000",
    },
  });

  const agg = new Map<string, { date: string; llmKey: string; conversions: number; sessions: number; totalUsers: number }>();
  for (const row of res.data.rows ?? []) {
    const date = normalizeGa4Date(row.dimensionValues?.[0]?.value ?? "");
    const source = row.dimensionValues?.[1]?.value ?? "";
    const llmKey = mapSourceToLlm(source);
    if (!llmKey || !date) continue;
    const conversions = Number(row.metricValues?.[0]?.value ?? 0);
    const sessions = Number(row.metricValues?.[1]?.value ?? 0);
    const totalUsers = Number(row.metricValues?.[2]?.value ?? 0);
    const key = `${date}:${llmKey}`;
    const existing = agg.get(key);
    if (existing) {
      existing.conversions += conversions;
      existing.sessions += sessions;
      existing.totalUsers += totalUsers;
    } else {
      agg.set(key, { date, llmKey, conversions, sessions, totalUsers });
    }
  }
  return Array.from(agg.values());
}

async function main() {
  console.log("🔄 Refresh Google Analytics — inicio\n");

  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const startDate = isoDate(start);
  const endDate = isoDate(end);
  console.log(`📅 Ventana: ${startDate} → ${endDate}\n`);

  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id, slug, gsc_site_url, ga4_property_id")
    .or("gsc_site_url.not.is.null,ga4_property_id.not.is.null");

  if (error) {
    console.error("Error cargando workspaces:", error.message);
    process.exit(1);
  }
  if (!workspaces || workspaces.length === 0) {
    console.log("ℹ️  Ningún workspace con integración Google configurada.");
    process.exit(0);
  }

  console.log(`📋 Workspaces con integración Google: ${workspaces.length}\n`);

  let totalGsc = 0;
  let totalGa4 = 0;
  let errors = 0;

  for (const ws of workspaces) {
    console.log(`━━━ Workspace: ${ws.slug} ━━━`);

    // ── Search Console ──────────────────────────────────────────────────────
    if (ws.gsc_site_url) {
      process.stdout.write(`  GSC (${ws.gsc_site_url})... `);
      try {
        const rows = await fetchGsc(ws.gsc_site_url, startDate, endDate);
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
          const { error: upsertErr } = await supabase
            .from("workspace_gsc_cache")
            .upsert(payload, { onConflict: "workspace_id,data_date,query" });
          if (upsertErr) throw new Error(upsertErr.message);
          totalGsc += payload.length;
          console.log(`✅ ${rows.length} filas (${new Set(rows.map((r) => r.date)).size} días, top queries: ${[...new Set(rows.sort((a,b)=>b.clicks-a.clicks).slice(0,3).map(r=>r.query))].join(", ")})`);
        } else {
          console.log("✅ 0 filas (sin datos en el período)");
        }
      } catch (err) {
        console.log(`❌ ${err instanceof Error ? err.message : String(err)}`);
        errors++;
      }
    } else {
      console.log("  GSC: sin configurar");
    }

    // ── GA4 ─────────────────────────────────────────────────────────────────
    if (ws.ga4_property_id) {
      process.stdout.write(`  GA4  (property ${ws.ga4_property_id})... `);
      try {
        const rows = await fetchGa4(ws.ga4_property_id, startDate, endDate);
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
          const { error: upsertErr } = await supabase
            .from("workspace_ga4_llm_cache")
            .upsert(payload, { onConflict: "workspace_id,data_date,llm_key" });
          if (upsertErr) throw new Error(upsertErr.message);
          totalGa4 += payload.length;
          const byLlm = rows.reduce<Record<string, number>>((acc, r) => {
            acc[r.llmKey] = (acc[r.llmKey] ?? 0) + r.sessions;
            return acc;
          }, {});
          const summary = Object.entries(byLlm).map(([k, v]) => `${k}: ${v} sesiones`).join(", ");
          console.log(`✅ ${rows.length} filas (${summary})`);
        } else {
          console.log("✅ 0 filas (sin tráfico LLM en el período)");
        }
      } catch (err) {
        console.log(`❌ ${err instanceof Error ? err.message : String(err)}`);
        errors++;
      }
    } else {
      console.log("  GA4:  sin configurar");
    }

    console.log();
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Resumen: GSC ${totalGsc} filas, GA4 ${totalGa4} filas, errores: ${errors}`);
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
