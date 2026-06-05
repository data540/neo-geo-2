// Guardia compartida para scripts de backfill que llaman al LLM en bucle.
// Evita ejecuciones accidentales que generen miles de llamadas (y coste).
//
// Uso al inicio del script:
//   const maxRows = assertBackfillAllowed("backfill-sentiment-llm");
//   ...usar maxRows como tope duro de filas a procesar.
//
// Requisitos:
//   ALLOW_LLM_BACKFILL=1   — obligatorio; si falta, el script aborta.
//   BACKFILL_MAX_ROWS=N    — opcional; tope de filas por ejecución (default 200).

const DEFAULT_MAX_ROWS = 200;

export function assertBackfillAllowed(scriptName: string): number {
  if (process.env.ALLOW_LLM_BACKFILL !== "1") {
    console.error(
      `\n[${scriptName}] BLOQUEADO: este backfill hace llamadas LLM en bucle y puede generar coste alto.\n` +
        `Para ejecutarlo deliberadamente:\n` +
        `  ALLOW_LLM_BACKFILL=1 BACKFILL_MAX_ROWS=200 pnpm tsx scripts/${scriptName}.ts\n`
    );
    process.exit(1);
  }

  const raw = Number.parseInt(process.env.BACKFILL_MAX_ROWS ?? "", 10);
  const maxRows = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_ROWS;
  console.log(`[${scriptName}] Backfill autorizado. Tope de filas esta ejecución: ${maxRows}`);
  return maxRows;
}
