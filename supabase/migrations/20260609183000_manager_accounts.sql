create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  auth_email text not null,
  contact_email text,
  display_name text not null,
  role text not null check (role in ('staff', 'student', 'guardian')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_owner boolean not null default false,
  phone text,
  title text,
  notes text,
  access text[] not null default '{}',
  student_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_not_blank check (length(trim(username)) >= 3),
  constraint profiles_auth_email_not_blank check (length(trim(auth_email)) >= 3),
  constraint profiles_owner_is_manager check (
    not is_owner
    or (lower(username) = 'manager123' and role = 'staff' and status = 'active')
  )
);

create unique index if not exists profiles_username_unique on public.profiles (lower(username));
create unique index if not exists profiles_auth_email_unique on public.profiles (lower(auth_email));
create unique index if not exists profiles_contact_email_unique on public.profiles (lower(contact_email)) where contact_email is not null;
create unique index if not exists profiles_single_owner on public.profiles (is_owner) where is_owner;
create index if not exists profiles_created_by_idx on public.profiles (created_by);

create table if not exists public.account_creation_audit (
  id bigint generated always as identity primary key,
  created_by uuid references auth.users(id) on delete set null,
  created_user_id uuid references auth.users(id) on delete set null,
  created_username text not null,
  created_auth_email text not null,
  created_contact_email text,
  created_role text not null check (created_role in ('staff', 'student', 'guardian')),
  request_ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists account_creation_audit_created_by_idx on public.account_creation_audit (created_by);
create index if not exists account_creation_audit_created_user_id_idx on public.account_creation_audit (created_user_id);

create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function private.is_manager_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_owner is true
      and lower(username) = 'manager123'
      and role = 'staff'
      and status = 'active'
  );
$$;

revoke all on function private.is_manager_owner() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_manager_owner() to authenticated;
grant execute on function private.is_manager_owner() to service_role;

grant select on public.profiles to authenticated;
grant select on public.account_creation_audit to authenticated;

alter table public.profiles enable row level security;
alter table public.account_creation_audit enable row level security;

drop policy if exists "Profiles readable by owner manager or self" on public.profiles;
create policy "Profiles readable by owner manager or self"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or private.is_manager_owner());

drop policy if exists "Owner manager can read account audit" on public.account_creation_audit;
create policy "Owner manager can read account audit"
  on public.account_creation_audit
  for select
  to authenticated
  using (private.is_manager_owner());
