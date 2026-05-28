"use client";

import { ChevronDown, ChevronRight, Globe, HelpCircle } from "lucide-react";
import { Fragment, useState } from "react";
import { getSourceRating, getSourceType, rootDomain } from "@/lib/sources/classify";
import type { SourceRankingRow } from "@/types";
import { SourceDetailPanel } from "./SourceDetailPanel";
import { SourceRatingBadge } from "./SourceRatingBadge";
import { SourceTypeBadge } from "./SourceTypeBadge";

interface Props {
  rows: SourceRankingRow[];
  workspaceSlug: string;
  workspaceId: string;
  days: number;
  llmKey: string | null;
  country: string | null;
}

export function SourceRankingsTable({
  rows,
  workspaceSlug,
  workspaceId,
  days,
  llmKey,
  country,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const maxPct = rows.reduce((m, r) => Math.max(m, r.pctOfRuns), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Globe className="w-4 h-4 text-indigo-600" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-slate-900">Source Rankings</h2>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <Th className="w-14">#</Th>
            <Th>
              <SortableHeader>Source</SortableHeader>
            </Th>
            <Th>
              <SortableHeader withHelp>Citation %</SortableHeader>
            </Th>
            <Th>
              <HeaderWithHelp>CITATIONS</HeaderWithHelp>
            </Th>
            <Th>
              <HeaderWithHelp>TYPE</HeaderWithHelp>
            </Th>
            <Th>
              <SortableHeader withHelp>Rating</SortableHeader>
            </Th>
            <Th>
              <HeaderWithHelp>USED IN PROMPT</HeaderWithHelp>
            </Th>
            <Th className="w-8">{""}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-12 text-center text-sm text-slate-400"
              >
                No hay fuentes en el período seleccionado.
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => {
              const rank = idx + 1;
              const isOpen = expanded === row.domain;
              const type = getSourceType(row.domain);
              const rating = getSourceRating(row.pctOfRuns);
              const cleanDomain = rootDomain(row.domain);
              const barWidth =
                maxPct > 0 ? Math.max(4, (row.pctOfRuns / maxPct) * 100) : 0;

              return (
                <Fragment key={row.domain}>
                  <tr
                    className="hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : row.domain)}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center min-w-[2.25rem] h-6 px-1.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
                        #{rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                        )}
                        <FaviconImage domain={cleanDomain} />
                        <span className="font-semibold text-slate-900">
                          {cleanDomain}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-slate-700 font-medium tabular-nums">
                          {row.pctOfRuns.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full bg-slate-100 text-slate-700 text-xs font-medium tabular-nums">
                        {row.citationsCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SourceTypeBadge type={type} />
                    </td>
                    <td className="px-4 py-3">
                      <SourceRatingBadge rating={rating} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <div className="text-slate-700 truncate text-xs">
                          {row.examplePromptText ?? "—"}
                        </div>
                        {row.extraPromptCount > 0 && (
                          <div className="text-[11px] text-indigo-600 mt-0.5">
                            +{row.extraPromptCount} more prompts
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3" />
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <SourceDetailPanel
                          workspaceSlug={workspaceSlug}
                          workspaceId={workspaceId}
                          domain={row.domain}
                          days={days}
                          llmKey={llmKey}
                          country={country}
                          citationsCount={row.citationsCount}
                          urlsTotal={row.urlsTotal}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide ${className}`}
    >
      {children}
    </th>
  );
}

function HeaderWithHelp({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <HelpCircle className="w-3 h-3 text-slate-300" aria-hidden="true" />
    </span>
  );
}

function SortableHeader({
  children,
  withHelp,
}: {
  children: React.ReactNode;
  withHelp?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      {withHelp && <HelpCircle className="w-3 h-3 text-slate-300" aria-hidden="true" />}
      <ChevronDown className="w-3 h-3 text-slate-300" aria-hidden="true" />
    </span>
  );
}

function FaviconImage({ domain }: { domain: string }) {
  const [errored, setErrored] = useState(false);
  if (errored || !domain || domain === "—") {
    return (
      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Globe className="w-3 h-3 text-slate-400" aria-hidden="true" />
      </div>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: external favicon URL, no next/image config
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      aria-hidden="true"
      width={20}
      height={20}
      className="w-5 h-5 rounded-full flex-shrink-0"
      onError={() => setErrored(true)}
    />
  );
}
