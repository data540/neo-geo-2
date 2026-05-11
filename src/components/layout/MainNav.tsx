"use client";

import {
  Building2,
  Globe,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Swords,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface MainNavProps {
  workspaceSlug: string;
  collapsed?: boolean;
}

const getNavItems = (slug: string) => [
  { href: `/${slug}/company-bio`, label: "Company Bio", icon: Building2 },
  { href: `/${slug}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
  { href: `/${slug}/prompts`, label: "Prompts", icon: MessageSquareText },
  { href: `/${slug}/prompt-research`, label: "GEO Research", icon: Search },
  { href: `/${slug}/sources`, label: "Sources", icon: Globe },
  { href: `/${slug}/competitors`, label: "Competitors", icon: Swords },
  { href: `/${slug}/team`, label: "Team", icon: Users },
];

export function MainNav({ workspaceSlug, collapsed = false }: MainNavProps) {
  const pathname = usePathname();

  const items = getNavItems(workspaceSlug);

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
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
