export interface ExtractedSource {
  url: string;
  domain: string;
  title: string | null;
}

function normalizeUrl(raw: string): string | null {
  const cleaned = raw.trim().replace(/[),.;!?]+$/g, "");
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractSourcesFromResponse(text: string): ExtractedSource[] {
  const found = new Map<string, ExtractedSource>();

  // Markdown links: [Title](https://...)
  const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
  for (const match of text.matchAll(markdownRegex)) {
    const maybeUrl = match[2];
    if (!maybeUrl) continue;
    const normalized = normalizeUrl(maybeUrl);
    if (!normalized) continue;
    const parsed = new URL(normalized);
    if (!found.has(normalized)) {
      found.set(normalized, {
        url: normalized,
        domain: parsed.hostname.replace(/^www\./, ""),
        title: match[1]?.trim() || null,
      });
    }
  }

  // Plain URLs: https://...
  const urlRegex = /\bhttps?:\/\/[^\s<>"'`]+/gi;
  for (const match of text.matchAll(urlRegex)) {
    const maybeUrl = match[0];
    if (!maybeUrl) continue;
    const normalized = normalizeUrl(maybeUrl);
    if (!normalized) continue;
    if (found.has(normalized)) continue;
    const parsed = new URL(normalized);
    found.set(normalized, {
      url: normalized,
      domain: parsed.hostname.replace(/^www\./, ""),
      title: null,
    });
  }

  return Array.from(found.values());
}
