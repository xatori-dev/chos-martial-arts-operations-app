create table if not exists public.sms_consent_records (
  role text not null check (role in ('student', 'parent', 'staff')),
  contact_id text not null,
  name text,
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  consent_status text not null check (consent_status in ('opt-in', 'opt-out', 'unknown')),
  consent_updated_at timestamptz,
  opt_out_at timestamptz,
  evidence_source text,
  twilio_message_sid text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  primary key (role, contact_id)
);

create table if not exists public.twilio_relay_attempts (
  relay_idempotency_key text primary key,
  message_id text not null references public.message_logs(id) on delete cascade,
  recipient_name text,
  recipient_role text check (recipient_role is null or recipient_role in ('student', 'parent', 'staff')),
  recipient_phone text check (recipient_phone is null or recipient_phone ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null check (status in ('reserved', 'sending', 'sent', 'failed')),
  reserved_at timestamptz not null default now(),
  sent_at timestamptz,
  delivery_provider_message_id text,
  delivery_status text check (
    delivery_status is null
    or delivery_status in ('accepted', 'scheduled', 'queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'canceled')
  ),
  delivery_detail text,
  error_code text,
  error_message text,
  result jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_sms_consent_records_updated_at on public.sms_consent_records;
create trigger set_sms_consent_records_updated_at
  before update on public.sms_consent_records
  for each row execute function public.set_updated_at();

drop trigger if exists set_twilio_relay_attempts_updated_at on public.twilio_relay_attempts;
create trigger set_twilio_relay_attempts_updated_at
  before update on public.twilio_relay_attempts
  for each row execute function public.set_updated_at();

create index if not exists sms_consent_records_phone_idx
  on public.sms_consent_records (phone);

create index if not exists twilio_relay_attempts_message_idx
  on public.twilio_relay_attempts (message_id);

create index if not exists twilio_relay_attempts_provider_message_idx
  on public.twilio_relay_attempts (delivery_provider_message_id);

revoke all on public.sms_consent_records from anon;
revoke all on public.twilio_relay_attempts from anon;
revoke all on public.sms_consent_records from authenticated;
revoke all on public.twilio_relay_attempts from authenticated;

grant select, insert, update on public.sms_consent_records to authenticated;
grant select on public.twilio_relay_attempts to authenticated;
grant all on public.sms_consent_records to service_role;
grant all on public.twilio_relay_attempts to service_role;

alter table public.sms_consent_records enable row level security;
alter table public.twilio_relay_attempts enable row level security;

drop policy if exists "Owner manager can manage SMS consent records" on public.sms_consent_records;
create policy "Owner manager can manage SMS consent records"
  on public.sms_consent_records
  for all
  to authenticated
  using (private.is_manager_owner())
  with check (private.is_manager_owner());

drop policy if exists "Owner manager can read Twilio relay attempts" on public.twilio_relay_attempts;
create policy "Owner manager can read Twilio relay attempts"
  on public.twilio_relay_attempts
  for select
  to authenticated
  using (private.is_manager_owner());
