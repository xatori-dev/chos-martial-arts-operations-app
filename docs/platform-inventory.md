# Platform Inventory

Last updated: 2026-06-17

## GitHub

| Item | Current value |
| --- | --- |
| Legacy owner/repo | `projektoutside/chos-martial-arts-prototype` |
| Target owner/repo | `xatori-dev/chos-martial-arts-operations-app` |
| Local Xatori repo path | `C:\Dev\Business\Clients\active\chos-martial-arts\operations-app\repo` |
| Default branch | `main` |
| Current release branch | `main` |
| Branch protection | Not configured on target repo yet |
| Target repo status | Created and reachable at `https://github.com/xatori-dev/chos-martial-arts-operations-app`; `origin/main` is the Xatori target branch |
| Local branch tracking | Local `main` tracks `origin/main`; `legacy-origin` and `desktop-source` remain as references only |
| Local GitHub CLI identity | `gh auth status` reports `projektoutside`; the account has admin access, but switch to an intended Xatori operator before live repo administration |

## Hosting

| Item | Current value |
| --- | --- |
| Legacy hosting | GitHub Pages |
| Legacy Pages URL | `https://projektoutside.github.io/chos-martial-arts-prototype/` |
| Legacy workflow | `.github/workflows/deploy-pages.yml` |
| Target staging hosting | GitHub Pages from the Xatori repo, verified |
| Target Pages URL | `https://xatori-dev.github.io/chos-martial-arts-operations-app/` |
| Target deployment workflow | `Deploy to GitHub Pages` deploys `main` to the `github-pages` environment |
| Staging build variables | GitHub repo variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_ENABLE_DEVELOPER_ACCOUNT=true`; workflow preflight requires Cho's staging Supabase ref `zfuwbbepsnmmlpgfkmhz` |
| SPA fallback behavior | `dist/404.html` is deployed. Deep links such as `/messages` return GitHub Pages HTTP 404 while serving the app shell, which is expected for the static SPA fallback. |
| Target Cloudflare Pages name | `chos-martial-arts-operations-app` |
| DNS/custom domain | Not configured in phase 1 |

## Google Workspace

| Item | Target value |
| --- | --- |
| Account | `xatori@xatoridev.com` |
| Drive folder | `chos-martial-arts - operations-app` |
| Drive package document | `Cho's Martial Arts Operations App - Xatori Onboarding and Handoff Package` / https://docs.google.com/document/d/1E22ubixiSzLEZPNklvmA8Wiujq63J7olDCSN1YEkkh4/edit?usp=drivesdk |
| Gmail labels | `Clients`, `Clients/chos-martial-arts`, `Clients/chos-martial-arts/operations-app` |
| Status | Drive account confirmed as `xatori@xatoridev.com`; package document created for the current handoff refresh |

## 1Password

| Vault | Purpose | Status |
| --- | --- | --- |
| `client-chos-martial-arts Development` | Local, preview, staging references | Planned or pending vault-scope verification |
| `client-chos-martial-arts Production` | Production secret references | Planned or pending vault-scope verification |
| `client-chos-martial-arts Handoff` | Handoff package and final transfer references | Planned or pending vault-scope verification |

No raw secret values belong in this repository or in chat. Record item names and 1Password references only.

## Supabase

| Environment | Target project | Status |
| --- | --- | --- |
| Staging | `chos-martial-arts-operations-app-staging` / `zfuwbbepsnmmlpgfkmhz` | Active in Xatori Dev, us-east-2 |
| Production | `chos-martial-arts-operations-app-production` | Reserved name only |

Project boundary: MongTeng uses a separate Supabase project, `mongteng-food-market-ordering-app-staging` / `jqvclzlvrhdcsfhhvekr`. Do not use that ref, URL, keys, migrations, Edge Functions, or seed scripts for Cho's work.

Staging has Supabase Auth profiles, RLS, `account_creation_audit`, `live_chat_messages`, `direct_messages`, `message_logs`, and the retired `manager-create-account` Edge Function. The `twilio_messaging_relay` migration has been applied to staging, creating `sms_consent_records` and `twilio_relay_attempts`, and the hosted `twilio-messaging` Edge Function is deployed with `verify_jwt = false` for Twilio webhooks. Hosted Twilio secrets are not set yet because `supabase secrets set/list --project-ref zfuwbbepsnmmlpgfkmhz` currently returns `403` / `Your account does not have the necessary privileges to access this endpoint`. The supported staging pilot sign-ins are `Manager123` for owner testing and public-staging `Dev123` for developer diagnostics. Individual non-owner staff profiles are not launch scope yet because the current client rejects them at sign-in. The internal Auth email for `Manager123` is `manager123@accounts.chosmartialarts.app`; staging Auth was aligned to the app password on 2026-06-17 and verifies through the real password grant.

The Xatori Dev Supabase organization is currently on the Free plan. The staging Security Advisor still reports `auth_leaked_password_protection` because Supabase leaked-password protection requires Pro or higher. Until the plan is upgraded and the Auth setting is enabled, the seed script enforces the local 12-character mixed password policy for the owner account.

Production remains uncreated until staging is accepted.

## Twilio

| Resource | Target name | Status |
| --- | --- | --- |
| Dev subaccount | `xd-chos-martial-arts-operations-app-dev` | Planned |
| Production subaccount | `xd-chos-martial-arts-operations-app-prod` | Planned |
| Transactional Messaging Service | `xd-chos-martial-arts-operations-app-txn` | Planned |
| Broadcast Messaging Service | `Cho's Martial Arts Broadcasts` / `MG3f346aee214d3fef62064a1350bd556e` | Created in the active `xatori-dev` Twilio profile; inbound/status callbacks point at the Supabase relay |
| 10DLC sender path | Cho local number + A2P Brand/Campaign | No sender attached and `usAppToPersonRegistered=false`; required before US mass texting |

The browser app currently provides credential-free Twilio relay, consent, webhook, and Web Push contracts. The deployed Supabase `twilio-messaging` relay is the intended private server path for live SMS, with manager JWT checks, server-side consent records, Twilio webhook signature validation, idempotency, and message-log reconciliation. Live SMS still requires hosted Supabase secrets, a Twilio Auth Token for webhook signatures, an attached SMS-capable sender, and Twilio Console 10DLC approval.

## Stripe

| Item | Status |
| --- | --- |
| Account | Xatori Dev target only if legal/payment ownership allows it |
| Test webhook | `chos-martial-arts-operations-app-test` reserved |
| Live webhook | `chos-martial-arts-operations-app-live` reserved |
| Products/prices | Not currently integrated |

## Email, Analytics, Monitoring

| System | Status |
| --- | --- |
| Email provider | Not currently integrated |
| Analytics | Not currently integrated |
| Monitoring/Sentry | Not currently integrated |

Add a dedicated provider/project only when production scope requires it.
