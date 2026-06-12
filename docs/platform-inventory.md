# Platform Inventory

Last updated: 2026-06-12

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

Staging has Supabase Auth profiles, RLS, `account_creation_audit`, and the `manager-create-account` Edge Function. The seeded owner login is `Manager123` with password `123456`; the internal Auth email is `manager123@accounts.chosmartialarts.app`. Production remains uncreated until staging is accepted.

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
