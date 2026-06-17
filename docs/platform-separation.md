# Platform Separation

App: Cho's Martial Arts Operations App

## Business Control Plane

- Business identity: Xatori Dev
- Business email: xatori@xatoridev.com
- GitHub organization: xatori-dev
- Ownership model: agency-master
- Client slug: chos-martial-arts
- Project slug: operations-app

## Current Legacy Surface

| Platform | Current state | Cutover status |
| --- | --- | --- |
| GitHub | `projektoutside/chos-martial-arts-prototype` | Temporary legacy source |
| GitHub Pages | `https://projektoutside.github.io/chos-martial-arts-prototype/` | Legacy exception; Xatori staging is now proven, so retirement is a business decision |
| Backend/database/auth | Supabase staging owns manager auth and message persistence | Must remain isolated to Cho's Supabase project refs only |
| Payments/email | Not integrated | No migration required in phase 1 |
| Twilio/Web Push | Credential-free browser handoff contracts | Private server still required for live sends |

## Xatori Target Resources

| Platform | Resource |
| --- | --- |
| GitHub repo | `xatori-dev/chos-martial-arts-operations-app` |
| GitHub Pages staging URL | `https://xatori-dev.github.io/chos-martial-arts-operations-app/` |
| Google Drive folder | `chos-martial-arts - operations-app` |
| Gmail labels | `Clients/chos-martial-arts/operations-app` |
| 1Password development vault | `client-chos-martial-arts Development` |
| 1Password production vault | `client-chos-martial-arts Production` |
| 1Password handoff vault | `client-chos-martial-arts Handoff` |
| Supabase staging project | `chos-martial-arts-operations-app-staging` / `zfuwbbepsnmmlpgfkmhz` |
| Supabase production project | `chos-martial-arts-operations-app-production` |
| Forbidden Supabase project for this app | MongTeng `mongteng-food-market-ordering-app-staging` / `jqvclzlvrhdcsfhhvekr` |
| Twilio dev subaccount | `xd-chos-martial-arts-operations-app-dev` |
| Twilio prod subaccount | `xd-chos-martial-arts-operations-app-prod` |
| Twilio transactional Messaging Service | `xd-chos-martial-arts-operations-app-txn` |
| Twilio broadcast Messaging Service | `xd-chos-martial-arts-operations-app-broadcast` |
| Cloudflare Pages project | `chos-martial-arts-operations-app` |
| Cloudflare API Worker | `xd-chos-martial-arts-operations-app-api` |
| Stripe test webhook | `chos-martial-arts-operations-app-test` |
| Stripe live webhook | `chos-martial-arts-operations-app-live` |

## Isolation Rules

- Do not share production databases across apps.
- Cho's `VITE_SUPABASE_URL` must point only to a Cho's Supabase project. Current staging is `https://zfuwbbepsnmmlpgfkmhz.supabase.co`.
- Never use MongTeng's Supabase project `mongteng-food-market-ordering-app-staging` (`jqvclzlvrhdcsfhhvekr`) for Cho's local, staging, production, seed, migration, Edge Function, or smoke-test work.
- Do not share Twilio Messaging Services between transactional and broadcast use cases.
- Do not share Stripe webhook secrets across apps or environments.
- Do not commit `.env.local`, `.env.staging`, `.env.production`, or real API keys.
- Keep all temporary legacy ownership exceptions in `docs/ownership-register.md`.
- Do not create or change production, billing, DNS, access-control, phone-number, or legal-verification resources without explicit approval.
