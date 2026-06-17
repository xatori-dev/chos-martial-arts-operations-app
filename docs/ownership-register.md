# Ownership Register

Last updated: 2026-06-10

Default model: agency-master under Xatori Dev, with strict per-app isolation and handoff-ready documentation.

| System | Development owner | Staging owner | Production owner | Handoff status | Notes |
| --- | --- | --- | --- | --- | --- |
| GitHub target repo | xatori-dev | xatori-dev | xatori-dev | Started | Target repo exists at `xatori-dev/chos-martial-arts-operations-app`; `origin/main` is reachable, but local `gh` still authenticates as `projektoutside`. |
| GitHub legacy repo | projektoutside | projektoutside | projektoutside | Temporary exception | Keep `projektoutside/chos-martial-arts-prototype` live until the Xatori deployment is proven or the exception is explicitly closed. |
| GitHub Pages legacy URL | projektoutside | projektoutside | projektoutside | Temporary exception | Keep `https://projektoutside.github.io/chos-martial-arts-prototype/` live until cutover. |
| Google Workspace | xatori@xatoridev.com | xatori@xatoridev.com | xatori@xatoridev.com | Started | Connected Drive account is `xatori@xatoridev.com`; handoff package document exists, and folder-level organization can still use `chos-martial-arts - operations-app` plus labels under `Clients/chos-martial-arts/operations-app`. |
| 1Password | xatori@xatoridev.com | xatori@xatoridev.com | xatori@xatoridev.com | Not started | Use `client-chos-martial-arts Development`, `Production`, and `Handoff` vaults. |
| Cloudflare | Xatori Dev | Xatori Dev | Xatori Dev | Not started | No DNS or production hosting change in phase 1. |
| Supabase | Xatori Dev | Xatori Dev | Xatori Dev | Started | Staging project `chos-martial-arts-operations-app-staging` is documented for manager auth/account persistence; production remains uncreated. |
| Twilio | Xatori Dev | Xatori Dev | Xatori Dev | Started | Cho's staging Messaging Service `Cho's Martial Arts Broadcasts` exists with sender `+12625003283`; no live SMS send is verified, and A2P/hosted-secret setup remains blocked. |
| Stripe | Xatori Dev, if legally appropriate | Xatori Dev, if legally appropriate | Xatori Dev, if legally appropriate | Not started | No payment integration exists today; separate account may be required for independent legal/payment ownership. |
| Email provider | Xatori Dev, if needed | Xatori Dev, if needed | Xatori Dev, if needed | Not started | Not integrated today. |
| Analytics/Monitoring | Xatori Dev, if needed | Xatori Dev, if needed | Xatori Dev, if needed | Not started | Not integrated today. |

## Approval Gates

Explicit approval is required before production deploys, DNS/domain changes, billing/payout changes, account creation, legal verification, collaborator permission changes, secret rotation that could break production, production database migrations, phone-number purchases, messaging campaigns, or destructive delete/archive/transfer actions.
