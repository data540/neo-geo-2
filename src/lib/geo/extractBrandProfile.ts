import { createHash } from "node:crypto";
import { DEFAULT_OPENROUTER_MODELS } from "@/lib/llm/modelDefaults";
import type {
  CompanyBioAnalysisResult,
  CompanyBioConfidence,
  CompanyBioProfile,
  ExtractedBrandProfile,
} from "@/types";

const SYSTEM_PROMPT = `Eres un analista senior de inteligencia de negocio.
Tu objetivo es entregar un perfil completo y usable para inteligencia GEO de una marca, a partir del contenido web proporcionado.

Reglas:
- Analiza el negocio real detectado en el contenido; no arrastres vocabulario ni audiencias de otros sectores.
- Infiere sector, productos, audiencia y propuesta de valor desde el contenido real del sitio.
- No uses terminos de aerolineas, pasajeros, vuelos, aeropuertos, equipaje, check-in o rebooking salvo que el sitio analizado sea claramente de una aerolinea.
- No inventes premios, partners ni certificaciones que no aparezcan explicitamente en el contenido.
- Si un campo no puede determinarse con confianza, usa null en lugar de inventar.
- Responde unicamente JSON valido sin markdown ni comentarios.`;

// Páginas que NO describen el negocio y sesgan el análisis: legales/cookies y
// pantallas transaccionales o de cuenta (checkout, login, gestión de reserva…).
// Nunca se seleccionan por descubrimiento automático.
const EXCLUDED_LINK_PATTERNS = [
  "cookie", "privacy", "privacidad", "legal", "aviso-legal", "terms", "terminos",
  "condiciones", "politica-de", "gdpr", "rgpd",
  "login", "signin", "sign-in", "signup", "sign-up", "register", "registro",
  "checkin", "check-in", "mytrips", "my-trips", "checkout", "cart", "basket",
  "account", "cuenta", "logout", "password", "session", "wishlist",
];

// Patrones relevantes ponderados: mayor peso = describe mejor el negocio.
// Genéricos para cualquier vertical (identidad, catálogo, precios, fidelización,
// alianzas, contenido). Se prioriza por peso al seleccionar páginas.
const RELEVANT_LINK_PATTERNS: Array<[string, number]> = [
  // Identidad corporativa / negocio
  ["about", 5], ["company", 5], ["empresa", 5], ["quienes", 5], ["sobre", 5],
  ["nosotros", 5], ["conocenos", 5], ["corporate", 5], ["corporativ", 5],
  ["compania", 5], ["historia", 4], ["mision", 4],
  // Oferta / catálogo
  ["products", 5], ["productos", 5], ["services", 5], ["servicios", 5],
  ["solutions", 4], ["soluciones", 4], ["destinations", 5], ["destinos", 5],
  ["destino", 5], ["routes", 5], ["rutas", 5], ["ruta", 4], ["cargo", 4], ["carga", 4],
  // Precio / reserva
  ["pricing", 4], ["precios", 4], ["plans", 4], ["planes", 4], ["tarifas", 4],
  ["tarifa", 4], ["fares", 4], ["book", 3], ["reserva", 3], ["booking", 3],
  ["flights", 3], ["vuelos", 3], ["vuelo", 3], ["ofertas", 3], ["oferta", 3], ["deals", 3],
  // Fidelización / programa
  ["loyalty", 4], ["fideliz", 4], ["rewards", 4], ["miles", 4], ["millas", 4],
  ["program", 3], ["programa", 3], ["suma", 4], ["member", 3], ["socio", 3],
  // Alianzas / partners
  ["alliance", 5], ["alianza", 5], ["skyteam", 5], ["oneworld", 5],
  ["staralliance", 5], ["partners", 4], ["partner", 4],
  // Features / soporte / contenido corporativo
  ["features", 3], ["help", 2], ["support", 2], ["ayuda", 2], ["faq", 2],
  ["contact", 2], ["contacto", 2], ["blog", 2], ["news", 2], ["noticias", 2],
  ["prensa", 3], ["press", 3], ["investor", 3], ["inversor", 3], ["cases", 3],
  ["clientes", 3], ["customers", 3], ["sostenib", 2], ["sustainab", 2],
  ["experiencia", 2],
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
  if (trimmed === "" || trimmed === "null" || trimmed === "undefined" || trimmed === "N/A" || trimmed === "n/a") return null;
  return trimmed;
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
  // 20s: las páginas SPA pesadas (p. ej. programas de fidelización) tardan en
  // renderizar en Jina; con 12s se descartaban y sesgaban el análisis.
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;
  const text = await response.text();
  return text.length >= 100 ? text : null;
}

