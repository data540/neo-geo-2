// ── helpers de argumentos compartidos por las tools MCP ──────────────────────
export function num(args: Record<string, unknown>, key: string, def: number): number {
  const v = args[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return def;
}

export function str(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function bool(args: Record<string, unknown>, key: string): boolean {
  const v = args[key];
  return v === true || v === "true";
}

/** Array de strings no vacíos, deduplicado y recortado. */
export function strList(args: Record<string, unknown>, key: string): string[] {
  const v = args[key];
  if (!Array.isArray(v)) return [];
  return Array.from(
    new Set(
      v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );
}

export function rpcOrThrow<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
