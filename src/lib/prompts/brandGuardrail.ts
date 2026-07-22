// Guardrail de marcas para la creación de prompts.
//
// Algunos workspaces tienen un plan que solo cubre la monitorización de SU
// marca propia, pero el cliente posee además otras marcas (marcas hermanas del
// grupo). Sin este guardrail podría usar la herramienta para trackear esas
// otras marcas creando prompts que las mencionen. La regla: en un workspace
// restringido, cualquier prompt cuyo texto mencione una marca competidora
// registrada (tabla `brands`, type='competitor') queda bloqueado. Solo pasan
// prompts genéricos o que mencionen la marca propia.
//
// Es un gate por slug (como el guardrail de país en `workspace-country.ts`) y
// la lista de marcas bloqueadas es data-driven: se deriva de los competidores
// del workspace, así que se ajusta editando la BD sin desplegar código.

import type { SupabaseClient } from "@supabase/supabase-js";
import { boundaryIncludes } from "@/lib/detection/brandMatch";

/** Workspaces (por slug) donde solo se permite trackear la marca propia. */
const BRAND_RESTRICTED_SLUGS = new Set(["foodbox"]);

export function isBrandRestrictedWorkspace(slug: string): boolean {
  return BRAND_RESTRICTED_SLUGS.has(slug);
}

export interface BlockedBrand {
  name: string;
  aliases: string[];
}

// Mitigación de falsos positivos: muchos competidores tienen nombres o aliases
// cortos/genéricos que matchearían dentro de prompts legítimos. Descartamos:
//   - términos de menos de MIN_TERM_LENGTH caracteres (p.ej. "Mc", "BK", "Le"),
//   - una lista de términos genéricos que son palabras comunes en español o
//     inglés (p.ej. "areas" ≈ "áreas", "wings", "ribs").
// El nombre propio completo de la marca ("Burger King", "McDonald's") sigue
// matcheando; solo se filtran los términos ambiguos. Afinar con datos reales.
const MIN_TERM_LENGTH = 4;
const GENERIC_TERMS = new Set([
  "areas",
  "wings",
  "ribs",
  "bold",
  "paul",
  "pans",
  "pomodoro",
  "vezzo",
  "comess",
  "bacoa",
  "exki",
]);

/**
 * Aplana una marca (name + aliases) en la lista de términos de matching,
 * descartando los ambiguos (cortos o genéricos). Devuelve términos en minúsculas.
 */
function matchTermsFor(brand: BlockedBrand): string[] {
  const raw = [brand.name, ...brand.aliases];
  const terms: string[] = [];
  for (const term of raw) {
    const normalized = term.trim().toLowerCase();
    if (normalized.length < MIN_TERM_LENGTH) continue;
    if (GENERIC_TERMS.has(normalized)) continue;
    terms.push(normalized);
  }
  return terms;
}

/**
 * Carga las marcas cuya mención se bloquea en un workspace: todos los
 * competidores registrados. Una sola query por operación.
 */
export async function loadBlockedBrands(
  // biome-ignore lint/suspicious/noExplicitAny: cliente supabase (server/service) sin genéricos
  supabase: SupabaseClient<any, any, any>,
  workspaceId: string
): Promise<BlockedBrand[]> {
  const { data } = await supabase
    .from("brands")
    .select("name, aliases")
    .eq("workspace_id", workspaceId)
    .eq("type", "competitor");

  return (data ?? []).map((b) => ({
    name: (b.name as string) ?? "",
    aliases: ((b.aliases as string[] | null) ?? []) as string[],
  }));
}

/**
 * Devuelve el nombre de la primera marca bloqueada mencionada en `text`
 * (respetando límites de palabra), o `null` si el texto no menciona ninguna.
 */
export function firstBlockedBrandInText(text: string, blocked: BlockedBrand[]): string | null {
  const haystack = text.toLowerCase();
  for (const brand of blocked) {
    for (const term of matchTermsFor(brand)) {
      if (boundaryIncludes(haystack, term)) return brand.name;
    }
  }
  return null;
}

export interface FilterResult {
  allowed: string[];
  blocked: { text: string; brand: string }[];
}

/**
 * Separa una lista de textos en permitidos y bloqueados. Para los caminos en
 * lote (import masivo, wizard GEO): se crean los permitidos y se informa de los
 * omitidos.
 */
export function filterBlockedTexts(texts: string[], blocked: BlockedBrand[]): FilterResult {
  const allowed: string[] = [];
  const blockedOut: { text: string; brand: string }[] = [];
  for (const text of texts) {
    const brand = firstBlockedBrandInText(text, blocked);
    if (brand) blockedOut.push({ text, brand });
    else allowed.push(text);
  }
  return { allowed, blocked: blockedOut };
}
