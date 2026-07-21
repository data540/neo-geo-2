"use client";

import {
  BarChart3,
  Building2,
  Globe,
  LayoutDashboard,
  Lightbulb,
  MessageSquareText,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Swords,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { WorkspaceMemberRole } from "@/types";

interface MainNavProps {
  workspaceSlug: string;
  collapsed?: boolean;
  userRole: WorkspaceMemberRole;
  isSuperAdmin?: boolean;
}

const getNavItems = (slug: string) => [
  { href: `/${slug}/company-bio`, label: "Company Bio", icon: Building2 },
  { href: `/${slug}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
  { href: `/${slug}/prompts`, label: "Prompts", icon: MessageSquareText },
  { href: `/${slug}/prompt-research`, label: "GEO Research", icon: Search },
  { href: `/${slug}/recommendations`, label: "Recomendaciones", icon: Lightbulb },
  { href: `/${slug}/sources`, label: "Sources", icon: Globe },
  { href: `/${slug}/competitors`, label: "Competitors", icon: Swords },
  { href: `/${slug}/analytics`, label: "Analytics", icon: BarChart3 },
  { href: `/${slug}/team`, label: "Team", icon: Users },
  // Solo el rol 'owner' ve la administración del workspace.
  { href: `/${slug}/settings`, label: "Settings", icon: Settings, ownerOnly: true },
  { href: `/${slug}/admin`, label: "Admin", icon: ShieldCheck, ownerOnly: true },
  // MCP: visible para owner y admin (coincide con can_manage_workspace en el backend).
  { href: `/${slug}/mcp`, label: "MCP", icon: Plug, managerOnly: true },
];

export function MainNav({
  workspaceSlug,
  collapsed = false,
  userRole,
  isSuperAdmin = false,
}: MainNavProps) {
  const pathname = usePathname();

  const items = getNavItems(workspaceSlug).filter((item) => {
    if ("ownerOnly" in item && item.ownerOnly && userRole !== "owner") return false;
    if ("managerOnly" in item && item.managerOnly && userRole !== "owner" && userRole !== "admin")
      return false;
    if ("superAdminOnly" in item && item.superAdminOnly && !isSuperAdmin) return false;
    return true;
  });

  return (
    <ul className="space-y-0.5 px-2">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={cn("w-4 h-4 shrink-0", isActive ? "text-indigo-600" : "text-slate-400")}
                aria-hidden="true"
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
