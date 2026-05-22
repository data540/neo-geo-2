"use client";

import { useState } from "react";
import type { PromptDetailSource } from "@/types";

interface Props {
  items: PromptDetailSource[];
  maxVisible?: number;
}

function SourceBadge({ source }: { source: PromptDetailSource }) {
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.domain)}&sz=32`;

  const inner = (
    <>
      <img
        src={faviconUrl}
        alt=""
        aria-hidden="true"
        width={14}
        height={14}
        className="rounded-sm"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <span>{source.domain}</span>
      {source.count > 1 && (
        <span className="text-slate-400" title={`Citado ${source.count} veces`}>
          ×{source.count}
        </span>
      )}
    </>
  );

  const className =
    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors";

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={source.url}
      >
        {inner}
      </a>
    );
  }

  return <span className={className}>{inner}</span>;
}

export function SourcesList({ items, maxVisible = 3 }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return (
      <span className="text-xs text-slate-400 italic">
        Ninguna fuente citada en la última ejecución
      </span>
    );
  }

  const visibleItems = expanded ? items : items.slice(0, maxVisible);
  const remaining = items.length - visibleItems.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visibleItems.map((item) => (
        <SourceBadge key={`${item.domain}-${item.url ?? ""}`} source={item} />
      ))}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          +{remaining}
        </button>
      )}
    </div>
  );
}
