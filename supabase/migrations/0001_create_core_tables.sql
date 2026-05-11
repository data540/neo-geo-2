-- =============================================================================
-- 0001: Core tables — profiles, workspaces, workspace_members, brands
-- =============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz default now() not null
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  brand_name text not null,
  domain text,
  brand_statement text,
  country text default 'ES' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz default now() not null,
  primary key (workspace_id, user_id)
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  domain text,
  aliases text[] default '{}' not null,
  type text not null check (type in ('own', 'competitor')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table brand_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  extracted_summary text,
  positioning text,
  audience text,
  products_services text,
  differentiators text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger: auto-create profile after signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Trigger: update updated_at on workspaces
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_updated_at
  before update on workspaces
  for each row execute function update_updated_at();

create trigger brands_updated_at
  before update on brands
  for each row execute function update_updated_at();

create trigger brand_profiles_updated_at
  before update on brand_profiles
  for each row execute function update_updated_at();
