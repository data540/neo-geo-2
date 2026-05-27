const PROMPT_HEADER_TOKENS = new Set([
  "prompt",
  "prompts",
  "pregunta",
  "preguntas",
  "question",
  "questions",
  "texto",
  "text",
  "contenido",
  "content",
  "mensaje",
  "mensajes",
  "query",
  "consulta",
]);

function normalizeHeaderToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/["'`]/g, "");
}

function isHeaderLikeLine(value: string): boolean {
  const normalized = normalizeHeaderToken(value);
  return PROMPT_HEADER_TOKENS.has(normalized);
}

export function isHeaderLikeRow(values: string[]): boolean {
  const meaningful = values.map((value) => value.trim()).filter(Boolean);
  if (meaningful.length === 0) return false;
  return meaningful.every((value) => isHeaderLikeLine(value));
}

export function splitPromptLines(text: string): string[] {
  const hasRealLineBreak = /[\r\n\u2028\u2029]/u.test(text);
  const normalizedText = hasRealLineBreak
    ? text.replace(/\r\n|\r|\u2028|\u2029/gu, "\n")
    : text.replace(/\\r\\n|\\n|\\r/g, "\n");

  const lines = normalizedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstLine = lines[0];
  if (typeof firstLine === "string" && isHeaderLikeLine(firstLine)) {
    return lines.slice(1);
  }

  return lines;
}
