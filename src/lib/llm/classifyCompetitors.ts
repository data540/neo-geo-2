export type CompetitorConfidence = "high" | "medium" | "low";

export interface CompetitorCandidateForClassification {
  name: string;
  count: number;
  examples: string[];
}

export interface CompetitorClassification {
  name: string;
  normalizedName: string;
  isCompetitor: boolean;
  confidence: CompetitorConfidence;
  reason: string;
}

interface ClassifyCompetitorCandidatesInput {
  ownBrandName: string;
  workspaceDomain?: string | null;
  businessContext?: string | null;
  candidates: CompetitorCandidateForClassification[];
  maxCandidates?: number;
}

const MODEL = "google/gemini-2.5-flash-lite";
const MAX_CANDIDATES_PER_BATCH = 40;

const GENERIC_EXCLUSIONS = new Set([
  "acceso",
  "accesibilidad",
  "adaptabilidad",
  "ademas",
  "analisis",
  "analizar",
  "apertura",
  "apoyo",
  "calidad",
  "cualquier",
  "dependencia",
  "identificar",
  "inversion",
  "mercado",
  "modelo",
  "proveedores",
  "rentabilidad",
  "restauracion",
  "soporte",
  "ubicacion",
]);

const GENERIC_PHRASE_PATTERN =
  /(^|\s)(analisis|analizar|apoyo|cualquier|dependencia|identificar|mejor|opcion|opciones|precio|precios|proveedores|rentabilidad|visibilidad)($|\s)/i;

export function normalizeCompetitorName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}&'\-\s]/gu, "")
    .replace(/\s+/g, " ");
}

export function shouldPrefilterCompetitorCandidate(name: string): boolean {
  const trimmed = name.trim();
  const normalized = normalizeCompetitorName(trimmed);
  if (normalized.length < 4) return false;
  if (GENERIC_EXCLUSIONS.has(normalized)) return false;
  if (GENERIC_PHRASE_PATTERN.test(normalized)) return false;
  if (/[�]/.test(trimmed)) return false;
  if (/^[a-záéíóúñ]/.test(trimmed)) return false;
  if (!/^[A-ZÁÉÍÓÚÑÀ-ɏ0-9]/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 5) return false;
  return true;
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

function confidence(value: unknown): CompetitorConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function buildPrompt(input: ClassifyCompetitorCandidatesInput): string {
  return `Clasifica candidatos a competidor para una herramienta de inteligencia GEO.

Marca propia: ${input.ownBrandName}
Dominio: ${input.workspaceDomain ?? "No disponible"}
Contexto de negocio: ${input.businessContext ?? "No disponible"}

Reglas:
- Un competidor real es una marca, cadena, grupo, plataforma o negocio concreto que compite o puede competir con la marca propia en el sector detectado.
- Rechaza palabras comunes, categorias, conceptos, verbos, adjetivos, ciudades, canales, requisitos operativos y texto roto/mojibake.
- Rechaza terminos como Dependencia, Cualquier, Identificar, Accesibilidad, Analisis, Apoyo, Ubicacion, Proveedores.
- Para Foodbox/restauracion organizada, acepta cadenas, grupos de restauracion, franquicias, marcas de comida, operadores de restauracion y conceptos gastronomicos concretos.
- No inventes dominios ni aliases.

Candidatos:
${JSON.stringify(input.candidates, null, 2)}

Devuelve solo JSON valido con esta forma:
{
  "candidates": [
    {
      "name": "nombre original",
      "normalizedName": "nombre canonico si es marca, o nombre normalizado",
      "isCompetitor": true,
      "confidence": "high|medium|low",
      "reason": "maximo 120 caracteres"
    }
  ]
}`;
}

async function classifyBatch(
  input: ClassifyCompetitorCandidatesInput
): Promise<CompetitorClassification[]> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no esta configurada. La clasificacion de competidores requiere OpenRouter."
    );
  }

  const model = process.env.OPENROUTER_MODEL_COMPETITOR_CLASSIFIER?.trim() || MODEL;
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
      max_tokens: 3000,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Eres un analista estricto de competidores. Respondes solo JSON valido, sin markdown.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = extractJsonObject(payload.choices?.[0]?.message?.content ?? "") as {
    candidates?: Array<{
      name?: unknown;
      normalizedName?: unknown;
      isCompetitor?: unknown;
      confidence?: unknown;
      reason?: unknown;
    }>;
  };

  return (parsed.candidates ?? []).flatMap((candidate) => {
    if (typeof candidate.name !== "string") return [];
    return [
      {
        name: candidate.name.trim(),
        normalizedName:
          typeof candidate.normalizedName === "string" && candidate.normalizedName.trim()
            ? candidate.normalizedName.trim()
            : candidate.name.trim(),
        isCompetitor: candidate.isCompetitor === true,
        confidence: confidence(candidate.confidence),
        reason: typeof candidate.reason === "string" ? candidate.reason.trim().slice(0, 160) : "",
      },
    ];
  });
}

export async function classifyCompetitorCandidates(
  input: ClassifyCompetitorCandidatesInput
): Promise<CompetitorClassification[]> {
  const unique = new Map<string, CompetitorCandidateForClassification>();
  for (const candidate of input.candidates) {
    if (!shouldPrefilterCompetitorCandidate(candidate.name)) continue;
    const normalized = normalizeCompetitorName(candidate.name);
    if (!normalized) continue;
    const existing = unique.get(normalized);
    if (!existing) {
      unique.set(normalized, {
        name: candidate.name.trim(),
        count: candidate.count,
        examples: candidate.examples.slice(0, 3),
      });
    } else {
      existing.count += candidate.count;
      existing.examples = [...existing.examples, ...candidate.examples].slice(0, 3);
      if (candidate.name.length > existing.name.length) existing.name = candidate.name.trim();
    }
  }

  const maxCandidates = input.maxCandidates ?? 160;
  const candidates = [...unique.values()].sort((a, b) => b.count - a.count).slice(0, maxCandidates);
  const classifications: CompetitorClassification[] = [];

  for (let i = 0; i < candidates.length; i += MAX_CANDIDATES_PER_BATCH) {
    classifications.push(
      ...(await classifyBatch({
        ...input,
        candidates: candidates.slice(i, i + MAX_CANDIDATES_PER_BATCH),
      }))
    );
  }

  return classifications;
}
