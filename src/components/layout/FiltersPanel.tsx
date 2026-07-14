"use client";

import { Tag } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canUseAllCountryFilters,
  isAirEuropaWorkspace,
  resolveWorkspaceCountryFilter,
} from "@/lib/workspace-country";
import type { WorkspaceMemberRole } from "@/types";

const COUNTRIES = [
  { code: "all", label: "Todos los países" },
  { code: "ES", label: "🇪🇸 España" },
  { code: "MX", label: "🇲🇽 México" },
  { code: "AR", label: "🇦🇷 Argentina" },
  { code: "CO", label: "🇨🇴 Colombia" },
  { code: "US", label: "🇺🇸 Estados Unidos" },
  { code: "GB", label: "🇬🇧 Reino Unido" },
  { code: "DE", label: "🇩🇪 Alemania" },
  { code: "FR", label: "🇫🇷 Francia" },
];

interface FiltersPanelProps {
  workspaceSlug: string;
  userRole: WorkspaceMemberRole;
}

export function FiltersPanel({ workspaceSlug, userRole }: FiltersPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const lockedToSpain = isAirEuropaWorkspace(workspaceSlug) && !canUseAllCountryFilters(userRole);
  const currentCountry =
    resolveWorkspaceCountryFilter({
      workspaceSlug,
      userRole,
      requestedCountry: searchParams.get("country"),
    }) ?? "all";
  const countries = lockedToSpain ? COUNTRIES.filter((c) => c.code === "ES") : COUNTRIES;

  const handleCountryChange = useCallback(
    (value: string | null) => {
      const v = value ?? "all";
      const params = new URLSearchParams(searchParams.toString());
      if (v === "all") {
        params.delete("country");
      } else {
        params.set("country", v);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Filtros</p>
        <Select value={currentCountry} onValueChange={handleCountryChange} disabled={lockedToSpain}>
          <SelectTrigger className="h-8 text-xs border-slate-200">
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((c) => (
              <SelectItem key={c.code} value={c.code} className="text-xs">
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {lockedToSpain && (
          <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
            Mercado Espana fijado para este workspace.
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          onClick={() => router.push(`/${workspaceSlug}/tags`)}
          disabled={userRole === "viewer"}
        >
          <Tag className="w-3 h-3" />
          Gestionar tags
        </button>
      </div>
    </div>
  );
}
