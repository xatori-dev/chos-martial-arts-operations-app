# Handoff

## Current Status

This project is not ready for client handoff as a production system. It is a Xatori-managed staging pilot with a verified GitHub Pages deployment, an active Supabase staging surface for `Manager123` auth, owner-provisioned pilot accounts, messaging persistence, and signed-in operations app-state persistence through `app_state_items`. Device-local preferences and diagnostic prototype sessions still use browser storage. The deployed Supabase Twilio relay is blocked on hosted secrets and provider approval. Public staging intentionally exposes the gated `Dev123` diagnostic login for this pilot. There is no production backend, production database, payments, email provider, or approved live SMS provider.

## Delivery Package

- Repository: `xatori-dev/chos-martial-arts-operations-app`
- Verified staging URL: `https://xatori-dev.github.io/chos-martial-arts-operations-app/`
- Deployment proof path: the `Deploy to GitHub Pages` workflow deploys `main` to the `github-pages` environment
- Staging build configuration: GitHub repo variables provide browser-safe `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_ENABLE_DEVELOPER_ACCOUNT=true`; the workflow fails before build if they are missing or the Supabase URL does not point at Cho's staging project `zfuwbbepsnmmlpgfkmhz`
- Current local branch: `main`, tracking `origin/main`
- Current remote map: `origin` points to Xatori, `legacy-origin` points to `projektoutside`, and `desktop-source` points to the local desktop source checkout
- Google Drive package: [Cho's Martial Arts Operations App - Xatori Onboarding and Handoff Package](https://docs.google.com/document/d/1E22ubixiSzLEZPNklvmA8Wiujq63J7olDCSN1YEkkh4/edit?usp=drivesdk)
- Architecture: `docs/architecture.md`
- Platform inventory: `docs/platform-inventory.md`
- Platform separation: `docs/platform-separation.md`
- Ownership register: `docs/ownership-register.md`
- Runbook: `docs/runbook.md`
- Twilio messaging setup: `docs/twilio-messaging-setup.md`
- Environment template: `.env.example`

## Handoff Readiness Checklist

- [x] Xatori GitHub repo exists and `origin/main` is reachable.
- [x] Xatori GitHub Pages deployment is proven from the target repo.
- [x] Local `main` tracks `origin/main`.
- [x] Staging pilot scope is defined as `Manager123`, manager-created pilot accounts, and public-staging `Dev123`.
- [ ] Each launch-readiness push is verified against the live Pages URL before pilot users are invited.
- [ ] GitHub CLI or connector identity is switched to an intended Xatori operator before live repo administration.
- [ ] Legacy `projektoutside` repo exception is resolved or explicitly retained after Xatori deployment is proven.
- [x] Google Drive package document exists under the connected `xatori@xatoridev.com` Drive account.
- [ ] Client-facing production domain and hosting are documented.
- [ ] Backend/auth/database scope is approved, implemented, and secured if production data is used.
- [x] Supabase `twilio-messaging` function is deployed and `sms_consent_records` plus `twilio_relay_attempts` are migrated in staging.
- [x] Twilio Messaging Service `Cho's Martial Arts Broadcasts` has SMS/MMS sender `+12625003283` attached.
- [ ] Hosted Twilio secrets are set in Supabase. Current CLI token gets `403` on staging secret operations.
- [ ] Twilio 10DLC Brand/Campaign compliance, consent, and audit model are approved if live SMS is used. Current Trust Hub Customer Profile evaluation is `compliant`, but the Primary Customer Profile still needs Twilio Console submission/review before A2P Brand/Campaign approval can proceed.
- [ ] Stripe legal/payment ownership is decided if payments are introduced.
- [ ] 1Password handoff vault contains only intended client/handoff references.
- [ ] Xatori-only credentials are revoked or reduced if ownership transfers.

## Support Transition Notes

Until the hosted Supabase relay secrets and Twilio 10DLC setup are verified, support should focus on staging manager auth, owner-created pilot accounts, signed-in Supabase app-state behavior, GitHub Pages deployment health, and documented provider-readiness gaps. Do not promise a production-ready staff account rollout, production auth, payments, email, or live SMS from the current hosted app.
