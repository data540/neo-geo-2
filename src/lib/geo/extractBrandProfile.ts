import { createHash } from "node:crypto";
import { DEFAULT_OPENROUTER_MODELS } from "@/lib/llm/modelDefaults";
import type {
  CompanyBioAnalysisResult,
  CompanyBioConfidence,
  CompanyBioProfile,
  ExtractedBrandProfile,
} from "@/types";

const SYSTEM_PROMPT = `Eres un analista senior de inteligencia de negocio.
Tu objetivo es entregar un perfil completo y usable para inteligencia GEO de una marca, a partir de contenido web e inferencias prudentes basadas en ese contenido.

Reglas:
- Analiza cualquier tipo de negocio o sector; infiere la industria desde el contenido real del sitio.
- Rellena todas las secciones con informacion explicita o inferencia prudente basada en el sitio.
- No inventes premios, partners, certificaciones ni tecnologias concretas que no aparezcan explicitamente.
- Si una seccion puede inferirse del modelo de negocio y los servicios publicados, rellenala de forma util.
- Responde unicamente JSON valido, sin markdown ni comentarios.`;

const RELEVANT_LINK_PATTERNS = [
  // Empresa / nosotros
  "about", "company", "empresa", "quienes", "sobre", "historia", "mision",
  // Productos / servicios
  "products", "services", "productos", "servicios", "soluciones", "solutions",
  "features", "pricing", "precios", "planes", "plans",
  // Soporte / ayuda
  "help", "support", "ayuda", "faq", "contact", "contacto",
  // Legal / confianza
  "terms", "privacy", "legal",
  // Casos / clientes
  "blog", "cases", "clientes", "customers",
];

const MAX_ANALYZED_PAGES = 10;

type RawCompanyBioProfile = Partial<CompanyBioProfile>;

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringValue(value: unknown, fallback: string): string {
  return stringOrNull(value) ?? fallback;
}

function stringArray(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = stringOrNull(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

function confidence(value: unknown): CompanyBioConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenRouter response did not contain JSON");
    return JSON.parse(match[0]);
  }
}

async function fetchJinaMarkdown(url: string): Promise<string | null> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  const text = await response.text();
  return text.length >= 100 ? text : null;
}

function discoverRelevantUrls(markdown: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const urls = new Set<string>([baseUrl]);
  const linkPattern = /\[[^\]]+\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/gi;

  for (const match of markdown.matchAll(linkPattern)) {
    const href = match[1];
    if (!href) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    const searchable = `${url.pathname} ${url.search}`.toLowerCase();
    if (!RELEVANT_LINK_PATTERNS.some((pattern) => searchable.includes(pattern))) continue;
    url.hash = "";
    urls.add(url.toString().replace(/\/$/, ""));
    if (urls.size >= MAX_ANALYZED_PAGES) break;
  }

  return [...urls].slice(0, MAX_ANALYZED_PAGES);
}

function dedupeContent(pages: Array<{ url: string; content: string }>): string {
  const seen = new Set<string>();
  const sections: string[] = [];

  for (const page of pages) {
    const lines = page.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 20);
    const uniqueLines: string[] = [];
    for (const line of lines) {
      const key = line.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueLines.push(line);
    }
    if (uniqueLines.length > 0) {
      sections.push(`# Source: ${page.url}\n${uniqueLines.join("\n").slice(0, 9000)}`);
    }
  }

  return sections.join("\n\n").slice(0, 28_000);
}

function mergeFallbacks(profile: CompanyBioProfile, content: string): CompanyBioProfile {
  const hasSparseContent = content.length < 1500;
  return {
    ...profile,
    analysisInfo: {
      ...profile.analysisInfo,
      confidence: hasSparseContent
        ? "low"
        : profile.analysisInfo.confidence === "low"
          ? "medium"
          : profile.analysisInfo.confidence,
    },
  };
}

function normalizeProfile(
  raw: RawCompanyBioProfile,
  sourceUrl: string,
  analyzedAt: string,
  content: string
): CompanyBioProfile {
  const normalized = {
    company: {
      name: stringValue(raw.company?.name, new URL(sourceUrl).hostname.replace(/^www\./, "")),
      website: stringValue(raw.company?.website, sourceUrl),
      category: stringOrNull(raw.company?.category),
      industry: stringOrNull(raw.company?.industry),
      geography: stringOrNull(raw.company?.geography),
      logoHint: stringOrNull(raw.company?.logoHint),
    },
    businessOverview: {
      summary: stringValue(
        raw.businessOverview?.summary,
        "No se pudo generar un resumen fiable a partir del contenido disponible."
      ),
      valueProposition: stringOrNull(raw.businessOverview?.valueProposition),
    },
    targetAudience: stringValue(
      raw.targetAudience,
      "No se detecto una audiencia objetivo clara en el sitio analizado."
    ),
    businessModelRevenue: {
      pricingStrategy: stringOrNull(raw.businessModelRevenue?.pricingStrategy),
      revenueStreams: stringArray(raw.businessModelRevenue?.revenueStreams, 8),
    },
    productsServices: stringArray(raw.productsServices, 12),
    technologyPartnerships: {
      technologyStack: stringArray(raw.technologyPartnerships?.technologyStack, 8),
      keyPartnerships: stringArray(raw.technologyPartnerships?.keyPartnerships, 8),
    },
    userExperienceContent: {
      userExperience: stringOrNull(raw.userExperienceContent?.userExperience),
      contentStrategy: stringOrNull(raw.userExperienceContent?.contentStrategy),
    },
    socialProof: stringArray(raw.socialProof, 10),
    keyFeatures: stringArray(raw.keyFeatures, 12),
    analysisInfo: {
      analyzedAt,
      sourceUrl,
      pagesAnalyzed: stringArray(raw.analysisInfo?.pagesAnalyzed, 6),
      confidence: confidence(raw.analysisInfo?.confidence),
    },
  };

  return mergeFallbacks(normalized, content);
}

