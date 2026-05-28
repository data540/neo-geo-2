export type SourceType = "search_engine" | "social_media" | "other";
export type SourceRating = "low" | "mid" | "high";

const SEARCH_ENGINES = new Set([
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
  "yandex.com",
  "baidu.com",
  "ecosia.org",
  "brave.com",
]);

const SOCIAL_MEDIA = new Set([
  "facebook.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "reddit.com",
  "pinterest.com",
  "threads.net",
  "mastodon.social",
]);

function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    ?.trim() ?? "";
}

export function getSourceType(domain: string | null | undefined): SourceType {
  if (!domain) return "other";
  const normalized = normalizeDomain(domain);
  if (SEARCH_ENGINES.has(normalized)) return "search_engine";
  if (SOCIAL_MEDIA.has(normalized)) return "social_media";
  return "other";
}

export function getSourceRating(pctOfRuns: number): SourceRating {
  if (pctOfRuns >= 7) return "high";
  if (pctOfRuns >= 3) return "mid";
  return "low";
}

export function rootDomain(domain: string | null | undefined): string {
  if (!domain) return "—";
  return normalizeDomain(domain);
}
