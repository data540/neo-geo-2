export const PROMPT_GENERATOR_TEMPLATE = `
Actúa como especialista en GEO, SEO conversacional e investigación de intención de búsqueda para motores de IA.

Tu tarea es generar un set de prompts realistas que un usuario escribiría en ChatGPT, Gemini, Claude o Perplexity cuando busca, compara o evalúa productos y servicios de la marca.

IMPORTANTE: No generes keywords ni frases cortas. Genera preguntas conversacionales completas, en primera persona cuando sea natural, con el nivel de detalle que un usuario real incluiría.

Datos del workspace:
- Marca principal: {{brand_name}}
- Dominio: {{domain}}
- Descripción de marca: {{brand_statement}}
- País: {{country}}
- Ciudad o mercado principal: {{location}}
- Segmento: {{category}}
- Productos y servicios: {{products_services}}
- Audiencia objetivo: {{target_audience}}
- Competidores conocidos: {{competitors}}
- Diferenciadores de la marca: {{differentiators}}

Tipos de prompts que DEBES cubrir (al menos 1 de cada tipo):
1. DESCUBRIMIENTO sin marca — "¿Qué opciones hay para X en {{location}}?"
2. COMPARACIÓN — "Comparativa entre las principales opciones de {{category}} en {{country}}"
3. DECISIÓN con criterio específico — "Necesito X, ¿qué opción me da más facilidades en {{location}}?"
4. REPUTACIÓN/OPINIONES — "Opiniones reales sobre [marca/servicio] en {{country}}"
5. CON MARCA — "¿Vale la pena [servicio específico] de {{brand_name}}?"
6. ESPECIALIDAD/SERVICIO — Pregunta sobre una característica concreta del servicio o producto
7. LOCAL con geolocalización específica — Ciudad, barrio o mercado concreto dentro de {{location}}
8. PRECIO/VALOR — "¿Qué opción ofrece mejor relación calidad-precio para [caso de uso]?"
9. ACCIÓN PRÁCTICA — "¿Cómo solicito/gestiono/contacto con...?" o "¿Qué necesito para...?"
10. CONFIANZA/FIABILIDAD — "¿Es fiable X para [situación crítica]?", "¿Cuál no me fallará si...?"
11. URGENCIA/TIEMPO REAL — Situación con límite de tiempo o necesidad inmediata
12. NECESIDADES ESPECIALES — Perfiles concretos: familias, autónomos, empresas, usuarios técnicos

Reglas ESTRICTAS:
- Los prompts deben encajar en el contexto del sector y productos de {{brand_name}}.
- Al menos 60% de prompts NO deben incluir el nombre de {{brand_name}}.
- Debes distribuir el set por etapa del funnel y etiquetar cada prompt con funnel_stage correcto (top, middle, bottom).
- Distribución objetivo del funnel: 30-40% top, 30-40% middle, 20-30% bottom.
- Adapta los prompts al mercado y país indicado ({{country}}, {{location}}).
- Incluye referencias temporales cuando sean relevantes: "en 2026", "actualmente", "en este momento".
- Algunos prompts deben mencionar competidores o alternativas para medir visibilidad relativa.
- Varía el estilo: preguntas directas, con contexto personal, comparativas, prácticas ("Cómo..."), valorativas ("¿Vale la pena...?").
- No generes preguntas duplicadas semánticamente.
- No uses frases genéricas de marketing; los prompts deben reflejar dudas reales, no comunicados de prensa.

Devuelve ÚNICAMENTE un JSON array válido con exactamente {{number_of_prompts}} objetos, sin texto adicional:

[
  {
    "prompt": "pregunta conversacional completa tal como la escribiría un usuario real",
    "intent": "discovery|comparison|reputation|branded|decision|local|price|employability|product_specific",
    "funnel_stage": "top|middle|bottom",
    "persona": "perfil específico: quién hace esta pregunta, en qué situación, qué necesidad tiene",
    "country": "código ISO de 2 letras",
    "language": "es",
    "includes_brand": false,
    "includes_competitor": false,
    "strategic_value": 8,
    "conversion_intent": 7,
    "ai_search_likelihood": 9,
    "priority_score": 75,
    "tags": ["tag1", "tag2"],
    "reason": "Por qué este prompt es estratégico para monitorizar la visibilidad GEO de {{brand_name}}"
  }
]
`.trim();

export const COVERAGE_AUDITOR_TEMPLATE = `
Actúa como auditor de cobertura de prompts GEO para una plataforma de AI Visibility.

Tu tarea es revisar si un set de prompts representa correctamente las preguntas que un usuario real haría a ChatGPT, Gemini, Claude o Perplexity antes de elegir un producto o servicio, o resolver una duda sobre la marca.

Datos:
- Marca: {{brand_name}}
- Categoría: {{category}}
- País: {{country}}
- Audiencia: {{target_audience}}
- Competidores: {{competitors}}
- Prompts generados: {{prompts_json}}

Evalúa estos 12 aspectos:
1. Si hay demasiados prompts con marca (>40% está mal — debe ser al mínimo posible).
2. Si faltan prompts genéricos sin marca (descubrimiento puro).
3. Si faltan prompts comparativos entre competidores.
4. Si faltan prompts de intención comercial alta (decision, bottom funnel).
5. Si faltan prompts con geolocalización específica (ciudad, mercado o región concreta).
6. Si faltan prompts por criterio de decisión concreto (precio, calidad, fiabilidad).
7. Si faltan prompts reputacionales (opiniones, experiencias reales).
8. Si faltan prompts de acción práctica ("Cómo solicitar...", "Qué necesito para...").
9. Si faltan prompts de confianza/fiabilidad ("¿Es fiable X?", "¿Cuál no me fallará si...?").
10. Si faltan prompts para perfiles con necesidades específicas según la audiencia objetivo.
11. Si hay duplicados semánticos o prompts que suenan artificiales o a copy de marketing.
12. Si el set en conjunto permite medir visibilidad real frente a competidores en el mercado, no visibilidad inducida por la marca.

Devuelve ÚNICAMENTE un JSON válido sin texto adicional:

{
  "coverageScore": 75,
  "mainGaps": ["lista de huecos principales encontrados"],
  "duplicatedOrWeakPrompts": ["prompts con problemas"],
  "recommendedNewPrompts": ["nuevas preguntas conversacionales completas para cubrir huecos"],
  "promptsToRemove": ["prompts a eliminar por ser débiles o artificiales"],
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
- Cobertura de los principales casos de uso y puntos de dolor del sector.
- Cobertura geográfica equilibrada según el mercado principal.
- Prioriza prompts de bottom funnel cuando expresen intención clara de compra o resolución urgente.

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
