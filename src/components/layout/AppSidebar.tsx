"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Workspace, WorkspaceMemberRole } from "@/types";
import { FiltersPanel } from "./FiltersPanel";
import { MainNav } from "./MainNav";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

interface AppSidebarProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  userRole: WorkspaceMemberRole;
}

export function AppSidebar({ workspaces, currentWorkspace, userRole }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-white border-r border-slate-200 transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">n</span>
          </div>
          {!collapsed && (
            <span className="text-base font-bold text-slate-900 truncate">neo-geo</span>
          )}
        </div>
      </div>

      {/* Workspace switcher */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-slate-100">
          <WorkspaceSwitcher workspaces={workspaces} currentWorkspace={currentWorkspace} />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        <MainNav workspaceSlug={currentWorkspace.slug} collapsed={collapsed} />
      </nav>

      {/* Filters panel */}
      {!collapsed && (
        <div className="border-t border-slate-100 py-3 px-3">
          <FiltersPanel workspaceSlug={currentWorkspace.slug} userRole={userRole} />
        </div>
      )}

      {/* Collapse button */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors z-10"
        aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-slate-500" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-slate-500" />
        )}
      </button>
    </aside>
  );
}
