create table if not exists public.app_state_items (
  key text primary key,
  value jsonb not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_state_items_key_not_blank check (length(trim(key)) between 3 and 160),
  constraint app_state_items_key_scope check (
    key in (
      'chos.cart.v1',
      'chos.orders.v1',
      'chos.bookings.v1',
      'chos.contacts.v1',
      'chos.operations.leadReviews.v1',
      'chos.coupon.v1',
      'chos.operations.students.v1',
      'chos.operations.classes.v1',
      'chos.operations.schedule.v1',
      'chos.operations.campaigns.v1',
      'chos.operations.scheduledCampaigns.v1',
      'chos.operations.automationRuns.v1',
      'chos.operations.twilioRelayEndpoint.v1',
      'chos.operations.pushServerEndpoint.v1',
      'chos.operations.twilioLaunchProfile.v1',
      'chos.operations.events.v1',
      'chos.operations.merchandise.v1',
      'chos.operations.checkins.v1',
      'chos.operations.videoFolders.v1',
      'chos.operations.videos.v1',
      'chos.operations.studyGuideFolders.v1',
      'chos.operations.studyGuideMaterials.v1'
    )
  )
);

drop trigger if exists set_app_state_items_updated_at on public.app_state_items;
create trigger set_app_state_items_updated_at
  before update on public.app_state_items
  for each row execute function public.set_updated_at();

create or replace function public.set_app_state_items_updated_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_app_state_items_updated_by on public.app_state_items;
create trigger set_app_state_items_updated_by
  before insert or update on public.app_state_items
  for each row execute function public.set_app_state_items_updated_by();

revoke all on public.app_state_items from anon;
revoke all on public.app_state_items from authenticated;

grant select, insert, update, delete on public.app_state_items to authenticated;
grant all on public.app_state_items to service_role;

alter table public.app_state_items enable row level security;

drop policy if exists "Active profiles can read app state" on public.app_state_items;
create policy "Active profiles can read app state"
  on public.app_state_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.status = 'active'
    )
  );

drop policy if exists "Active staff can create app state" on public.app_state_items;
create policy "Active staff can create app state"
  on public.app_state_items
  for insert
  to authenticated
  with check (private.is_active_staff());

drop policy if exists "Active staff can update app state" on public.app_state_items;
create policy "Active staff can update app state"
  on public.app_state_items
  for update
  to authenticated
  using (private.is_active_staff())
  with check (private.is_active_staff());

drop policy if exists "Owner manager can delete app state" on public.app_state_items;
create policy "Owner manager can delete app state"
  on public.app_state_items
  for delete
  to authenticated
  using (private.is_manager_owner());
