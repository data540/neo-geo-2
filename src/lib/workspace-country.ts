import type { WorkspaceMemberRole } from "@/types";

const AIR_EUROPA_SLUG = "air-europa";
const AIR_EUROPA_DEFAULT_COUNTRY = "ES";

export function isAirEuropaWorkspace(slug: string): boolean {
  return slug === AIR_EUROPA_SLUG;
}

export function canRunPromptForWorkspace({
  workspaceSlug,
  promptCountry,
}: {
  workspaceSlug: string;
  promptCountry?: string | null;
}): boolean {
  if (!isAirEuropaWorkspace(workspaceSlug)) return true;
  return (promptCountry ?? "").toUpperCase() === AIR_EUROPA_DEFAULT_COUNTRY;
}

export function canUseAllCountryFilters(role: WorkspaceMemberRole): boolean {
  return role === "owner" || role === "admin";
}

export function resolveWorkspaceCountryFilter({
  workspaceSlug,
  requestedCountry,
  userRole,
}: {
  workspaceSlug: string;
  requestedCountry?: string | null;
  userRole?: WorkspaceMemberRole | null;
}): string | null {
  if (!isAirEuropaWorkspace(workspaceSlug)) {
    return requestedCountry ?? null;
  }

  if (userRole && !canUseAllCountryFilters(userRole)) {
    return AIR_EUROPA_DEFAULT_COUNTRY;
  }

  return requestedCountry ?? AIR_EUROPA_DEFAULT_COUNTRY;
}

