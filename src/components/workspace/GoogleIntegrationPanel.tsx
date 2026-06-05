"use client";

import { Loader2, RefreshCw, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { triggerGoogleRefreshAction, updateGoogleConfigAction } from "@/actions/google-config";
import { Button } from "@/components/ui/button";
import type { WorkspaceMemberRole } from "@/types";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  currentRole: WorkspaceMemberRole;
  gscSiteUrl: string | null;
  ga4PropertyId: string | null;
}

export function GoogleIntegrationPanel({
  workspaceId,
  workspaceSlug,
  currentRole,
  gscSiteUrl,
  ga4PropertyId,
}: Props) {
  const canManage = currentRole === "owner" || currentRole === "admin";
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [gsc, setGsc] = useState(gscSiteUrl ?? "");
  const [ga4, setGa4] = useState(ga4PropertyId ?? "");

  function handleSave() {
    if (!canManage) return;
    startTransition(async () => {
      const result = await updateGoogleConfigAction({
        workspaceId,
        workspaceSlug,
        gscSiteUrl: gsc,
        ga4PropertyId: ga4,
      });
      if (result.success) {
        toast.success("Integración Google guardada");
      } else {
        toast.error(result.error ?? "No se pudo guardar");
      }
    });
  }

  function handleRefresh() {
    if (!canManage) return;
    startRefresh(async () => {
      const result = await triggerGoogleRefreshAction(workspaceId);
      if (result.success) {
        toast.success("Refresco lanzado. Los datos aparecerán en unos minutos.");
      } else {
        toast.error(result.error ?? "No se pudo lanzar el refresco");
      }
    });
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Integración Google</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Conecta Search Console y GA4 para la sección Analytics. Requiere dar acceso de lectura a
            la cuenta de servicio en cada propiedad.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={!canManage || refreshing || (!gscSiteUrl && !ga4PropertyId)}
            title={
              !gscSiteUrl && !ga4PropertyId
                ? "Guarda primero los identificadores"
                : "Refrescar datos ahora"
            }
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refrescar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canManage || pending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="gsc-site-url" className="text-xs font-medium text-slate-600">
            Search Console — Site URL
          </label>
          <input
            id="gsc-site-url"
            type="text"
            value={gsc}
            onChange={(e) => setGsc(e.target.value)}
            disabled={!canManage || pending}
            placeholder="sc-domain:ejemplo.com  o  https://www.ejemplo.com/"
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-[11px] text-slate-400">
            Tal cual aparece en Search Console (propiedad de dominio o con prefijo).
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="ga4-property-id" className="text-xs font-medium text-slate-600">
            GA4 — Property ID
          </label>
          <input
            id="ga4-property-id"
            type="text"
            inputMode="numeric"
            value={ga4}
            onChange={(e) => setGa4(e.target.value)}
            disabled={!canManage || pending}
            placeholder="123456789"
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-[11px] text-slate-400">
            Número de propiedad GA4 (Administrar → Detalles de la propiedad).
          </p>
        </div>
      </div>

      {!canManage && (
        <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
          Solo owners y admins pueden cambiar la integración Google.
        </p>
      )}
    </section>
  );
}
