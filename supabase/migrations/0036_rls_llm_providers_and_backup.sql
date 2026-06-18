-- Habilita RLS en las dos tablas que lo tenían desactivado (alerta de seguridad Supabase, jun 2026)

-- llm_providers: tabla de referencia de proveedores LLM.
-- Solo necesita lectura por usuarios autenticados; escritura solo vía service_role/migraciones.
ALTER TABLE public.llm_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "llm_providers_select_authenticated"
  ON public.llm_providers
  FOR SELECT
  TO authenticated
  USING (true);

-- _backup_prompt_runs_20260608: tabla de backup puntual creada el 08/06/2026.
-- No debe ser accesible vía API pública; service_role sigue pudiendo acceder.
ALTER TABLE public._backup_prompt_runs_20260608 ENABLE ROW LEVEL SECURITY;
