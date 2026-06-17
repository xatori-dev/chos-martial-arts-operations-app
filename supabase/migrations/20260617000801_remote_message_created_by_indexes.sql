create index if not exists direct_messages_created_by_idx
  on public.direct_messages (created_by);

create index if not exists message_logs_created_by_idx
  on public.message_logs (created_by);
