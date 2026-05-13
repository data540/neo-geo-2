"use client";

import { Building2, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceForm } from "@/components/workspace/WorkspaceForm";
import type { Workspace } from "@/types";

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace;
}

export function WorkspaceSwitcher({ workspaces, currentWorkspace }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{currentWorkspace.name}</p>
            <p className="text-xs text-slate-500 truncate">{currentWorkspace.slug}</p>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        {open && (
          <div
            className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-white shadow-lg border border-slate-200 py-1 z-[9999]"
            style={{ minWidth: "240px" }}
          >
            <div className="px-3 py-1.5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Workspaces
              </p>
            </div>
            <div className="h-px bg-slate-100 mx-1 my-1" />
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/${ws.slug}/prompts`);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-3 h-3 text-indigo-600" />
                </div>
                <span className="flex-1 truncate">{ws.name}</span>
                {ws.id === currentWorkspace.id && (
                  <span className="text-indigo-600 text-xs font-medium">✓</span>
                )}
              </button>
            ))}
            <div className="h-px bg-slate-100 mx-1 my-1" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDialogOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 transition-colors text-left"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo workspace
            </button>
          </div>
        )}
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
    </>
  );
}
