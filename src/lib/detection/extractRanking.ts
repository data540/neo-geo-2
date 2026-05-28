interface BrandInput {
  id: string;
  name: string;
  aliases: string[];
}

export type ListSource = "numbered_list" | "bullet_list";

export interface RankingMatch {
  brandId: string;
  matchedName: string;
  rank: number;
  source: ListSource;
}

interface ListItem {
  rank: number;
  content: string;
  marker: "numbered" | "bullet";
  lineIdx: number;
}

const NUMBERED_LINE = /^\s*(\d{1,3})[.):\-]\s+(.*)$/;
const BULLET_LINE = /^\s*[-*•·]\s+(.*)$/;

function fuzzyIncludes(haystack: string, needle: string, threshold = 0.85): boolean {
  if (haystack.includes(needle)) return true;
  if (needle.length < 4) return false;
  // ventana deslizante de longitud needle.length sobre haystack
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    const window = haystack.slice(i, i + needle.length);
    let matches = 0;
    for (let j = 0; j < needle.length; j++) {
      if (window[j] === needle[j]) matches++;
    }
    if (matches / needle.length >= threshold) return true;
  }
  return false;
}

function parseListItems(rawResponse: string): {
  numbered: ListItem[];
  bullets: ListItem[];
} {
  const lines = rawResponse.split(/\r?\n/);
  const numbered: ListItem[] = [];
  const bullets: ListItem[] = [];
  let bulletCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const numMatch = line.match(NUMBERED_LINE);
    if (numMatch) {
      const rank = Number.parseInt(numMatch[1] ?? "0", 10);
      const content = numMatch[2]?.trim() ?? "";
      if (rank >= 1 && rank <= 50 && content.length > 0) {
        numbered.push({ rank, content, marker: "numbered", lineIdx: i });
        continue;
      }
    }
    const bulMatch = line.match(BULLET_LINE);
    if (bulMatch) {
      const content = bulMatch[1]?.trim() ?? "";
      if (content.length > 0) {
        bulletCounter += 1;
        bullets.push({ rank: bulletCounter, content, marker: "bullet", lineIdx: i });
      }
    }
  }

  return { numbered, bullets };
}

function matchBrandInItem(
  itemContent: string,
  brand: BrandInput
): { matchedName: string } | null {
  const lower = itemContent.toLowerCase();
  const allNames = [brand.name, ...brand.aliases];
  for (const name of allNames) {
    const nameLower = name.toLowerCase();
    if (lower.includes(nameLower)) return { matchedName: name };
    if (nameLower.length >= 4 && fuzzyIncludes(lower, nameLower)) {
      return { matchedName: name };
    }
  }
  return null;
}

function buildMatches(
  items: ListItem[],
  brands: BrandInput[],
  source: ListSource
): Map<string, RankingMatch> {
  const result = new Map<string, RankingMatch>();
  for (const item of items) {
    for (const brand of brands) {
      if (result.has(brand.id)) continue;
      const match = matchBrandInItem(item.content, brand);
      if (match) {
        result.set(brand.id, {
          brandId: brand.id,
          matchedName: match.matchedName,
          rank: item.rank,
          source,
        });
      }
    }
  }
  return result;
}

export function extractRankingFromList(
  rawResponse: string,
  brands: BrandInput[]
): Map<string, RankingMatch> {
  if (!rawResponse || brands.length === 0) return new Map();

  const { numbered, bullets } = parseListItems(rawResponse);

  // Preferencia: listas numeradas (más explícitas) sobre bullets
  if (numbered.length >= 2) {
    const matches = buildMatches(numbered, brands, "numbered_list");
    if (matches.size >= 1) return matches;
  }
  if (bullets.length >= 2) {
    const matches = buildMatches(bullets, brands, "bullet_list");
    if (matches.size >= 1) return matches;
  }

  return new Map();
}