// Puntúa una ruta: -1 si es una página excluida (legal/transaccional), en otro
// caso el mayor peso de los patrones relevantes que contenga (0 = irrelevante).
function scorePath(searchable: string): number {
  if (EXCLUDED_LINK_PATTERNS.some((pattern) => searchable.includes(pattern))) return -1;
  let score = 0;
  for (const [pattern, weight] of RELEVANT_LINK_PATTERNS) {
    if (searchable.includes(pattern)) score = Math.max(score, weight);
  }
  return score;
}

const ASSET_EXTENSION = /\.(svg|png|jpe?g|gif|webp|ico|css|js|mjs|woff2?|ttf|eot|pdf|xml|json|zip|mp4|webm)$/i;

function discoverRelevantUrls(markdown: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const linkPattern = /\[[^\]]+\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/gi;
  const scored = new Map<string, number>();

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
    if (ASSET_EXTENSION.test(url.pathname)) continue;
    const searchable = `${url.pathname} ${url.search}`.toLowerCase();
    const score = scorePath(searchable);
    if (score <= 0) continue;
    url.hash = "";
    const clean = url.toString().replace(/\/$/, "");
    scored.set(clean, Math.max(scored.get(clean) ?? 0, score));
  }

  // Prioriza las páginas más representativas del negocio (mayor peso primero).
  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url)
    .slice(0, MAX_ANALYZED_PAGES);
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

  return sections.join("\n\n").slice(0, 45_000);
}

function mergeFallbacks(profile: CompanyBioProfile, content: string): CompanyBioProfile {
  const hasSparseContent = content.length < 1500;

  return {
    ...profile,
    technologyPartnerships: {
      technologyStack: profile.technologyPartnerships.technologyStack,
      keyPartnerships: profile.technologyPartnerships.keyPartnerships,
    },
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
- Tu objetivo es entregar un informe completo y usable para inteligencia GEO de la marca analizada.
- Mantente fiel al sector detectado. Si la marca es restauracion, franquicias, retail, tecnologia u otro vertical, adapta audiencia, servicios, features y revenue a ese vertical.
- Rellena todas las secciones con informacion explicita o inferencia prudente basada en el sitio.
- No dejes arrays vacios salvo que sea realmente imposible tras analizar home y paginas secundarias.
- No inventes premios, partners, certificaciones ni tecnologias concretas. Si no aparecen, no los nombres como hechos.
- Usa "No detectado publicamente en las paginas analizadas" UNICAMENTE si no hay ningun partner o alianza real en el contenido. Si detectas al menos uno (p. ej. una alianza o socio nombrado), lista solo los reales y no incluyas ese texto.
- valueProposition debe ser 1 frase obligatoria.
- pricingStrategy debe ser 1 parrafo breve obligatorio.
- revenueStreams debe tener 3-6 items.
- Target Audience debe describir segmentos reales de clientes, compradores, usuarios, franquiciados, partners o stakeholders segun el negocio detectado.
- Products & Services debe tener 8-12 items.
- Key Features debe tener 6-10 items orientados a operaciones, experiencia de usuario, propuesta comercial y diferenciadores del vertical detectado.
- User Experience y Content Strategy deben rellenarse desde navegacion, procesos de usuario, formularios, informacion comercial, soporte, contenidos corporativos y llamadas a la accion.
- Social Proof debe incluir alianzas, premios, partners, chefs, programas, certificaciones o senales publicas solo si aparecen en el contenido.
- Technology & Partnerships no debe listar tecnologia si solo se infiere por ser una web moderna.
- Valida internamente que no haya claims inventados, lenguaje generico de otros sectores, ni datos fuera del vertical detectado.`;
}

export async function extractBrandProfile(
  domain: string,
  seedUrls: string[] = []
): Promise<CompanyBioAnalysisResult> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no esta configurada. La Company Bio se genera via OpenRouter y no tiene fallback mock."
    );
  }

  const sourceUrl = normalizeUrl(domain);
  const homeContent = await fetchJinaMarkdown(sourceUrl);
  if (!homeContent) throw new Error("No se pudo extraer contenido suficiente desde la URL");

  // Seeds curados por workspace: páginas representativas que se fuerzan a incluir
  // (imprescindible en sitios SPA cuya home apenas expone enlaces). Tienen
  // prioridad sobre el descubrimiento automático y saltan el filtro de exclusión.
  const normalizedSeeds = seedUrls
    .map((url) => {
      try {
        return normalizeUrl(url);
      } catch {
        return null;
      }
    })
    .filter((url): url is string => Boolean(url));

  const discovered = discoverRelevantUrls(homeContent, sourceUrl);
  const targetUrls = [...new Set([...normalizedSeeds, ...discovered])]
    .filter((url) => url !== sourceUrl)
    .slice(0, MAX_ANALYZED_PAGES);

  const pages = [{ url: sourceUrl, content: homeContent }];
  for (const url of targetUrls) {
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
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
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