function buildLegacyProfile(profile: CompanyBioProfile): ExtractedBrandProfile {
  return {
    extractedSummary: profile.businessOverview.summary,
    positioning: profile.company.category ?? profile.company.industry ?? null,
    audience: profile.targetAudience,
    productsServices: profile.productsServices.join("\n"),
    differentiators: profile.keyFeatures.join("\n"),
  };
}

function buildUserPrompt(url: string, content: string, analyzedAt: string): string {
  return `Analiza la empresa de esta URL: ${url}

Contenido extraido:
${content}

Devuelve un JSON con exactamente esta estructura:
{
  "company": {
    "name": "string",
    "website": "string",
    "category": "string|null",
    "industry": "string|null",
    "geography": "string|null",
    "logoHint": "string|null"
  },
  "businessOverview": {
    "summary": "string",
    "valueProposition": "string|null"
  },
  "targetAudience": "string",
  "businessModelRevenue": {
    "pricingStrategy": "string|null",
    "revenueStreams": ["string"]
  },
  "productsServices": ["string"],
  "technologyPartnerships": {
    "technologyStack": ["string"],
    "keyPartnerships": ["string"]
  },
  "userExperienceContent": {
    "userExperience": "string|null",
    "contentStrategy": "string|null"
  },
  "socialProof": ["string"],
  "keyFeatures": ["string"],
  "analysisInfo": {
    "analyzedAt": "${analyzedAt}",
    "sourceUrl": "${url}",
    "pagesAnalyzed": ["string"],
    "confidence": "high|medium|low"
  }
}

Reglas de redaccion:
- Escribe en espanol claro.
- Resume Business Overview en 80-120 palabras.
- Infiere el sector, industria y modelo de negocio desde el contenido del sitio.
- Rellena todas las secciones con informacion explicita o inferencia prudente basada en el sitio.
- No dejes arrays vacios salvo que sea realmente imposible tras analizar home y paginas secundarias.
- No inventes premios, partners, certificaciones ni tecnologias concretas. Si no aparecen, no los nombres como hechos.
- valueProposition debe ser 1 frase obligatoria.
- pricingStrategy debe ser 1 parrafo breve obligatorio.
- revenueStreams debe tener 3-6 items.
- Target Audience debe describir los tipos reales de clientes y sus necesidades.
- Products & Services debe tener 8-12 items.
- Key Features debe tener 6-10 items orientados a los diferenciadores reales de la marca.
- Social Proof debe incluir alianzas, premios, partners, programas o certificaciones solo si aparecen en el contenido.
- Technology & Partnerships no debe listar tecnologia si solo se infiere por ser una web moderna.`;
}

export async function extractBrandProfile(domain: string): Promise<CompanyBioAnalysisResult> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no esta configurada. La Company Bio se genera via OpenRouter y no tiene fallback mock."
    );
  }

  const sourceUrl = normalizeUrl(domain);
  const homeContent = await fetchJinaMarkdown(sourceUrl);
  if (!homeContent) throw new Error("No se pudo extraer contenido suficiente desde la URL");

  const urls = discoverRelevantUrls(homeContent, sourceUrl);
  const pages = [{ url: sourceUrl, content: homeContent }];
  for (const url of urls.slice(1, MAX_ANALYZED_PAGES)) {
    try {
      const content = await fetchJinaMarkdown(url);
      if (content) pages.push({ url, content });
    } catch {
      // Continue with the pages that were successfully read.
    }
  }

  const content = dedupeContent(pages);
  if (content.length < 100) throw new Error("El contenido extraido es demasiado escaso");

  const analyzedAt = new Date().toISOString();
  const model =
    process.env.OPENROUTER_MODEL_COMPANY_BIO?.trim() || DEFAULT_OPENROUTER_MODELS.chatgpt;
  const inputDigest = createHash("sha256").update(content).digest("hex");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Mentio",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(sourceUrl, content, analyzedAt) },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
  };
  const rawText = json.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonObject(rawText) as RawCompanyBioProfile;
  const profile = normalizeProfile(parsed, sourceUrl, analyzedAt, content);
  const analyzedUrls = pages.map((page) => page.url);
  profile.analysisInfo.pagesAnalyzed =
    profile.analysisInfo.pagesAnalyzed.length > 0
      ? profile.analysisInfo.pagesAnalyzed
      : analyzedUrls;

  return {
    profile,
    legacy: buildLegacyProfile(profile),
    sourceUrl,
    model: json.model ?? model,
    inputDigest,
  };
}
