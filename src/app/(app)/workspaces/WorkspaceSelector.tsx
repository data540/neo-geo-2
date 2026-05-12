"use client";

import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceForm } from "@/components/workspace/WorkspaceForm";
import type { Workspace } from "@/types";

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
}

export function WorkspaceSelector({ workspaces }: WorkspaceSelectorProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Selecciona un workspace</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Elige el proyecto con el que quieres trabajar.
          </p>
        </div>

        <div className="space-y-3">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => router.push(`/${ws.slug}/prompts`)}
              className="w-full flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{ws.name}</p>
                <p className="text-sm text-slate-500 truncate">{ws.slug}</p>
              </div>
              <span className="text-slate-300 text-lg">→</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="w-full flex items-center gap-4 bg-white border border-dashed border-slate-300 rounded-xl p-4 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-slate-500" />
            </div>
            <p className="font-medium text-slate-500">Nuevo workspace</p>
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo workspace</DialogTitle>
          </DialogHeader>
          <WorkspaceForm
            onSuccess={(slug) => {
              setDialogOpen(false);
              router.push(`/${slug}/prompts`);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
