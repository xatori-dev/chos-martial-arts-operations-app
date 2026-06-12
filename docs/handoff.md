# Handoff

## Current Status

This project is not ready for client handoff as a production system. It is a Xatori-managed prototype with a verified GitHub Pages staging deployment, an active Supabase staging surface for manager auth/account persistence, and browser-local prototype workflows for the remaining operations data. There is no production backend, production database, payments, email provider, or live SMS provider.

## Delivery Package

- Repository: `xatori-dev/chos-martial-arts-operations-app`
- Verified staging URL: `https://xatori-dev.github.io/chos-martial-arts-operations-app/`
- Latest verified target deployment: GitHub Pages workflow run `27249196766`, commit `32e91f5`, environment `github-pages`
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
- [ ] GitHub CLI or connector identity is switched to an intended Xatori operator before live repo administration.
- [ ] Legacy `projektoutside` repo exception is resolved or explicitly retained after Xatori deployment is proven.
- [x] Google Drive package document exists under the connected `xatori@xatoridev.com` Drive account.
- [ ] Client-facing production domain and hosting are documented.
- [ ] Backend/auth/database scope is approved, implemented, and secured if production data is used.
- [ ] Twilio production sender, compliance, consent, and audit model are approved if live SMS is used.
- [ ] Stripe legal/payment ownership is decided if payments are introduced.
- [ ] 1Password handoff vault contains only intended client/handoff references.
- [ ] Xatori-only credentials are revoked or reduced if ownership transfers.

## Support Transition Notes

Until a production backend exists, support should focus on local prototype behavior, GitHub Pages deployment health, and documented provider-readiness gaps. Do not promise real cross-device persistence, production auth, payments, email, or live SMS from the current browser-only app.
