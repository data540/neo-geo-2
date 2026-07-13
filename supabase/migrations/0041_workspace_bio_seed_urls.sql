-- Seeds curados de páginas para la generación de Company Bio.
-- Permite forzar la inclusión de URLs representativas del negocio
-- (destinos, tarifas, programa de fidelización, corporativa, alianzas, carga)
-- e imprescindible en sitios SPA cuya home apenas expone enlaces navegables.
-- Sin seeds, la extracción sigue funcionando por descubrimiento automático.
alter table public.workspaces
  add column if not exists bio_seed_urls text[] not null default '{}';

comment on column public.workspaces.bio_seed_urls is
  'URLs representativas forzadas para la Company Bio (evita sesgo de páginas transaccionales/legales en sitios SPA).';
