# Supabase Auth Setup

This app keeps the browser on publishable Supabase credentials only. Manager sign-in uses Supabase Auth directly, and chat/message records use Supabase REST and Realtime with row-level security. The service role key never enters Vite or localStorage.

## Required project setup

1. Create or connect the Cho's Supabase project. Current staging is `chos-martial-arts-operations-app-staging` / `zfuwbbepsnmmlpgfkmhz`.
2. Apply the migrations in `supabase/migrations`.
3. Deploy `supabase/functions/manager-create-account/index.ts` only if the retired account-creation endpoint must return its explicit 410 response in that environment.
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

Do not run Cho's migrations, seed scripts, smoke checks, or Edge Function deploys against MongTeng's Supabase project `mongteng-food-market-ordering-app-staging` / `jqvclzlvrhdcsfhhvekr`. This app also refuses that project ref at runtime if it is accidentally placed in `VITE_SUPABASE_URL`.

For an existing staging project, rotate any legacy seeded owner password by rerunning this script with a generated `MANAGER_PASSWORD` from the approved secret store. Do not preserve sample or prototype passwords in Supabase Auth.

## Runtime behavior

- `Manager123` signs in through Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured.
- Manager-created staff accounts are retired. Only `Manager123` and the gated local `Dev123` diagnostic login are supported.
- `live_chat_messages`, `direct_messages`, and `message_logs` persist in Supabase when the user is signed in with a valid Supabase manager session.
- The local prototype fallback is only used when Supabase env vars or a Supabase auth session are unavailable.

## Hosted Auth hardening

- Enable Supabase leaked-password protection in Auth settings after the Supabase organization is on Pro or higher. The Free plan leaves the Security Advisor warning `auth_leaked_password_protection` active.
- Keep the local password policy in the seed script even after hosted leaked-password protection is enabled; the hosted check rejects known compromised passwords, while the local policy blocks short or composition-weak passwords.
