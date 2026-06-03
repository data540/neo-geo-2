// Deriva "Topic Sections" y "Content Structure" a partir del texto que genera
// el modelo "AI Overviews" (gemini). NO son datos de la SERP real de Google:
// es una aproximación basada en cómo el modelo estructura su respuesta.

export interface TopicSection {
  name: string;
  count: number;
}

export interface ContentBlockShare {
  type: ContentBlockType;
  pct: number;
}

export type ContentBlockType = "Text" | "List" | "Table" | "Heading" | "Code";

export interface AioContentSummary {
  topicSections: TopicSection[];
  contentStructure: ContentBlockShare[];
  blocksAnalyzed: number;
  responsesAnalyzed: number;
}

// Encabezado markdown: "## Título" / "### Título" (mismo patrón que el indexer KB),
// ampliado a # … ###### para tolerar variaciones del modelo.
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
// Línea íntegramente en negrita usada como título: "**Consejos clave:**".
const BOLD_TITLE_RE = /^\*\*(.+?)\*\*:?\s*$/;
// Item de lista cuyo primer token va en negrita: "- **Iberia:** ..." / "1. **Avianca**".
const BOLD_LIST_RE = /^(?:[-*+]|\d+[.)])\s+\*\*(.+?)\*\*:?/;
const LIST_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
const TABLE_RE = /\|/;
const CODE_FENCE_RE = /^\s*```/;

const MAX_SECTION_NAME_LEN = 60;
const TOP_SECTIONS = 8;

function cleanHeaderText(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/[:：]\s*$/, "")
    .replace(/`/g, "")
    .trim();
}

function extractSectionHeaders(response: string): string[] {
  const headers: string[] = [];
  let inCodeBlock = false;

  for (const line of response.split("\n")) {
    if (CODE_FENCE_RE.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const heading = line.match(HEADING_RE);
    if (heading?.[2]) {
      const name = cleanHeaderText(heading[2]);
      if (name && name.length <= MAX_SECTION_NAME_LEN) headers.push(name);
      continue;
    }

    const boldTitle = line.match(BOLD_TITLE_RE);
    if (boldTitle?.[1]) {
      const name = cleanHeaderText(boldTitle[1]);
      if (name && name.length <= MAX_SECTION_NAME_LEN) headers.push(name);
      continue;
    }

    const boldList = line.match(BOLD_LIST_RE);
    if (boldList?.[1]) {
      const name = cleanHeaderText(boldList[1]);
      if (name && name.length <= MAX_SECTION_NAME_LEN) headers.push(name);
    }
  }

  return headers;
}

function classifyLine(line: string, inCodeBlock: boolean): ContentBlockType | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  if (inCodeBlock) return "Code";
  if (HEADING_RE.test(line)) return "Heading";
  if (LIST_RE.test(line)) return "List";
  if (TABLE_RE.test(trimmed)) return "Table";
  return "Text";
}

// Cuenta "bloques": líneas no vacías clasificadas, agrupando líneas consecutivas
// del mismo tipo en un solo bloque (más cercano a la noción de bloque de contenido).
function countBlocks(response: string, tally: Map<ContentBlockType, number>): number {
  let blocks = 0;
  let prevType: ContentBlockType | null = null;
  let inCodeBlock = false;

  for (const line of response.split("\n")) {
    if (CODE_FENCE_RE.test(line)) {
      inCodeBlock = !inCodeBlock;
      tally.set("Code", (tally.get("Code") ?? 0) + (prevType === "Code" ? 0 : 1));
      if (prevType !== "Code") blocks += 1;
      prevType = "Code";
      continue;
    }

    const type = classifyLine(line, inCodeBlock);
    if (type === null) {
      prevType = null;
      continue;
    }
    if (type !== prevType) {
      tally.set(type, (tally.get(type) ?? 0) + 1);
      blocks += 1;
    }
    prevType = type;
  }

  return blocks;
}

export function parseAioContent(rawResponses: string[]): AioContentSummary {
  const responses = rawResponses.filter((r) => typeof r === "string" && r.trim().length > 0);

  const sectionCounts = new Map<string, number>();
  const blockTally = new Map<ContentBlockType, number>();
  let blocksAnalyzed = 0;

  for (const response of responses) {
    for (const header of extractSectionHeaders(response)) {
      sectionCounts.set(header, (sectionCounts.get(header) ?? 0) + 1);
    }
    blocksAnalyzed += countBlocks(response, blockTally);
  }

  const topicSections: TopicSection[] = Array.from(sectionCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TOP_SECTIONS);

  const totalBlocks = Array.from(blockTally.values()).reduce((s, v) => s + v, 0);
  const contentStructure: ContentBlockShare[] = Array.from(blockTally.entries())
    .map(([type, count]) => ({
      type,
      pct: totalBlocks > 0 ? Math.round((count / totalBlocks) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  return {
    topicSections,
    contentStructure,
    blocksAnalyzed,
    responsesAnalyzed: responses.length,
  };
}
