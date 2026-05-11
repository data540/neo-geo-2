export const PROMPT_GENERATOR_TEMPLATE = `
Actúa como especialista en GEO, SEO conversacional e investigación de intención de búsqueda para motores de IA.

Tu tarea es generar un set de prompts realistas que un usuario podría escribir en ChatGPT, Gemini, Claude o Perplexity cuando está buscando, comparando o evaluando marcas dentro de una categoría.

No generes keywords. Genera preguntas conversacionales completas, naturales y específicas.

Datos del workspace:
- Marca principal: {{brand_name}}
- Dominio: {{domain}}
- Descripción de marca: {{brand_statement}}
- País: {{country}}
- Ciudad o mercado principal: {{location}}
- Categoría: {{category}}
- Servicios/productos: {{products_services}}
- Audiencia objetivo: {{target_audience}}
- Competidores conocidos: {{competitors}}
- Diferenciadores de la marca: {{differentiators}}

Tipos de prompts que DEBES cubrir (distribuye equitativamente):
1. Descubrimiento genérico sin marca (discovery)
2. Comparación entre opciones (comparison)
3. Preguntas por criterio de decisión (decision)
4. Preguntas reputacionales (reputation)
5. Preguntas con marca (branded)
6. Preguntas por especialidad o servicio (product_specific)
7. Preguntas por ubicación (local)
8. Preguntas de precio/valor (price)
9. Preguntas de empleabilidad/salidas (employability)
10. Preguntas formuladas por diferentes perfiles (padres, jóvenes, profesionales)

Reglas estrictas:
- La mayoría de prompts (al menos 60%) NO deben incluir la marca principal.
- Los prompts deben sonar naturales, como preguntas reales de usuario.
- Evita prompts artificiales o escritos como keywords.
- Incluye contexto personal cuando sea útil ("Tengo 18 años...", "Soy padre...", etc.).
- No favorezcas artificialmente a la marca principal.
- No generes preguntas duplicadas semánticamente.
- Prioriza prompts con valor comercial o estratégico.
- Varía el estilo: algunas preguntas directas, otras con contexto, otras comparativas.

Devuelve ÚNICAMENTE un JSON array válido con exactamente {{number_of_prompts}} objetos, sin texto adicional:

[
  {
    "prompt": "pregunta conversacional completa",
    "intent": "discovery|comparison|reputation|branded|decision|local|price|employability|product_specific",
    "funnel_stage": "top|middle|bottom",
    "persona": "descripción del perfil de usuario que haría esta pregunta",
    "country": "código ISO de 2 letras",
    "language": "es",
    "includes_brand": false,
    "includes_competitor": false,
    "strategic_value": 8,
    "conversion_intent": 7,
    "ai_search_likelihood": 9,
    "priority_score": 75,
    "tags": ["tag1", "tag2"],
    "reason": "Por qué este prompt es importante para monitorizar visibilidad GEO"
  }
]
`.trim();

export const COVERAGE_AUDITOR_TEMPLATE = `
Actúa como auditor de cobertura de prompts GEO para una plataforma de AI Visibility.

Tu tarea es revisar si un set de prompts representa correctamente las preguntas habituales que un usuario haría a un motor de IA antes de elegir una marca, producto o servicio.

Datos:
- Marca: {{brand_name}}
- Categoría: {{category}}
- País: {{country}}
- Audiencia: {{target_audience}}
- Competidores: {{competitors}}
- Prompts generados: {{prompts_json}}

Evalúa estos 10 aspectos:
1. Si hay demasiados prompts con marca (>40% está mal).
2. Si faltan prompts genéricos sin marca.
3. Si faltan prompts comparativos.
4. Si faltan prompts de intención comercial alta.
5. Si faltan prompts locales.
6. Si faltan prompts por criterio de decisión.
7. Si faltan prompts reputacionales.
8. Si hay duplicados semánticos.
9. Si los prompts suenan naturales.
10. Si el set permite medir visibilidad real, no visibilidad inducida.

Devuelve ÚNICAMENTE un JSON válido sin texto adicional:

{
  "coverageScore": 75,
  "mainGaps": ["lista de huecos principales encontrados"],
  "duplicatedOrWeakPrompts": ["prompts con problemas"],
  "recommendedNewPrompts": ["nuevas preguntas para cubrir huecos"],
  "promptsToRemove": ["prompts a eliminar por ser débiles"],
  "finalRecommendation": "recomendación concisa sobre la calidad del set"
}
`.trim();

export const PROMPT_PRIORITIZER_TEMPLATE = `
Actúa como priorizador de prompts para una plataforma de AI Visibility.

Tienes una lista de prompts candidatos. Debes seleccionar los mejores {{limit}} para monitorizar visibilidad de marca en LLMs.

Criterios de priorización:
- Alta probabilidad de que un usuario real haga esa pregunta (ai_search_likelihood).
- Alta relación con decisión de compra o elección (conversion_intent).
- Capacidad de revelar competidores.
- Capacidad de revelar si la marca es recomendada o ignorada.
- Cobertura equilibrada del funnel (top/middle/bottom).
- Baja duplicidad semántica entre seleccionados.
- Neutralidad: el prompt no debe forzar artificialmente la marca.

Prompts candidatos: {{candidates_json}}

Devuelve ÚNICAMENTE un JSON array válido sin texto adicional con exactamente {{limit}} elementos:

[
  {
    "prompt": "texto exacto del prompt tal como aparece en candidatos",
    "priorityRank": 1,
    "whySelected": "razón concisa de por qué es prioritario",
    "coverageArea": "área de cobertura que cubre",
    "riskIfBrandAbsent": "low|medium|high"
  }
]
`.trim();
