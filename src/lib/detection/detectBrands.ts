import type { Sentiment } from "@/types";

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
  sentiment: Exclude<Sentiment, "no_data">;
  confidence: number;
}

export interface DetectBrandsOutput {
  ownBrandMentioned: boolean;
  ownBrandPosition: number | null;
  detectedBrandName: string | null;
  competitors: CompetitorDetection[];
  sentiment: Sentiment;
  confidence: number;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }
  return dp[m]![n]!;
}

function isFuzzyMatch(text: string, term: string, threshold = 0.8): boolean {
  if (text.includes(term)) return true;
  const maxLen = Math.max(text.length, term.length);
  if (maxLen === 0) return true;
  const dist = levenshtein(text.toLowerCase(), term.toLowerCase());
  return 1 - dist / maxLen >= threshold;
}

function extractMentionedBrands(
  text: string,
  brands: BrandInput[]
): Map<string, { position: number; matchedName: string }> {
  const textLower = text.toLowerCase();
  const result = new Map<string, { position: number; matchedName: string }>();

  // Dividir en párrafos/oraciones para inferir orden
  const segments = text.split(/\n|\.|\?|!/).filter((s) => s.trim().length > 0);

  let globalPosition = 1;
  for (const segment of segments) {
    const segLower = segment.toLowerCase();

    for (const brand of brands) {
      if (result.has(brand.id)) continue;

      const allNames = [brand.name, ...brand.aliases];
      for (const name of allNames) {
        const nameLower = name.toLowerCase();
        if (segLower.includes(nameLower) || isFuzzyMatch(segLower, nameLower)) {
          result.set(brand.id, { position: globalPosition, matchedName: name });
          break;
        }
      }
    }
    globalPosition++;
  }

  // Fallback: búsqueda directa en el texto completo
  for (const brand of brands) {
    if (result.has(brand.id)) continue;
    const allNames = [brand.name, ...brand.aliases];
    for (const name of allNames) {
      if (textLower.includes(name.toLowerCase())) {
        result.set(brand.id, { position: 99, matchedName: name });
        break;
      }
    }
  }

  return result;
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

export function detectBrands(input: DetectBrandsInput): DetectBrandsOutput {
  const { rawResponse, ownBrand, competitors } = input;

  const allBrands = [ownBrand, ...competitors];
  const mentionMap = extractMentionedBrands(rawResponse, allBrands);

  const ownMention = mentionMap.get(ownBrand.id);
  const ownBrandMentioned = Boolean(ownMention);
  const ownBrandPosition = ownMention?.position ?? null;
  const detectedBrandName = ownMention?.matchedName ?? null;

  const competitorDetections: CompetitorDetection[] = competitors.flatMap((comp) => {
    const mention = mentionMap.get(comp.id);
    if (!mention) return [];
    const det: CompetitorDetection = {
      brandId: comp.id,
      name: comp.name,
      position: mention.position,
      sentiment: detectSentiment(rawResponse, mention.matchedName),
      confidence: 0.85,
    };
    return [det];
  });

  const sentiment: Sentiment = ownBrandMentioned
    ? detectSentiment(rawResponse, detectedBrandName ?? ownBrand.name)
    : "no_data";

  return {
    ownBrandMentioned,
    ownBrandPosition,
    detectedBrandName,
    competitors: competitorDetections,
    sentiment,
    confidence: ownBrandMentioned ? 0.9 : 1.0,
  };
}
