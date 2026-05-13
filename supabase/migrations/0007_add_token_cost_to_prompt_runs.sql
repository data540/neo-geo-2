alter table prompt_runs
  add column if not exists model text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists cost_usd numeric(10,8);
