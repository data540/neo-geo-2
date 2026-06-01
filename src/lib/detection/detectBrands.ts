import { extractRankingFromList, type ListSource } from "@/lib/detection/extractRanking";
import type { MentionType, PositionSource, Sentiment } from "@/types";

interface BrandInput {
  id: string;
  name: string;
  aliases: string[];
}

interface DetectBrandsInput {
  rawResponse: string;
  ownBrand: BrandInput;
  competitors: BrandInput[];
}

interface CompetitorDetection {
  brandId: string;
  name: string;
  position: number | null;
  positionSource: PositionSource | null;
  sentiment: Exclude<Sentiment, "no_data">;
  mentionType: MentionType;
  confidence: number;
}

const GENERIC_NON_BRANDS = new Set([
  "espana",
  "colombia",
  "europa",
  "madrid",
  "bogota",
  "medellin",
  "barcelona",
  "airline",
  "aerolinea",
  "aerolineas",
  // geographic abbreviations — not brand names
  "latam",
  "emea",
  "apac",
  "mena",
  "dach",
  "amer",
  "cee",
  "ue",
  "eeuu",
]);

export interface DetectBrandsOutput {
  ownBrandMentioned: boolean;
  ownBrandPosition: number | null;
  ownBrandPositionSource: PositionSource | null;
  detectedBrandName: string | null;
  competitors: CompetitorDetection[];
  sentiment: Sentiment;
  mentionType: MentionType | null;
  confidence: number;
}

interface MentionInfo {
  position: number;
  matchedName: string;
  source: PositionSource;
}

function findFirstIndex(text: string, brand: BrandInput): { idx: number; name: string } | null {
  const textLower = text.toLowerCase();
  const allNames = [brand.name, ...brand.aliases];
  let best: { idx: number; name: string } | null = null;
  for (const name of allNames) {
    const idx = textLower.indexOf(name.toLowerCase());
    if (idx >= 0 && (best === null || idx < best.idx)) {
      best = { idx, name };
    }
  }
  return best;
}

function extractByAppearanceOrder(text: string, brands: BrandInput[]): Map<string, MentionInfo> {
  const result = new Map<string, MentionInfo>();
  const hits: Array<{ brandId: string; idx: number; name: string }> = [];
  for (const brand of brands) {
    const hit = findFirstIndex(text, brand);
    if (hit) hits.push({ brandId: brand.id, idx: hit.idx, name: hit.name });
  }
  hits.sort((a, b) => a.idx - b.idx);
  hits.forEach((h, i) => {
    result.set(h.brandId, {
      position: i + 1,
      matchedName: h.name,
      source: "appearance_order",
    });
  });
  return result;
}

function listSourceToPositionSource(source: ListSource): PositionSource {
  return source === "numbered_list" ? "numbered_list" : "bullet_list";
}

function extractMentionedBrands(text: string, brands: BrandInput[]): Map<string, MentionInfo> {
  // Capa 1: regex de listas numeradas / bullets
  const ranking = extractRankingFromList(text, brands);
  if (ranking.size > 0) {
    const result = new Map<string, MentionInfo>();
    for (const [brandId, match] of ranking) {
      result.set(brandId, {
        position: match.rank,
        matchedName: match.matchedName,
        source: listSourceToPositionSource(match.source),
      });
    }
    // Rellena marcas mencionadas pero no rankeadas en la lista
    const remaining = brands.filter((b) => !result.has(b.id));
    if (remaining.length > 0) {
      const fallback = extractByAppearanceOrder(text, remaining);
      const usedRanks = new Set([...result.values()].map((m) => m.position));
      let nextRank = Math.max(0, ...usedRanks) + 1;
      // Asignar ranks consecutivos por orden de aparición para los no rankeados
      const sorted = [...fallback.entries()].sort((a, b) => a[1].position - b[1].position);
      for (const [brandId, info] of sorted) {
        while (usedRanks.has(nextRank)) nextRank++;
        result.set(brandId, {
          position: nextRank,
          matchedName: info.matchedName,
          source: "appearance_order",
        });
        usedRanks.add(nextRank);
        nextRank++;
      }
    }
    return result;
  }

  // Capa 3: orden de aparición textual de las marcas
  return extractByAppearanceOrder(text, brands);
}

const POSITIVE_WORDS = [
  "recomiendo",
  "excelente",
  "destacado",
  "mejor",
  "sobresaliente",
  "profesional",
  "sólido",
  "referencia",
  "ideal",
  "favorito",
  "líder",
  "calidad",
  "reconocido",
];
const NEGATIVE_WORDS = [
  "malo",
  "deficiente",
  "evitar",
  "problema",
  "fallo",
  "pésimo",
  "no recomiendo",
  "decepcionante",
  "mediocre",
];

function detectSentiment(text: string, brandName: string): Exclude<Sentiment, "no_data"> {
  const textLower = text.toLowerCase();
  const brandLower = brandName.toLowerCase();

  // Extraer contexto de 200 chars alrededor de la mención
  const idx = textLower.indexOf(brandLower);
  const context = idx >= 0 ? textLower.slice(Math.max(0, idx - 100), idx + 200) : textLower;

  const positiveScore = POSITIVE_WORDS.filter((w) => context.includes(w)).length;
  const negativeScore = NEGATIVE_WORDS.filter((w) => context.includes(w)).length;

  if (positiveScore > negativeScore) return "positive";
  if (negativeScore > positiveScore) return "negative";
  return "neutral";
}

