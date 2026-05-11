"use client";

import { Building2, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Workspace } from "@/types";

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace;
}

export function WorkspaceSwitcher({ workspaces, currentWorkspace }: WorkspaceSwitcherProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 transition-colors text-left">
        <div className="w-7 h-7 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{currentWorkspace.name}</p>
          <p className="text-xs text-slate-500 truncate">{currentWorkspace.slug}</p>
        </div>
        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Workspaces</p>
        </div>
        <DropdownMenuSeparator />
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => router.push(`/${ws.slug}/prompts`)}
            className="cursor-pointer"
          >
            <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center mr-2 shrink-0">
              <Building2 className="w-3 h-3 text-indigo-600" />
            </div>
            <span className="truncate">{ws.name}</span>
            {ws.id === currentWorkspace.id && <span className="ml-auto text-indigo-600">✓</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/onboarding")}
          className="cursor-pointer text-slate-500"
        >
          + Nuevo workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
