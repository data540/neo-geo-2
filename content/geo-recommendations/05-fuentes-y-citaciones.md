---
title: Fuentes y citaciones en LLMs
description: Cómo conseguir que los LLMs con búsqueda web (Perplexity, SearchGPT) citen tu dominio
category: sources
---

## Dos tipos de LLMs: con y sin acceso a web

**LLMs de conocimiento estático** (ChatGPT sin plugins, Claude): responden desde su entrenamiento. Tu presencia depende de lo que estaba publicado antes de su fecha de corte.

**LLMs con RAG / búsqueda web** (Perplexity, Bing Copilot, SearchGPT, Gemini con búsqueda): consultan webs en tiempo real antes de responder. Aquí tu web puede ser citada directamente como fuente.

Esta sección se enfoca en los segundos, donde la citación es medible y accionable.

## Qué determina si tu web es citada

### 1. Relevancia semántica del contenido
El sistema RAG busca páginas cuyo contenido responde directamente a la pregunta del usuario. Una página de FAQ que responde exactamente "¿Qué aerolíneas vuelan directo de Madrid a Bogotá?" tiene alta probabilidad de ser citada ante esa consulta.

### 2. Autoridad del dominio
Los sistemas RAG filtran por autoridad antes de citar. Un dominio con buena presencia en el ecosistema web (backlinks, menciones, antigüedad) tiene más probabilidades de entrar en el conjunto de fuentes.

### 3. Velocidad de carga y accesibilidad del contenido
Si tu página tarda más de 3 segundos en cargar o bloquea scrapers con JavaScript excesivo, el sistema RAG no puede acceder al contenido.

### 4. Recencia del contenido
Los sistemas RAG priorizan contenido actualizado. Una página actualizada en los últimos 30 días tiene ventaja sobre una que lleva 2 años sin cambios.

### 5. Estructura clara del texto
El fragmento citado generalmente es un párrafo o lista de 50-200 palabras. Estructura tu contenido en bloques autónomos que tengan sentido fuera de contexto.

## Estrategia para maximizar citaciones

### Publica landing pages por cada consulta relevante
En lugar de una sola página de "Rutas", crea páginas específicas:
- `/vuelos-madrid-bogota` con toda la información sobre esa ruta
- `/politica-equipaje-vuelos-internacionales` con las reglas detalladas
- `/compensacion-vuelo-cancelado-derechos-pasajeros` para consultas de incidencias

Cada página está optimizada para ser la mejor respuesta a una consulta específica.

### Crea contenido de autoridad con datos únicos
Los LLMs con RAG citan especialmente contenido con datos que no están en otro sitio:
- Informes propios de puntualidad
- Estadísticas de satisfacción del cliente con metodología explicada
- Guías detalladas de procedimientos (check-in, reclamaciones)

### Implementa robots.txt permisivo para LLMs
Algunos sistemas RAG respetan `robots.txt`. Asegúrate de no bloquear accidentalmente los bots de:
- GPTBot (OpenAI)
- Google-Extended (Google para entrenar modelos)
- PerplexityBot (Perplexity)
- anthropic-ai (Anthropic)

### Monitoriza qué páginas tuyas son citadas
Usa esta misma plataforma: la sección **Sources** registra cada URL citada por los LLMs en respuesta a tus prompts monitorizados. Analiza:
- ¿Qué páginas son citadas más frecuentemente?
- ¿Qué páginas esperarías que fueran citadas pero no lo son?
- ¿Te citan competidores en respuestas donde tú no apareces?

## Métricas objetivo

- **≥ 1 citación de tu dominio por cada 10 prompts ejecutados**
- **Dominio propio entre los 3 primeros resultados** en prompts bottom-funnel
- **0 citaciones de competidores sin que tú también aparezcas** en prompts branded
