revoke all on public.profiles from anon;
revoke all on public.account_creation_audit from anon;

revoke all on public.profiles from authenticated;
revoke all on public.account_creation_audit from authenticated;

grant select on public.profiles to authenticated;
grant select on public.account_creation_audit to authenticated;
grant all on public.profiles to service_role;
grant all on public.account_creation_audit to service_role;
