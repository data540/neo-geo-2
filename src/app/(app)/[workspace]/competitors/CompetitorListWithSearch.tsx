"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DeleteCompetitorButton } from "./DeleteCompetitorButton";

interface Competitor {
  id: string;
  name: string;
  domain: string | null;
  aliases: unknown;
}

interface Props {
  competitors: Competitor[];
  workspaceId: string;
}

export function CompetitorListWithSearch({ competitors, workspaceId }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return competitors;
    const q = searchQuery.toLowerCase();
    return competitors.filter((c) => c.name.toLowerCase().includes(q));
  }, [competitors, searchQuery]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {competitors.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">
          Aún no has añadido competidores.
        </p>
      ) : (
        <>
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">
              Todos los competidores{" "}
              <span className="font-normal text-slate-500">({competitors.length})</span>
            </p>
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Buscar por nombre…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs rounded-md border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-44"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400 text-center">
              Sin resultados para &ldquo;{searchQuery}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filtered.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    {c.domain && (
                      <p className="text-xs text-slate-400 mt-0.5">{c.domain}</p>
                    )}
                    {Array.isArray(c.aliases) && c.aliases.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Alias: {(c.aliases as string[]).join(", ")}
                      </p>
                    )}
                  </div>
                  <DeleteCompetitorButton
                    competitorId={c.id}
                    workspaceId={workspaceId}
                    name={c.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
