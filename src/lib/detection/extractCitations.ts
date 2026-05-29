import { normalizeUrl, type ExtractedSource } from "./extractSources";

export type CitationSourceType = "inline" | "annotation" | "citation_legacy" | "web_plugin";

export interface ExtractedCitation {
  url: string;
  domain: string;
  title: string | null;
  quote: string | null;
  citationIndex: number | null;
  sourceType: CitationSourceType;
}

type AnnotationLike = {
  type?: unknown;
  url_citation?: {
    url?: unknown;
    title?: unknown;
    content?: unknown;
  };
};

type OpenRouterChoiceLike = {
  message?: {
    annotations?: unknown;
  };
};

type OpenRouterResponseLike = {
  choices?: unknown;
  citations?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function pushCitation(
  out: Map<string, ExtractedCitation>,
  url: string,
  meta: { title?: string | null; quote?: string | null; sourceType: CitationSourceType }
) {
  const normalized = normalizeUrl(url);
  if (!normalized) return;
  if (out.has(normalized)) return;
  let domain = "";
  try {
    domain = new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return;
  }
  out.set(normalized, {
    url: normalized,
    domain,
    title: meta.title ?? null,
    quote: meta.quote ?? null,
    citationIndex: out.size + 1,
    sourceType: meta.sourceType,
  });
}

export function extractCitationsFromOpenRouter(data: unknown): ExtractedCitation[] {
  if (!data || typeof data !== "object") return [];
  const response = data as OpenRouterResponseLike;
  const out = new Map<string, ExtractedCitation>();

  const choices = Array.isArray(response.choices) ? response.choices : [];
  const firstChoice = choices[0] as OpenRouterChoiceLike | undefined;
  const annotations = firstChoice?.message?.annotations;

  if (Array.isArray(annotations)) {
    for (const raw of annotations) {
      if (!raw || typeof raw !== "object") continue;
      const ann = raw as AnnotationLike;
      if (ann.type !== "url_citation") continue;
      const url = asString(ann.url_citation?.url);
      if (!url) continue;
      pushCitation(out, url, {
        title: asString(ann.url_citation?.title),
        quote: asString(ann.url_citation?.content),
        sourceType: "annotation",
      });
    }
  }

  if (Array.isArray(response.citations)) {
    for (const raw of response.citations) {
      const url = asString(raw);
      if (!url) continue;
      pushCitation(out, url, { sourceType: "citation_legacy" });
    }
  }

  return Array.from(out.values());
}

export function mergeCitations(
  inline: ExtractedSource[],
  structured: ExtractedCitation[]
): ExtractedCitation[] {
  const out = new Map<string, ExtractedCitation>();

  for (const c of structured) {
    out.set(c.url, c);
  }

  for (const s of inline) {
    if (out.has(s.url)) continue;
    out.set(s.url, {
      url: s.url,
      domain: s.domain,
      title: s.title,
      quote: null,
      citationIndex: null,
      sourceType: "inline",
    });
  }

  return Array.from(out.values());
}
