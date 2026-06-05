import { google } from "googleapis";
import { getGoogleAuth } from "./auth";

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number;
}

// Consulta Search Analytics de GSC agrupando por query para un rango de fechas.
// `siteUrl` tal cual aparece en Search Console: "sc-domain:ejemplo.com" o
// "https://www.ejemplo.com/".
export async function fetchSearchAnalytics(
  siteUrl: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,
  rowLimit = 1000
): Promise<GscQueryRow[]> {
  const auth = getGoogleAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit,
      dataState: "all",
    },
  });

  const rows = res.data.rows ?? [];
  return rows.map((r) => ({
    query: r.keys?.[0] ?? "",
    clicks: Math.round(r.clicks ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

// Variante agrupada por (date, query) — usada por el CRON para guardar snapshots
// diarios y permitir UPSERT idempotente sobre una ventana reprocesada.
export interface GscDailyQueryRow extends GscQueryRow {
  date: string; // YYYY-MM-DD
}

export async function fetchSearchAnalyticsByDate(
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit = 5000
): Promise<GscDailyQueryRow[]> {
  const auth = getGoogleAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["date", "query"],
      rowLimit,
      dataState: "all",
    },
  });

  const rows = res.data.rows ?? [];
  return rows.map((r) => ({
    date: r.keys?.[0] ?? "",
    query: r.keys?.[1] ?? "",
    clicks: Math.round(r.clicks ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}
