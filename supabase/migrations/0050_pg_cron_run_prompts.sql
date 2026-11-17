-- 0050_pg_cron_run_prompts.sql
--
-- Cron diario de ejecución de prompts SIN Inngest (el plan Hobby de Inngest se
-- agotó el 12-nov-2026: 50.000 ejecuciones/mes).
--
-- pg_cron llama cada 5 minutos entre las 06:00 y las 09:55 UTC a
-- /api/internal/cron-run-prompts. Cada llamada procesa ~4 min de ejecuciones
-- pendientes del día; el endpoint es idempotente (no repite prompt+LLM ya
-- hechos hoy), así que las llamadas sobrantes no hacen nada.
--
-- El secreto se genera aquí y vive solo en el Vault de Supabase. El endpoint
-- lo lee con get_cron_run_prompts_secret() (solo service_role).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Secreto en Vault (solo se crea si no existe)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_run_prompts_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cron_run_prompts_secret',
      'Cabecera x-cron-secret de /api/internal/cron-run-prompts'
    );
  end if;
end $$;

-- 2. Lectura del secreto para el endpoint (service_role únicamente)
create or replace function public.get_cron_run_prompts_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cron_run_prompts_secret' limit 1;
$$;

revoke all on function public.get_cron_run_prompts_secret() from public, anon, authenticated;
grant execute on function public.get_cron_run_prompts_secret() to service_role;

-- 3. Programación (se reemplaza si ya existe)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'run-prompts-daily') then
    perform cron.unschedule('run-prompts-daily');
  end if;
end $$;

select cron.schedule(
  'run-prompts-daily',
  '*/5 6-9 * * *',
  $cron$
  select net.http_post(
    url := 'https://neogeo-three.vercel.app/api/internal/cron-run-prompts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_run_prompts_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);
