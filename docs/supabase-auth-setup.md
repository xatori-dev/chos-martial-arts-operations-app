# Supabase Auth Setup

This app keeps the browser on publishable Supabase credentials only. Account creation runs through the `manager-create-account` Edge Function so the service role key never enters Vite or localStorage.

## Required project setup

1. Create or connect a Supabase project.
2. Apply `supabase/migrations/20260609183000_manager_accounts.sql`.
3. Deploy `supabase/functions/manager-create-account/index.ts` with platform JWT verification disabled. The function validates the caller's JWT and owner profile itself before using the server-side admin client.
4. Set the deployed app env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Seed the one owner account after the migration:

```powershell
$env:SUPABASE_URL="https://PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
$env:MANAGER_USERNAME="Manager123"
$env:MANAGER_PASSWORD="<generated-strong-password>"
$env:MANAGER_AUTH_EMAIL="manager123@accounts.chosmartialarts.app"
node scripts/seed-supabase-manager.mjs
```

`MANAGER_PASSWORD` is required and must be at least 12 characters with uppercase, lowercase, a number, and a symbol. Store the actual value in 1Password or the approved secret store, not in this repository or chat. The seed script creates or updates only the owner login by default. To delete every other Supabase Auth user, run it with `--delete-extra-auth-users --yes-delete-extra-auth-users`; do that only after confirming the target project is the correct environment.

For an existing staging project, rotate any legacy seeded owner password by rerunning this script with a generated `MANAGER_PASSWORD` from the approved secret store. Do not preserve sample or prototype passwords in Supabase Auth.

## Runtime behavior

- `Manager123` signs in through Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured.
- Manager-created accounts are inserted into Supabase Auth and `public.profiles` through the Edge Function.
- Manager-created Supabase account passwords must meet the same 12-character mixed password policy as the seeded owner password.
- The local prototype state is still updated after the Supabase create succeeds so the UI reflects the new account immediately.

## Hosted Auth hardening

- Enable Supabase leaked-password protection in Auth settings after the Supabase organization is on Pro or higher. The Free plan leaves the Security Advisor warning `auth_leaked_password_protection` active.
- Keep the local password policy in the seed script and `manager-create-account` Edge Function even after hosted leaked-password protection is enabled; the hosted check rejects known compromised passwords, while the local policy blocks short or composition-weak passwords.
