export const PROMPT_GENERATOR_TEMPLATE = `
Actúa como especialista en GEO, SEO conversacional e investigación de intención de búsqueda para motores de IA.

Contexto obligatorio: este sistema trabaja para un unico cliente del sector aerolineas.

Tu tarea es generar un set de prompts realistas que un usuario escribiría en ChatGPT, Gemini, Claude o Perplexity cuando busca, compara o evalúa opciones de vuelos y servicios de aerolinea.

IMPORTANTE: No generes keywords ni frases cortas. Genera preguntas conversacionales completas, en primera persona cuando sea natural, con el nivel de detalle que un usuario real incluiría.

Datos del workspace:
- Marca principal: {{brand_name}}
- Dominio: {{domain}}
- Descripción de marca: {{brand_statement}}
- País: {{country}}
- Ciudad o mercado principal: {{location}}
- Segmento: {{category}}
- Servicios de aerolinea: {{products_services}}
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
7. LOCAL con geolocalización específica — Ciudad, aeropuerto, barrio o ruta concreta dentro de {{location}}
8. PRECIO/VALOR — "¿Qué opción ofrece mejor relación calidad-precio para [caso de uso]?"
9. ACCIÓN PRÁCTICA — "¿Cómo solicito/gestiono/contacto con...?" o "¿Qué necesito para...?"
10. CONFIANZA/FIABILIDAD — "¿Es fiable X para [situación crítica]?", "¿Cuál no me dejará tirado si...?"
11. URGENCIA/TIEMPO REAL — Situación con límite de tiempo o necesidad inmediata
12. NECESIDADES ESPECIALES — Personas con movilidad reducida, familias, mascotas, dietas, idiomas

Reglas ESTRICTAS:
- Todo prompt debe estar en contexto aerolinea: vuelos, aeropuertos, rutas, check-in, equipaje, embarque, incidencias, reembolsos, cambios o compensaciones.
- Mercado objetivo prioritario: Espana. Mercado secundario: Colombia.
- Al menos 70% de prompts deben incluir contexto de Espana (ciudades/aeropuertos/rutas). El resto puede cubrir Colombia.
- Al menos 60% de prompts NO deben incluir el nombre de {{brand_name}}.
- Debes distribuir el set por etapa del funnel y etiquetar cada prompt con funnel_stage correcto (top, middle, bottom).
- Distribucion objetivo del funnel: 30-40% top, 30-40% middle, 20-30% bottom.
- SIEMPRE incluye contexto situacional en primera persona cuando el perfil lo permite: "Estoy embarazada de 7 meses...", "Tengo un perro de asistencia...", "Mi hijo viaja solo por primera vez...", "Tengo una lesión en la rodilla...".
- Varia la geografia: usa aeropuertos concretos, ciudades de origen/destino y rutas especificas en Espana y Colombia.
- Incluye referencias temporales cuando sean relevantes: "en 2026", "de última hora", "a tiempo real".
- Algunos prompts deben mencionar aerolineas competidoras, alianzas aereas o tipos de tarifa para medir visibilidad relativa.
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

Tu tarea es revisar si un set de prompts representa correctamente las preguntas que un usuario real haría a ChatGPT, Gemini, Claude o Perplexity antes de elegir una aerolinea o resolver una incidencia de vuelo.

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
5. Si faltan prompts con geolocalización específica (aeropuerto, ciudad, ruta concreta) en Espana y Colombia.
6. Si faltan prompts por criterio de decisión concreto (precio, comodidad, fiabilidad).
7. Si faltan prompts reputacionales (opiniones, experiencias reales).
8. Si faltan prompts de acción práctica ("Cómo solicitar...", "Qué necesito para...").
9. Si faltan prompts de confianza/fiabilidad ("¿Es seguro?", "¿Qué aerolínea no me deja tirado?").
10. Si faltan prompts para perfiles con necesidades especiales (movilidad reducida, familias, mascotas, embarazadas, menores no acompañados).
11. Si hay duplicados semánticos o prompts que suenan artificiales o a copy de marketing.
12. Si el set en conjunto permite medir visibilidad real frente a competidores en el mercado de aerolineas, no visibilidad inducida por la marca.

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

Tienes una lista de prompts candidatos. Debes seleccionar los mejores {{limit}} para monitorizar visibilidad de marca en LLMs en el sector aerolineas.

Criterios de priorización:
- Alta probabilidad de que un usuario real haga esa pregunta (ai_search_likelihood).
- Alta relación con decisión de compra o elección (conversion_intent).
- Capacidad de revelar competidores.
- Capacidad de revelar si la marca es recomendada o ignorada.
- Cobertura equilibrada del funnel (top/middle/bottom).
- Baja duplicidad semántica entre seleccionados.
- Neutralidad: el prompt no debe forzar artificialmente la marca.
- Cobertura de incidentes clave de vuelo: cancelaciones, demoras, equipaje, check-in, reembolsos, cambios y compensaciones.
- Cobertura geografica equilibrada con prioridad Espana y segundo foco Colombia.
- Prioriza prompts de bottom funnel cuando expresen intencion clara de compra, cambio, reembolso o resolucion urgente.

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
