const AIRLINE_KEYWORDS = [
  "aerolinea",
  "aerolínea",
  "vuelo",
  "vuelos",
  "aeropuerto",
  "ruta",
  "embarque",
  "check-in",
  "check in",
  "equipaje",
  "maleta",
  "cancel",
  "demora",
  "reembolso",
  "reubic",
  "compens",
  "tarifa",
  "pasajero",
  "boarding",
];

const ALLOWED_COUNTRIES = new Set(["ES", "CO"]);

export function isAllowedAirlineCountry(country: string): boolean {
  return ALLOWED_COUNTRIES.has((country || "").toUpperCase());
}

export function isAirlinePromptText(text: string): boolean {
  const normalized = (text || "").toLowerCase();
  return AIRLINE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function findNonAirlinePrompts(prompts: string[]): string[] {
  return prompts.filter((prompt) => !isAirlinePromptText(prompt));
}
