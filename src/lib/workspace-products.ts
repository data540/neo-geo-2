/**
 * Productos por workspace: agrupan los prompts según palabras clave de su texto.
 *
 * Un prompt pertenece a un producto si su texto coincide (sin distinguir
 * mayúsculas) con `pattern`. El patrón se evalúa igual en Postgres (`~*`) y en
 * JavaScript (`new RegExp(pattern, "i")`), así que solo debe usar alternancias
 * simples de texto literal. Los prompts nuevos se clasifican solos.
 *
 * El parámetro `?product=<key>` de la URL selecciona el producto; un valor que
 * no existe para el workspace se ignora, por lo que nunca llega a SQL un patrón
 * que no esté definido aquí.
 */

export interface WorkspaceProduct {
  key: string;
  label: string;
  pattern: string;
}

const WORKSPACE_PRODUCTS: Record<string, WorkspaceProduct[]> = {
  ocaso: [
    // "deceso" cubre "seguro de decesos", "seguros de decesos" y "aseguradoras de decesos".
    { key: "decesos", label: "Seguro de decesos", pattern: "deceso|funeral" },
    // "hogar" cubre "seguro de hogar", "multirriesgo de hogar" y "aseguradoras de hogar".
    { key: "hogar", label: "Seguro de hogar", pattern: "hogar" },
  ],
};

export function getWorkspaceProducts(slug: string): WorkspaceProduct[] {
  return WORKSPACE_PRODUCTS[slug] ?? [];
}

export function resolveWorkspaceProduct(
  slug: string,
  requestedProduct?: string | null
): WorkspaceProduct | null {
  if (!requestedProduct) return null;
  return getWorkspaceProducts(slug).find((p) => p.key === requestedProduct) ?? null;
}

export function promptMatchesProduct(text: string, product: WorkspaceProduct): boolean {
  return new RegExp(product.pattern, "i").test(text);
}

/** Nº de prompts por producto; la clave "all" cuenta todos. */
export function countPromptsByProduct(
  texts: string[],
  products: WorkspaceProduct[]
): Record<string, number> {
  const counts: Record<string, number> = { all: texts.length };
  for (const product of products) {
    counts[product.key] = texts.filter((t) => promptMatchesProduct(t, product)).length;
  }
  return counts;
}
