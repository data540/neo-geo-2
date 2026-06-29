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
  // Abstractos y estrategia
  "acceso", "accesibilidad", "adaptabilidad", "ademas", "analisis", "analizar",
  "apertura", "apoyo", "calidad", "cualquier", "dependencia", "diferenciacion",
  "eficiencia", "eficacia", "estrategia", "exito", "experiencia", "flexibilidad",
  "gestion", "identificar", "inversion", "liderazgo", "modelo", "oportunidad",
  "oportunidades", "perspectiva", "posicionamiento", "proceso", "rentabilidad",
  "sostenibilidad", "tendencia", "tendencias", "ventaja", "ventajas",
  // Entidades genéricas
  "empresa", "empresas", "grupo", "grupos", "marca", "marcas", "negocio",
  "negocios", "organizacion", "plataforma", "plataformas", "proveedor",
  "proveedores", "sector", "sectores", "sistema", "sistemas",
  // Productos y servicios genéricos
  "mercado", "mercados", "producto", "productos", "servicio", "servicios",
  "soporte", "restauracion", "ubicacion", "variedad",
  // Clientes y usuarios
  "cliente", "clientes", "consumidor", "consumidores", "usuario", "usuarios",
  // Precios y valor
  "coste", "costes", "precio", "precios", "valor", "valores",
  // Adjetivos frecuentes en LLM responses
  "mejor", "mejores", "principal", "principales", "nuevo", "nueva",
  "nuevos", "nuevas", "digital", "online", "local", "nacional",
  "internacional", "importante", "importantes",
  // Transaccionales
  "compra", "entrega", "pedido", "pedidos", "venta",
  // Categorías y tipos de comida (no son marcas)
  "pizza", "pizzas", "taco", "tacos", "hamburguesa", "hamburguesas",
  "ensalada", "ensaladas", "bocadillo", "bocadillos", "sandwich", "sandwiches",
  "pollo frito", "comida rapida", "comida saludable", "comida mexicana",
  "comida internacional", "comida casera", "comida asiatica", "comida italiana",
  "comida japonesa", "comida china", "comida tradicional", "tapas", "raciones",
  "postres", "helados", "cafe", "cafes", "te", "bebidas", "snacks", "menu",
  // Tipos de local / formato (no son marcas)
  "restaurante", "restaurantes", "pizzeria", "pizzerias", "hamburgueseria",
  "hamburgueserias", "cafeteria", "cafeterias", "panaderia", "panaderias",
  "pasteleria", "pastelerias", "heladeria", "heladerias", "cerveceria",
  "cervecerias", "bar", "bares", "taberna", "tabernas", "cantina", "cantinas",
  "catering", "food truck", "coffee shop", "bubble tea", "dark kitchen",
  "dark kitchens", "fast food", "fast casual", "casual dining", "fine dining",
  "franquicia", "franquicias", "cadena", "cadenas", "local", "locales",
  // Conceptos de sector de restauración
  "restauracion informal", "restauracion organizada", "restauracion saludable",
  "restauracion colectiva", "marcas establecidas", "modelos hibridos",
  "gastronomia", "hosteleria", "delivery", "take away", "comida para llevar",
]);

const GENERIC_PHRASE_PATTERN =
  /(^|\s)(analisis|analizar|apoyo|cualquier|dependencia|empresa|grupo\s+de|identificar|mercado\s+de|mejor|negocio\s+de|opcion|opciones|precio|precios|proveedores|rentabilidad|servicio\s+de|visibilidad)($|\s)/i;

// Frases compuestas que son categorías/conceptos, no marcas:
// "comida X", "restauracion X", "marcas X", "modelos X", "cocina X", "X saludable/informal/rapida/casera"
const GENERIC_COMPOSITE_PATTERN =
  /^(comida|cocina|restauracion|marcas|modelos|tipo|tipos|estilo|estilos|categoria|categorias|formato|formatos|concepto|conceptos)\s+\w+|\b(saludable|informal|rapida|casera|tradicional|gourmet|hibrido|hibridos|establecida|establecidas|organizada|colectiva)$/i;

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
  // Permite siglas de marca en mayúsculas de 2-3 caracteres (KFC, BK, TGB);
  // el resto exige al menos 4 caracteres para evitar ruido.
  const isAcronym = /^[A-Z0-9][A-Z0-9&.\-]{1,2}$/.test(trimmed);
  if (normalized.length < 4 && !isAcronym) return false;
  if (GENERIC_EXCLUSIONS.has(normalized)) return false;
  if (GENERIC_PHRASE_PATTERN.test(normalized)) return false;
  if (GENERIC_COMPOSITE_PATTERN.test(normalized)) return false;
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

/**
 * Criterio único de aceptación de un competidor: debe ser marca real con
 * confianza ALTA. Estricto a propósito — todo lo demás va a la cola de
 * sugerencias para revisión humana, nunca directo a la lista.
 */
export function isAcceptedCompetitor(c: CompetitorClassification): boolean {
  return c.isCompetitor && c.confidence === "high";
}

function buildPrompt(input: ClassifyCompetitorCandidatesInput): string {
  return `Clasifica si cada candidato es un competidor real para la siguiente marca.

Marca propia: ${input.ownBrandName}
Dominio: ${input.workspaceDomain ?? "No disponible"}
Contexto de negocio: ${input.businessContext ?? "No disponible"}

ACEPTA (isCompetitor=true, confidence high/medium):
- Nombres propios de marcas, cadenas, grupos empresariales o plataformas que operan en el mismo sector.
- Empresas o productos concretos e identificables (tienen dominio web propio o presencia conocida).

RECHAZA sin excepcion (isCompetitor=false):
- Palabras comunes, categorias de producto, conceptos abstractos, adjetivos, verbos o frases genericas.
- Ciudades, paises, regiones o zonas geograficas.
- Terminos de sector o industria ("restauracion", "aviacion", "banca", etc.).
- Canales de venta ("online", "ecommerce", "marketplace").
- Requisitos operativos, caracteristicas o atributos ("calidad", "precio", "flexibilidad").
- Texto roto, codigos o caracteres extraños.
- Cualquier string que NO sea el nombre propio de una empresa o marca identificable.

Candidatos:
${JSON.stringify(input.candidates, null, 2)}

Devuelve solo JSON valido con esta forma:
{
  "candidates": [
    {
      "name": "nombre original",
      "normalizedName": "nombre canonico de la marca (marca registrada o nombre mas conocido)",
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
