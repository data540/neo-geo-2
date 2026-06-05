import { google } from "googleapis";
import type { LlmProviderKey } from "@/types";
import { getGoogleAuth } from "./auth";
import { mapSourceToLlm } from "./llmReferralMap";

export interface Ga4LlmRow {
  date: string; // YYYY-MM-DD
  llmKey: LlmProviderKey;
  conversions: number;
  sessions: number;
  totalUsers: number;
}

// GA4 devuelve la fecha como "YYYYMMDD"; la normalizamos a "YYYY-MM-DD".
function normalizeGa4Date(raw: string): string {
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

// Ejecuta un runReport de GA4 agrupando por (date, sessionSource) y devuelve
// solo las filas cuyo source mapea a uno de nuestros LLMs, agregadas por
// (date, llmKey). `propertyId` es el número de propiedad GA4 (sin "properties/").
export async function fetchLlmConversions(
  propertyId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string
): Promise<Ga4LlmRow[]> {
  const auth = getGoogleAuth();
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

  // Agregar por (date, llmKey) — varios sources pueden mapear al mismo LLM.
  const agg = new Map<string, Ga4LlmRow>();

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
