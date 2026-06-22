"use client";

import { CheckCircle2, Copy, ExternalLink, Sparkles, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { getSourceDetailAction } from "@/actions/sources";
import type { SourceDetail } from "@/types";

const LLM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

interface Props {
  workspaceSlug: string;
  workspaceId: string;
  domain: string;
  days: number;
  llmKey: string | null;
  country: string | null;
  citationsCount: number;
  urlsTotal: number;
}

export function SourceDetailPanel({
  workspaceSlug,
  workspaceId,
  domain,
  days,
  llmKey,
  country,
  citationsCount,
  urlsTotal,
}: Props) {
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllUrls, setShowAllUrls] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSourceDetailAction({
      workspaceSlug,
      workspaceId,
      domain,
      days,
      llmKey,
      country,
    }).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setDetail(result.data);
      } else {
        setError(result.error ?? "Error cargando detalle");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, workspaceId, domain, days, llmKey, country]);

  if (loading) {
    return (
      <div className="px-6 py-6 bg-slate-50/50 border-t border-slate-200">
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="h-24 bg-slate-200 rounded-lg" />
            <div className="h-24 bg-slate-200 rounded-lg" />
            <div className="h-24 bg-slate-200 rounded-lg" />
          </div>
          <div className="h-32 bg-slate-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="px-6 py-6 bg-slate-50/50 border-t border-slate-200">
        <p className="text-sm text-rose-600">{error ?? "Sin datos para este dominio"}</p>
      </div>
    );
  }

  const visibleUrls = showAllUrls ? detail.citedUrls : detail.citedUrls.slice(0, 3);

  return (
    <div className="px-6 py-5 bg-slate-50/50 border-t border-slate-200 space-y-5">
      {/* Top cards: Brand Presence, Top Competitors, Cited By */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BrandPresenceCard
          urlsWithOwnBrand={detail.brandPresence.urlsWithOwnBrand}
          totalUrls={detail.brandPresence.totalUrls}
          pct={detail.brandPresence.pct}
        />
        <TopCompetitorsCard competitors={detail.topCompetitors} />
        <CitedByCard llms={detail.citedByLlms} />
      </div>

      {/* Cited URLs section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-900">
            Cited URLs{" "}
            <span className="font-normal text-slate-500">
              {citationsCount} citations across {urlsTotal} URLs
            </span>
          </h4>
          {detail.citedUrls.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllUrls((v) => !v)}
              className="text-xs text-slate-500 hover:text-indigo-600"
            >
              {showAllUrls
                ? "Show less"
                : `Showing 3 of ${detail.citedUrls.length}`}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {visibleUrls.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Sin URLs específicas</div>
          ) : (
            visibleUrls.map((u) => <CitedUrlCard key={u.url} url={u} />)
          )}
        </div>
      </div>
    </div>
  );
}

function BrandPresenceCard({
  urlsWithOwnBrand,
  totalUrls,
  pct,
}: {
  urlsWithOwnBrand: number;
  totalUrls: number;
  pct: number;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Brand Presence
        </span>
      </div>
      <div className="text-lg font-bold text-slate-900">
        {urlsWithOwnBrand} of {totalUrls} URLs
      </div>
      <div className="text-xs text-slate-500 mt-0.5">
        {pct}% mention your brand
      </div>
    </div>
  );
}

function TopCompetitorsCard({
  competitors,
}: {
  competitors: Array<{ brandId: string; name: string; count: number }>;
}) {
  const visible = competitors.slice(0, 3);
  const extra = competitors.length - visible.length;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Trophy className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Top Competitors
        </span>
      </div>
      {competitors.length === 0 ? (
        <div className="text-xs text-slate-400">Ninguno</div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {visible.map((c) => (
            <span key={c.brandId} className="text-slate-700">
              {c.name}{" "}
              <span className="font-semibold text-slate-900">{c.count}</span>
            </span>
          ))}
          {extra > 0 && (
            <span className="text-xs text-slate-400">+{extra}</span>
          )}
        </div>
      )}
    </div>
  );
}

function CitedByCard({ llms }: { llms: Array<{ key: string; name: string }> }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Cited By
        </span>
      </div>
      {llms.length === 0 ? (
        <div className="text-xs text-slate-400">—</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {llms.map((l) => (
            <span
              key={l.key}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
            >
              {LLM_LABELS[l.key] ?? l.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CitedUrlCard({
  url,
}: {
  url: {
    url: string;
    title: string | null;
    mentionCount: number;
    ownBrandPresent: boolean;
    competitorCount: number;
    llmKeys: string[];
    usedInPrompts: string[];
  };
}) {
  const [copied, setCopied] = useState(false);
  const displayTitle = url.title ?? deriveTitleFromUrl(url.url);
  const displayUrl = url.url.replace(/^https?:\/\/(www\.)?/, "");

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silent
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-900 truncate">
            {displayTitle}
          </div>
          <div className="text-xs text-slate-500 truncate mt-0.5">{displayUrl}</div>

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Tag color="slate">
              {url.mentionCount} {url.mentionCount === 1 ? "mention" : "mentions"}
            </Tag>
            {url.ownBrandPresent ? (
              <Tag color="emerald">Has brand</Tag>
            ) : (
              <Tag color="slate-muted">No brand</Tag>
            )}
            {url.competitorCount > 0 && (
              <Tag color="amber">
                {url.competitorCount}{" "}
                {url.competitorCount === 1 ? "competitor" : "competitors"}
              </Tag>
            )}
            {url.llmKeys.map((k) => (
              <Tag key={k} color="indigo">
                {LLM_LABELS[k] ?? k}
              </Tag>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={copyUrl}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title={copied ? "Copiado" : "Copiar URL"}
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <a
            href={url.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="Abrir URL"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      {url.usedInPrompts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Used in {url.usedInPrompts.length}{" "}
            {url.usedInPrompts.length === 1 ? "prompt" : "prompts"}
          </div>
          <div className="space-y-1">
            {url.usedInPrompts.slice(0, 3).map((p) => (
              <div
                key={p}
                className="text-xs text-slate-600 bg-indigo-50/40 border border-indigo-100/60 rounded px-2 py-1.5 truncate"
              >
                {p}
              </div>
            ))}
            {url.usedInPrompts.length > 3 && (
              <div className="text-[11px] text-slate-400">
                +{url.usedInPrompts.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type TagColor = "slate" | "slate-muted" | "emerald" | "amber" | "indigo";

const TAG_STYLES: Record<TagColor, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  "slate-muted": "bg-slate-50 text-slate-500 border-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

function Tag({ color, children }: { color: TagColor; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${TAG_STYLES[color]}`}
    >
      {children}
    </span>
  );
}

function deriveTitleFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop() ?? "";
    return (
      last
        .replace(/[-_]/g, " ")
        .replace(/\.\w+$/, "")
        .replace(/\b\w/g, (c) => c.toUpperCase()) || url
    );
  } catch {
    return url;
  }
}
