create table if not exists public.direct_messages (
  id text primary key,
  thread_id text not null,
  sender_id text not null,
  sender_name text not null,
  recipient_id text not null,
  recipient_name text not null,
  body text not null check (length(trim(body)) between 1 and 2000),
  status text not null default 'sent' check (status in ('sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.message_logs (
  id text primary key,
  kind text not null check (kind in ('welcome', 'reminder', 'follow-up', 'marketing', 'celebration', 'profile-update')),
  recipient_name text not null,
  recipient_phone text not null,
  recipient_role text check (recipient_role in ('student', 'parent', 'staff')),
  recipient_id text,
  body text not null check (length(trim(body)) between 1 and 2000),
  status text not null check (status in ('queued', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  campaign_id text,
  delivery_channel text check (delivery_channel is null or delivery_channel in ('sms')),
  delivery_provider text check (delivery_provider is null or delivery_provider in ('twilio')),
  delivery_mode text check (delivery_mode is null or delivery_mode in ('prototype', 'live')),
  delivery_status text check (
    delivery_status is null
    or delivery_status in ('accepted', 'scheduled', 'queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'canceled')
  ),
  delivery_detail text,
  delivery_provider_message_id text,
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

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

drop trigger if exists set_direct_messages_updated_at on public.direct_messages;
create trigger set_direct_messages_updated_at
  before update on public.direct_messages
  for each row execute function public.set_updated_at();

drop trigger if exists set_message_logs_updated_at on public.message_logs;
create trigger set_message_logs_updated_at
  before update on public.message_logs
  for each row execute function public.set_updated_at();

create index if not exists direct_messages_thread_created_idx
  on public.direct_messages (thread_id, created_at desc);

create index if not exists direct_messages_sender_created_idx
  on public.direct_messages (sender_id, created_at desc);

create index if not exists direct_messages_recipient_created_idx
  on public.direct_messages (recipient_id, created_at desc);

create index if not exists message_logs_status_created_idx
  on public.message_logs (status, created_at desc);

create index if not exists message_logs_recipient_created_idx
  on public.message_logs (recipient_id, created_at desc);

create index if not exists message_logs_campaign_created_idx
  on public.message_logs (campaign_id, created_at desc);

revoke all on public.direct_messages from anon;
revoke all on public.direct_messages from authenticated;
revoke all on public.message_logs from anon;
revoke all on public.message_logs from authenticated;

grant select, insert, update, delete on public.direct_messages to authenticated;
grant select, insert, update, delete on public.message_logs to authenticated;
grant all on public.direct_messages to service_role;
grant all on public.message_logs to service_role;

alter table public.direct_messages enable row level security;
alter table public.message_logs enable row level security;

drop policy if exists "Owner manager can manage direct messages" on public.direct_messages;
create policy "Owner manager can manage direct messages"
  on public.direct_messages
  for all
  to authenticated
  using (private.is_manager_owner())
  with check (private.is_manager_owner());

drop policy if exists "Owner manager can manage message logs" on public.message_logs;
create policy "Owner manager can manage message logs"
  on public.message_logs
  for all
  to authenticated
  using (private.is_manager_owner())
  with check (private.is_manager_owner());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'direct_messages'
    ) then
      alter publication supabase_realtime add table public.direct_messages;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_logs'
    ) then
      alter publication supabase_realtime add table public.message_logs;
    end if;
  end if;
end;
$$;
