# Architecture

## Summary

Cho's Martial Arts Operations App is currently a Vite, React, and TypeScript single-page prototype for studio operations. It has a login gate, role-aware staff/student/guardian flows, manager operations pages, local messaging workflows, local merchandise/order records, scheduling, events, check-ins, reports, and a GitHub Pages-ready service worker.

The app is intentionally browser-only today. Runtime state is stored in localStorage. There is no production backend, Supabase database, payment processor, email provider, production auth provider, analytics provider, or live SMS provider wired into the app.

## Systems

| Area | Current implementation | Xatori target |
| --- | --- | --- |
| Frontend | Vite 8, React 19, React Router 7, TypeScript | Preserve until a backend phase is approved |
| Backend | None | Future private server, Cloudflare Worker, or Supabase Edge Functions |
| Database | Browser localStorage only | Future isolated Supabase staging and production projects |
| Auth | Prototype local account/session state | Future production auth plan required before real users |
| Payments | None | Future Stripe test/live resources only if product scope requires payments |
| Messaging | Browser queue/export contracts for Twilio and Web Push | Private server owns provider credentials, consent, audit logs, and sends |
| Hosting | GitHub Pages workflow in the legacy repo | Mirror to Xatori repo first, then prove Pages or Cloudflare staging |
| Monitoring | None | Future per-app monitoring project if the app becomes production-backed |

## Data Boundaries

- Prototype records remain local to each browser through localStorage.
- Exported Twilio/Web Push manifests are credential-free handoff artifacts.
- Twilio Auth Tokens, API secrets, VAPID private keys, Stripe secret keys, Supabase service-role keys, and production credentials must live only in 1Password and platform secret stores.
- Real student, guardian, payment, messaging, or auth data must not be introduced until a backend and security plan is approved.

## Routing And Deployment

- `src/main.tsx` derives the React Router basename from `import.meta.env.BASE_URL`.
- `vite.config.ts` sets the production base path from `GITHUB_REPOSITORY`, preserving GitHub Pages project-subpath hosting.
- `.github/workflows/deploy-pages.yml` runs tests, builds the app, creates `dist/404.html`, and deploys through GitHub Pages.