const WARNING_PATTERNS = [
  /(evitar|evita|no recomend|cuidado con|problemas? (con|en)|reseñas? negativas?|deficien|advert|pésim|fraud|estaf)/i,
];
const PRIMARY_PATTERNS = [
  /\b(la mejor opción|mi recomendación|recomiend[ao]|primera opción|sería\s+(la mejor|tu mejor|mi))/i,
  /\b(es|sería)\s+(la mejor|la opción ideal|líder|el líder|la primera|tu mejor opción)/i,
  /\b(top\s+1|n[°º]?\s*1|number one|the best choice)/i,
  /(destaca|sobresale)\s+(como|por encima)/i,
];
const COMPARISON_PATTERNS = [
  /(vs\.?|versus|frente a|comparado con|en comparación|en cambio|por su parte|por otro lado|mientras que)/i,
];
const LIST_PATTERNS = [/(^|\n)\s*(\d+[.):-]|[-*•·])\s+/m];

function buildContextWindow(text: string, brandName: string): string {
  const textLower = text.toLowerCase();
  const brandLower = brandName.toLowerCase();
  const idx = textLower.indexOf(brandLower);
  if (idx < 0) return text;
  const start = Math.max(0, idx - 200);
  const end = Math.min(text.length, idx + brandName.length + 250);
  return text.slice(start, end);
}

function isInsideList(fullText: string, brandName: string): boolean {
  // Busca si la marca está dentro de una línea de lista numerada o bullet
  const lines = fullText.split(/\r?\n/);
  const brandLower = brandName.toLowerCase();
  for (const line of lines) {
    if (!line.toLowerCase().includes(brandLower)) continue;
    if (/^\s*(\d+[.):-]|[-*•·])\s+/.test(line)) return true;
  }
  return false;
}

export function classifyMentionType(
  rawResponse: string,
  brandName: string,
  position: number | null
): MentionType {
  const context = buildContextWindow(rawResponse, brandName);

  // Orden de prioridad: warning > primary > comparison > list > general
  if (WARNING_PATTERNS.some((re) => re.test(context))) return "warning";

  if (PRIMARY_PATTERNS.some((re) => re.test(context))) return "primary_recommendation";

  // Si está en posición 1 y NO es una lista, probablemente es recomendación principal
  const insideList = isInsideList(rawResponse, brandName);
  if (
    position === 1 &&
    !insideList &&
    PRIMARY_PATTERNS.some((re) => re.test(rawResponse.slice(0, 600)))
  ) {
    return "primary_recommendation";
  }

  if (COMPARISON_PATTERNS.some((re) => re.test(context))) return "comparison";

  if (insideList || LIST_PATTERNS.some((re) => re.test(context))) return "list_option";

  return "general_mention";
}

export function detectBrands(input: DetectBrandsInput): DetectBrandsOutput {
  const { rawResponse, ownBrand, competitors } = input;

  const allBrands = [ownBrand, ...competitors];
  const mentionMap = extractMentionedBrands(rawResponse, allBrands);

  const ownMention = mentionMap.get(ownBrand.id);
  const ownBrandMentioned = Boolean(ownMention);
  const ownBrandPosition = ownMention?.position ?? null;
  const ownBrandPositionSource = ownMention?.source ?? null;
  const detectedBrandName = ownMention?.matchedName ?? null;

  const competitorDetections: CompetitorDetection[] = competitors.flatMap((comp) => {
    const mention = mentionMap.get(comp.id);
    if (!mention) return [];
    const det: CompetitorDetection = {
      brandId: comp.id,
      name: comp.name,
      position: mention.position,
      positionSource: mention.source,
      sentiment: detectSentiment(rawResponse, mention.matchedName),
      mentionType: classifyMentionType(rawResponse, mention.matchedName, mention.position),
      confidence: 0.85,
    };
    return [det];
  });

  const sentiment: Sentiment = ownBrandMentioned
    ? detectSentiment(rawResponse, detectedBrandName ?? ownBrand.name)
    : "no_data";

  const mentionType: MentionType | null = ownBrandMentioned
    ? classifyMentionType(rawResponse, detectedBrandName ?? ownBrand.name, ownBrandPosition)
    : null;

  return {
    ownBrandMentioned,
    ownBrandPosition,
    ownBrandPositionSource,
    detectedBrandName,
    competitors: competitorDetections,
    sentiment,
    mentionType,
    confidence: ownBrandMentioned ? 0.9 : 1.0,
  };
}

export function extractPotentialCompetitorsFromResponse(rawResponse: string): string[] {
  const candidates = new Set<string>();

  const quotedMatches = rawResponse.matchAll(/"([A-Z][A-Za-z0-9&\-\s]{2,40})"/g);
  for (const match of quotedMatches) {
    const value = (match[1] ?? "").trim();
    if (value) candidates.add(value);
  }

  const namedMatches = rawResponse.matchAll(
    /\b([A-Z][A-Za-z0-9&-]{1,20}(?:\s+[A-Z][A-Za-z0-9&-]{1,20}){0,3})\b/g
  );

  for (const match of namedMatches) {
    const candidate = (match[1] ?? "").trim();
    const lower = candidate.toLowerCase();
    if (candidate.length < 3) continue;
    if (GENERIC_NON_BRANDS.has(lower)) continue;
    if (/^(Top|Los|Las|Otros|Otras|Para|Como|Esta|Esto|Este|Esos|Esas)$/i.test(candidate)) continue;
    if (/[0-9]{2,}/.test(candidate)) continue;
    candidates.add(candidate);
  }

  return Array.from(candidates).slice(0, 25);
}
