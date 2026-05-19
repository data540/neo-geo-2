"use server";

import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

interface ExportResult {
  filename: string;
  base64: string;
}

interface DailyMetricRow {
  date: string;
  active_prompts_count: number | null;
  brand_mentions_count: number | null;
  avg_position: number | null;
  brand_consistency: number | null;
  avg_sov: number | null;
}

export async function exportDashboardAction(
  workspaceSlug: string,
  days: number,
  llmKey: string | null
): Promise<ActionResult<ExportResult>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name, brand_name")
    .eq("slug", workspaceSlug)
    .single();
  if (!workspace) return { success: false, error: "Workspace not found" };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();
  if (!membership) return { success: false, error: "Not a member" };

  // Cargar todos los datasets en paralelo
  const [marketShareRes, breakdownRes, competitorsRes, sourcesRes, llmRes, dailyRes] =
    await Promise.all([
      supabase.rpc("get_workspace_market_share", {
        workspace_slug: workspaceSlug,
        days,
        llm_key: llmKey,
      }),
      supabase.rpc("get_workspace_mention_breakdown", {
        workspace_slug: workspaceSlug,
        days,
        llm_key: llmKey,
      }),
      supabase.rpc("get_workspace_top_competitors", {
        workspace_slug: workspaceSlug,
        days,
        limit_n: 10,
        llm_key: llmKey,
      }),
      supabase.rpc("get_workspace_top_sources", {
        workspace_slug: workspaceSlug,
        days,
        limit_n: 10,
        llm_key: llmKey,
      }),
      supabase.rpc("get_workspace_llm_comparison", {
        workspace_slug: workspaceSlug,
        days,
      }),
      supabase
        .from("daily_workspace_metrics")
        .select(
          "date, active_prompts_count, brand_mentions_count, avg_position, brand_consistency, avg_sov"
        )
        .eq("workspace_id", workspace.id)
        .order("date", { ascending: false })
        .limit(days),
    ]);

  // Hoja KPIs (resumen)
  const dailyRows = (dailyRes.data ?? []) as DailyMetricRow[];
  const kpisData = [
    {
      Workspace: workspace.name,
      Marca: workspace.brand_name,
      Rango: `Últimos ${days} días`,
      LLM: llmKey ?? "Todos",
      "Generado el": new Date().toLocaleString("es-ES"),
    },
  ];

  // Hoja Market Share
  type MarketShareRow = {
    brand_id: string;
    brand_name: string;
    brand_domain: string | null;
    brand_type: string;
    mentions_count: number | string;
    share_pct: number | string;
  };
  const marketShare = (marketShareRes.data ?? []) as MarketShareRow[];
  const marketSheet = marketShare.map((m) => ({
    Marca: m.brand_name,
    Tipo: m.brand_type === "own" ? "Propia" : "Competidor",
    Dominio: m.brand_domain ?? "",
    Menciones: Number(m.mentions_count),
    "% SOV": Number(m.share_pct),
  }));

  // Hoja Mention Types
  type BreakdownRow = { mention_type: string; count: number | string; pct: number | string };
  const breakdown = (breakdownRes.data ?? []) as BreakdownRow[];
  const breakdownSheet = breakdown.map((b) => ({
    Tipo: b.mention_type,
    Cantidad: Number(b.count),
    "%": Number(b.pct),
  }));

  // Hoja Top Competitors
  type CompetitorRow = {
    competitor_id: string;
    competitor_name: string;
    competitor_domain: string | null;
    mentions_count: number | string;
    share_pct: number | string;
    trend_pct: number | string | null;
  };
  const competitors = (competitorsRes.data ?? []) as CompetitorRow[];
  const competitorsSheet = competitors.map((c, idx) => ({
    "#": idx + 1,
    Competidor: c.competitor_name,
    Dominio: c.competitor_domain ?? "",
    Menciones: Number(c.mentions_count),
    "% Share": Number(c.share_pct),
    "Tendencia vs anterior (%)": c.trend_pct !== null ? Number(c.trend_pct) : "",
  }));

  // Hoja Top Sources
  type SourceRow = {
    domain: string;
    citations_count: number | string;
    pct_of_runs: number | string;
  };
  const sources = (sourcesRes.data ?? []) as SourceRow[];
  const sourcesSheet = sources.map((s, idx) => ({
    "#": idx + 1,
    Dominio: s.domain,
    Citas: Number(s.citations_count),
    "% de runs": Number(s.pct_of_runs),
  }));

  // Hoja LLM Comparison
  type LlmRow = {
    llm_key: string;
    llm_name: string;
    visibility_pct: number | string;
    sov_pct: number | string;
    avg_rank: number | string | null;
    top_competitor_name: string | null;
    top_competitor_sov: number | string;
    avg_sentiment: number | string | null;
    total_runs: number | string;
  };
  const llmRows = (llmRes.data ?? []) as LlmRow[];
  const llmSheet = llmRows.map((l) => ({
    LLM: l.llm_name,
    "Visibilidad (%)": Number(l.visibility_pct),
    "SOV (%)": Number(l.sov_pct),
    "Posición media": l.avg_rank !== null ? Number(l.avg_rank) : "",
    "Top competidor": l.top_competitor_name ?? "",
    "% Top competidor": Number(l.top_competitor_sov),
    Sentimiento: l.avg_sentiment !== null ? Number(l.avg_sentiment) : "",
    "Total runs": Number(l.total_runs),
  }));

  // Hoja Daily Metrics
  const dailySheet = dailyRows.map((d) => ({
    Fecha: d.date,
    "Prompts activos": d.active_prompts_count ?? 0,
    Menciones: d.brand_mentions_count ?? 0,
    "Posición media": d.avg_position ?? "",
    "Visibilidad (%)": d.avg_sov ?? "",
    "Consistencia (%)": d.brand_consistency ?? "",
  }));

  // Construir workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpisData), "Resumen");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(marketSheet), "Market Share");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breakdownSheet), "Tipos de mención");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(competitorsSheet), "Top Competidores");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sourcesSheet), "Top Sources");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(llmSheet), "Comparación LLMs");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailySheet), "Tendencia diaria");

  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${workspaceSlug}_dashboard_${today}.xlsx`;

  return { success: true, data: { filename, base64 } };
}
