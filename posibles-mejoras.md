# Posibles mejoras y plan de acción

Documento para recopilar ideas de mejora que se pueden tratar en futuras iteraciones del producto.

## Backlog inicial

- Añadir la posibilidad de subida masiva de prompts en CSV, Excel o texto plano.
- Añadir scroll/paginación en la tabla de prompts para mostrar inicialmente los 25 primeros registros y ofrecer una opción de `Show more`.
- Añadir la posibilidad de eliminar un workspace.
- Mostrar en la tabla `Prompts` qué LLMs se usaron para cada consulta.
- Añadir automáticamente `Competitors` a medida que aparezcan en los prompts o en las respuestas analizadas.
- Añadir la posibilidad de dar acceso a teams mediante el correo de colaboradores.

## Notas para futura priorización

- Separar mejoras de gestión de prompts, gestión de workspace, analítica competitiva y colaboración por equipos.
- Revisar dependencias de base de datos antes de implementar eliminación de workspace o gestión de teams.
- Definir si la detección automática de competidores debe hacerse desde el texto del prompt, desde la respuesta del LLM o desde ambos.
