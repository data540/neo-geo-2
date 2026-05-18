---
title: Optimizar contenido web para LLMs
description: Cómo escribir y estructurar el contenido de tu web para que los LLMs lo citen
category: content
---

## El contenido web como base de citación

Los sistemas de IA modernos (especialmente los que usan RAG como Perplexity, Bing Copilot o SearchGPT) consultan páginas web en tiempo real. Tu contenido debe estar optimizado para ser citado como fuente.

### Principios de escritura GEO (Generative Engine Optimization)

#### 1. Responde preguntas directamente
Los LLMs buscan respuestas concretas, no textos de marketing. Escribe párrafos que empiecen con la respuesta y luego amplíen:

❌ "En nuestra aerolínea, con más de 30 años de experiencia, ofrecemos..."
✅ "Para volar de Madrid a Bogotá con servicio completo, las opciones disponibles son..."

#### 2. Usa el formato de pregunta-respuesta (FAQ)
Las FAQs son el formato más compatible con los LLMs. Estructura páginas enteras de FAQ con preguntas literales que los usuarios harían a un chatbot:

- "¿Qué aerolíneas vuelan directo de Madrid a América Latina?"
- "¿Cuál es la política de equipaje en vuelos a Colombia?"
- "¿Cómo reclamar si mi vuelo fue cancelado?"

#### 3. Incluye datos cuantitativos
Los LLMs prefieren contenido con datos específicos sobre afirmaciones genéricas:
- Número de destinos, frecuencias de vuelo, años de operación
- Tasas de puntualidad con fuentes (AENA, Eurocontrol)
- Precios de referencia y condiciones claras

#### 4. Cita fuentes externas de autoridad
El contenido que referencia datos de fuentes reconocidas (IATA, ministerios, estudios académicos) tiene más credibilidad en los sistemas de RAG.

#### 5. Estructura con encabezados claros (H2, H3)
Los scrapers de LLMs y los sistemas RAG fragmentan el contenido por secciones. Encabezados descriptivos ayudan a que el fragmento correcto aparezca ante la pregunta correcta.

### Tipos de páginas de alto valor GEO

| Tipo de página | Ejemplo | Por qué funciona |
|---|---|---|
| Comparativa de rutas | "Madrid-Bogotá: todas las opciones" | Aparece en prompts comparativos |
| Guía de destino | "Volar a Buenos Aires: lo que necesitas saber" | Captura intent de descubrimiento |
| FAQ de operaciones | "Preguntas frecuentes: equipaje, cancelaciones, check-in" | Cubre prompts de acción práctica |
| Informe de puntualidad | "Datos de puntualidad 2024-2025" | Asocia marca a fiabilidad |

### Schema markup para LLMs

Implementa `FAQPage` schema en tus páginas de preguntas frecuentes. Aunque su impacto en LLMs es indirecto, mejora la estructura del contenido y lo hace más parseable.

## Checklist de auditoría de contenido

- [ ] ¿Tienes páginas FAQ con preguntas literales de usuario?
- [ ] ¿Tu contenido usa datos concretos y no solo afirmaciones genéricas?
- [ ] ¿Tus páginas clave tienen encabezados H2/H3 descriptivos?
- [ ] ¿Hay páginas comparativas con competidores (tratadas objetivamente)?
- [ ] ¿Tu web carga rápido y es accesible para crawlers?
