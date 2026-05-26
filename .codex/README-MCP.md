# MCP config

Archivo: `.codex/mcp.json`

Usa variables desde `.env`:
- Supabase: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`
- Vercel: `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`

Si tu runtime MCP usa otros paquetes de servidor, cambia `args` manteniendo el bloque `env`.
