# Brand Profile Extraction Prompt

Prompt reutilizable para extraer el perfil de inteligencia de negocio de cualquier marca a partir de su sitio web. Usado internamente por `src/lib/geo/extractBrandProfile.ts` y disponible para uso externo en ChatGPT, Claude Projects o cualquier LLM.

---

## Uso externo (ChatGPT / Claude / API)

1. Copia el **System Prompt** en el campo de instrucciones del sistema.
2. Obtén el contenido en texto plano del sitio web (p. ej. con [Jina Reader](https://r.jina.ai/https://tudominio.com)).
3. Pega el **User Prompt** sustituyendo `{{URL}}` y `{{CONTENT}}`.
4. El modelo devuelve un JSON listo para usar.

---

## System Prompt

```
Eres un analista senior de inteligencia de negocio.
Tu objetivo es entregar un perfil completo y usable para inteligencia GEO de una marca, a partir de contenido web e inferencias prudentes basadas en ese contenido.

Reglas:
- Analiza cualquier tipo de negocio o sector; infiere la industria desde el contenido real del sitio.
- Rellena todas las secciones con informacion explicita o inferencia prudente basada en el sitio.
- No inventes premios, partners, certificaciones ni tecnologias concretas que no aparezcan explicitamente.
- Si una seccion puede inferirse del modelo de negocio y los servicios publicados, rellenala de forma util.
- Responde unicamente JSON valido, sin markdown ni comentarios.
```

---

## User Prompt

```
Analiza la empresa de esta URL: {{URL}}

Contenido extraido:
{{CONTENT}}

Devuelve un JSON con exactamente esta estructura:
{
  "company": {
    "name": "string",
    "website": "string",
    "category": "string|null",
    "industry": "string|null",
    "geography": "string|null",
    "logoHint": "string|null"
  },
  "businessOverview": {
    "summary": "string",
    "valueProposition": "string|null"
  },
  "targetAudience": "string",
  "businessModelRevenue": {
    "pricingStrategy": "string|null",
    "revenueStreams": ["string"]
  },
  "productsServices": ["string"],
  "technologyPartnerships": {
    "technologyStack": ["string"],
    "keyPartnerships": ["string"]
  },
  "userExperienceContent": {
    "userExperience": "string|null",
    "contentStrategy": "string|null"
  },
  "socialProof": ["string"],
  "keyFeatures": ["string"],
  "analysisInfo": {
    "analyzedAt": "{{ISO_TIMESTAMP}}",
    "sourceUrl": "{{URL}}",
    "pagesAnalyzed": ["string"],
    "confidence": "high|medium|low"
  }
}

Reglas de redaccion:
- Escribe en espanol claro.
- Resume Business Overview en 80-120 palabras.
- Infiere el sector, industria y modelo de negocio desde el contenido del sitio.
- No dejes arrays vacios salvo que sea realmente imposible.
- No inventes premios, partners, certificaciones ni tecnologias concretas.
- valueProposition: 1 frase obligatoria.
- pricingStrategy: 1 parrafo breve obligatorio.
- revenueStreams: 3-6 items.
- Target Audience: describe tipos reales de clientes y sus necesidades.
- Products & Services: 8-12 items.
- Key Features: 6-10 items orientados a los diferenciadores reales de la marca.
- Social Proof: solo alianzas, premios o certificaciones que aparezcan en el contenido.
- Technology & Partnerships: no listes tecnologia si solo se infiere por ser una web moderna.
```

---

## Configuración recomendada

| Parámetro | Valor |
|-----------|-------|
| Modelo | `openai/gpt-4o` o `anthropic/claude-3-5-haiku` |
| Temperature | `0.2` |
| Max tokens | `2500` |

---

## Cómo obtener el contenido web

```bash
# Usando Jina Reader (devuelve markdown limpio de cualquier URL)
curl "https://r.jina.ai/https://www.tudominio.com"
```

Para un análisis más completo, repite para páginas relevantes como `/about`, `/products`, `/pricing` y concatena el contenido antes de pasarlo al prompt.
