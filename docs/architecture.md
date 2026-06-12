# Architecture

## Summary

Cho's Martial Arts Operations App is currently a Vite, React, and TypeScript single-page prototype for studio operations. It has a login gate, role-aware staff/student/guardian flows, manager operations pages, local messaging workflows, local merchandise/order records, scheduling, events, check-ins, reports, and a GitHub Pages-ready service worker.

The app is still primarily browser-local, but the staging Supabase project now owns manager authentication and manager-created account persistence when `VITE_SUPABASE_URL` and a publishable key are configured. Other runtime records remain in localStorage until their backend phases are explicitly implemented.

## Systems

| Area | Current implementation | Xatori target |
| --- | --- | --- |
| Frontend | Vite 8, React 19, React Router 7, TypeScript | Preserve until a backend phase is approved |
| Backend | Supabase Edge Function for manager-created accounts; other workflows are local | Expand private backend surfaces by approved feature phase |
| Database | Supabase staging for Auth profiles; other records are browser localStorage | Add production Supabase only after staging validation and launch approval |
| Auth | Supabase Auth for configured staging manager/accounts; local prototype fallback only when Supabase env is absent | Harden production Auth settings before real users |
| Payments | None | Future Stripe test/live resources only if product scope requires payments |
| Messaging | Browser queue/export contracts for Twilio and Web Push | Private server owns provider credentials, consent, audit logs, and sends |
| Hosting | GitHub Pages workflow from `xatori-dev/chos-martial-arts-operations-app`, verified at `https://xatori-dev.github.io/chos-martial-arts-operations-app/` | Keep staging healthy; choose a production hosting/domain path only after launch approval |
| Monitoring | None | Future per-app monitoring project if the app becomes production-backed |

## Data Boundaries

- Manager Auth and manager-created account profiles persist in Supabase staging when Supabase env is configured.
- Non-auth prototype records remain local to each browser through localStorage.
- Exported Twilio/Web Push manifests are credential-free handoff artifacts.
- Twilio Auth Tokens, API secrets, VAPID private keys, Stripe secret keys, Supabase service-role keys, and production credentials must live only in 1Password and platform secret stores.
- Real student, guardian, payment, messaging, or auth data must not be introduced until a backend and security plan is approved.

## Routing And Deployment

- `src/main.tsx` derives the React Router basename from `import.meta.env.BASE_URL`.
- `vite.config.ts` sets the production base path from `GITHUB_REPOSITORY`, preserving GitHub Pages project-subpath hosting.
- `.github/workflows/deploy-pages.yml` runs tests, builds the app, creates `dist/404.html`, and deploys through GitHub Pages.
- The Xatori target Pages deployment is verified through the `Deploy to GitHub Pages` workflow from `main`.
- GitHub Pages deep links use the deployed `404.html` SPA fallback. Direct paths can return HTTP 404 while still serving the app shell.
