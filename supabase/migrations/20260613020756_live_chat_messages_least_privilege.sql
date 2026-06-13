revoke all on public.live_chat_messages from anon;
revoke all on public.live_chat_messages from authenticated;
grant select, insert on public.live_chat_messages to authenticated;
grant all on public.live_chat_messages to service_role;
