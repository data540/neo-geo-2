-- =============================================================================
-- 0030: Structured Company Bio profile data
-- =============================================================================

alter table brand_profiles
  add column if not exists profile_data jsonb,
  add column if not exists analysis_source_url text,
  add column if not exists analysis_model text,
  add column if not exists analysis_input_digest text,
  add column if not exists analyzed_at timestamptz,
  add column if not exists analysis_error text;

comment on column brand_profiles.profile_data is
  'Structured Company Bio profile generated from the company URL.';

comment on column brand_profiles.analysis_source_url is
  'Canonical URL used for the latest Company Bio analysis.';

comment on column brand_profiles.analysis_model is
  'OpenRouter model used for the latest Company Bio analysis.';

comment on column brand_profiles.analysis_input_digest is
  'SHA-256 digest of the extracted URL content used for the latest analysis.';
