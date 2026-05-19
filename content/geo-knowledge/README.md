---
title: Knowledge Base GEO
description: Carpeta destino para el vault de Obsidian con tips de GEO
---

# Knowledge Base GEO

Esta carpeta contiene la knowledge base usada por la feature **Recomendaciones GEO**.

## Cómo añadir notas

Copia (o sincroniza con symlink) los `.md` de tu vault de Obsidian aquí. La carpeta `.obsidian/` está en `.gitignore`.

## Cómo indexar

```bash
pnpm kb:index
```

Esto parsea los `.md`, los trocea por headings, genera embeddings con OpenAI y los upsertea en la tabla `knowledge_chunks` de Supabase. Es idempotente: solo procesa lo que ha cambiado.

## Estadísticas

```bash
pnpm kb:stats
```

## Variables de entorno requeridas

- `OPENAI_API_KEY_EMBEDDINGS` (o `OPENAI_API_KEY` como fallback)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
