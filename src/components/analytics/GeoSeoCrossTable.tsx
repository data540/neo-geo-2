"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import type { GeoSeoCrossRow } from "@/types";

type SortKey = "promptText" | "matchedQuery" | "clicks" | "impressions";
type SortDir = "asc" | "desc";

interface Props {
  rows: GeoSeoCrossRow[];
}

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" aria-hidden="true" />;
  return dir === "asc" ? (
    <ArrowUp className="w-3 h-3 ml-1" aria-hidden="true" />
  ) : (
    <ArrowDown className="w-3 h-3 ml-1" aria-hidden="true" />
  );
}

export function GeoSeoCrossTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const tracked = rows.filter((r) => r.status === "tracked").length;
  const opportunities = rows.filter((r) => r.status === "opportunity").length;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "promptText" || key === "matchedQuery" ? "asc" : "desc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "promptText") {
      return mul * a.promptText.localeCompare(b.promptText, "es");
    }
    if (sortKey === "matchedQuery") {
      const aq = a.matchedQuery ?? "";
      const bq = b.matchedQuery ?? "";
      return mul * aq.localeCompare(bq, "es");
    }
    if (sortKey === "clicks") {
      return mul * (a.clicks - b.clicks);
    }
    if (sortKey === "impressions") {
      return mul * (a.impressions - b.impressions);
    }
    return 0;
  });

  function thClass(align: "left" | "right") {
    return `px-4 py-3 text-${align} text-xs font-medium text-slate-500 uppercase tracking-wide select-none cursor-pointer hover:text-slate-800 whitespace-nowrap`;
  }

  function thBtn(key: SortKey, align: "left" | "right", label: string) {
    return (
      <th key={key} className={thClass(align)} onClick={() => handleSort(key)}>
        <span className={`inline-flex items-center ${align === "right" ? "justify-end w-full" : ""}`}>
          {label}
          <SortIcon col={key} active={sortKey === key} dir={sortDir} />
        </span>
      </th>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Cruce GEO ↔ SEO</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Tus prompts monitorizados frente a las búsquedas reales de Google.{" "}
          <span className="text-emerald-600 font-medium">{tracked} con tráfico</span> ·{" "}
          <span className="text-amber-600 font-medium">{opportunities} oportunidades</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-12">
          Sin prompts activos o sin datos de Search Console.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {thBtn("promptText", "left", "Prompt monitorizado")}
                {thBtn("matchedQuery", "left", "Búsqueda real")}
                {thBtn("clicks", "right", "Clics")}
                {thBtn("impressions", "right", "Impresiones")}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => (
                <tr key={r.promptText} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-700 max-w-sm truncate" title={r.promptText}>
                    {r.promptText}
                  </td>
                  <td className="px-4 py-3">
                    {r.matchedQuery ? (
                      <span className="text-slate-700">{r.matchedQuery}</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                        Sin tráfico real
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.matchedQuery ? r.clicks : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.matchedQuery ? r.impressions.toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
