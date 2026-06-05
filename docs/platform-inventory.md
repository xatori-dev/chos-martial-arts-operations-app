# Platform Inventory

Last updated: 2026-06-05

## GitHub

| Item | Current value |
| --- | --- |
| Legacy owner/repo | `projektoutside/chos-martial-arts-prototype` |
| Target owner/repo | `xatori-dev/chos-martial-arts-operations-app` |
| Local Xatori repo path | `C:\Dev\Business\Clients\active\chos-martial-arts\operations-app\repo` |
| Default branch | `main` |
| Working branch for onboarding | `codex/xatori-infra-standardization` |
| Branch protection | Not configured on target repo yet |
| Target repo status | Planned, not created in phase 1 while local `gh` is authenticated as `projektoutside` |

## Hosting

| Item | Current value |
| --- | --- |
| Legacy hosting | GitHub Pages |
| Legacy Pages URL | `https://projektoutside.github.io/chos-martial-arts-prototype/` |
| Legacy workflow | `.github/workflows/deploy-pages.yml` |
| Target staging hosting | GitHub Pages or Cloudflare Pages after Xatori repo creation |
| Target Cloudflare Pages name | `chos-martial-arts-operations-app` |
| DNS/custom domain | Not configured in phase 1 |

## Google Workspace

| Item | Target value |
| --- | --- |
| Account | `xatori@xatoridev.com` |
| Drive folder | `chos-martial-arts - operations-app` |
| Gmail labels | `Clients`, `Clients/chos-martial-arts`, `Clients/chos-martial-arts/operations-app` |
| Status | Planned; write action requires connector/account confirmation at execution time |

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
| Staging | `chos-martial-arts-operations-app-staging` | Reserved name only |
| Production | `chos-martial-arts-operations-app-production` | Reserved name only |

The current app has no Supabase runtime integration. A separate backend/auth/data migration plan is required before creating schemas, auth policies, RLS, Edge Functions, or production migrations.

## Twilio

| Resource | Target name | Status |
| --- | --- | --- |
| Dev subaccount | `xd-chos-martial-arts-operations-app-dev` | Planned |
| Production subaccount | `xd-chos-martial-arts-operations-app-prod` | Planned |
| Transactional Messaging Service | `xd-chos-martial-arts-operations-app-txn` | Planned |
| Broadcast Messaging Service | `xd-chos-martial-arts-operations-app-broadcast` | Planned |

The browser app currently provides credential-free Twilio relay, consent, webhook, and Web Push contracts. Live SMS requires a private server with manager auth, CSRF protection, consent evidence, rate limits, audit logs, sender compliance checks, and server-held Twilio credentials.

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
