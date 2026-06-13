create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_key text not null default 'manager-global',
  sender_user_id uuid references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_role text not null check (sender_role in ('staff', 'system')),
  sender_avatar_path text,
  message_kind text not null default 'user' check (message_kind in ('user', 'notice', 'system', 'reward')),
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists live_chat_messages_room_created_idx
  on public.live_chat_messages (room_key, created_at desc);

create index if not exists live_chat_messages_sender_created_idx
  on public.live_chat_messages (sender_user_id, created_at desc);

create schema if not exists private;

create or replace function private.is_active_staff()
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
      and role = 'staff'
      and status = 'active'
  );
$$;

revoke all on function private.is_active_staff() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.is_active_staff() to service_role;

revoke all on public.live_chat_messages from anon;
revoke all on public.live_chat_messages from authenticated;
grant select, insert on public.live_chat_messages to authenticated;
grant all on public.live_chat_messages to service_role;

alter table public.live_chat_messages enable row level security;

drop policy if exists "Active staff can read live chat messages" on public.live_chat_messages;
create policy "Active staff can read live chat messages"
  on public.live_chat_messages
  for select
  to authenticated
  using (private.is_active_staff());

drop policy if exists "Active staff can send live chat messages" on public.live_chat_messages;
create policy "Active staff can send live chat messages"
  on public.live_chat_messages
  for insert
  to authenticated
  with check (
    private.is_active_staff()
    and sender_user_id = (select auth.uid())
    and sender_role = 'staff'
    and message_kind = 'user'
    and length(trim(body)) between 1 and 500
    and sender_name = (
      select display_name
      from public.profiles
      where id = (select auth.uid())
        and role = 'staff'
        and status = 'active'
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'live_chat_messages'
    )
  then
    alter publication supabase_realtime add table public.live_chat_messages;
  end if;
end;
$$;
