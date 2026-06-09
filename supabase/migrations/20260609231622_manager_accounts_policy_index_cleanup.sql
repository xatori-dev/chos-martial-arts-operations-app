create index if not exists profiles_created_by_idx on public.profiles (created_by);
create index if not exists account_creation_audit_created_by_idx on public.account_creation_audit (created_by);
create index if not exists account_creation_audit_created_user_id_idx on public.account_creation_audit (created_user_id);

drop policy if exists "Profiles can read own row" on public.profiles;
drop policy if exists "Owner manager can read profiles" on public.profiles;
drop policy if exists "Owner manager can manage profiles" on public.profiles;
drop policy if exists "Profiles readable by owner manager or self" on public.profiles;
create policy "Profiles readable by owner manager or self"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or private.is_manager_owner());
