// Cuotas de uso de LLMs para búsquedas en España
// Fuentes: AIMC oct-dic 2025, CNMC Q2-2025, Funcas dic 2025, ONTSI 2024
// chatgpt 58.5% · gemini 22.5% · perplexity ~5% (search especializado)
export const SPAIN_SEARCH_WEIGHTS: Record<string, number> = {
  chatgpt: 58.5,
  gemini: 22.5,
  perplexity: 5.0,
};
