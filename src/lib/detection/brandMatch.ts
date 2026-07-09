// Matching de nombres de marca con límites de palabra (Unicode).
//
// Motivo: la detección original usaba `String.indexOf` / `.includes` puro, de
// modo que un nombre corto que es prefijo de otro más largo hacía match dentro
// de él. Ejemplo real (workspace air-europa): el brand "Iber" matcheaba dentro
// de "Iberia" y AMBOS se contaban como menciones en el mismo prompt_run,
// inflando el market share con un competidor fantasma. Igual ocurría con
// "Iberia" ⊂ "Iberia Express".
//
// La regla de límite de palabra exige que el carácter inmediatamente anterior y
// posterior al match NO sean letra/dígito. Así "iber" ya no matchea dentro de
// "iberia" (le sigue "i"), pero "iberia" sí matchea en "iberia express" (le
// sigue un espacio), que es el comportamiento correcto.

const WORD_CHAR = /[\p{Letter}\p{Number}]/u;

export function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

/**
 * Índice de la primera aparición de `needle` dentro de `haystack` (ambos ya en
 * minúsculas) delimitada por límites de palabra. Devuelve -1 si no existe.
 */
export function boundaryIndexOf(haystack: string, needle: string): number {
  if (!needle) return -1;
  let from = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) return -1;
    const before = idx > 0 ? haystack[idx - 1] : undefined;
    const after = haystack[idx + needle.length];
    if (!isWordChar(before) && !isWordChar(after)) return idx;
    from = idx + 1;
  }
  return -1;
}

/** ¿Aparece `needle` en `haystack` respetando límites de palabra? */
export function boundaryIncludes(haystack: string, needle: string): boolean {
  return boundaryIndexOf(haystack, needle) >= 0;
}
