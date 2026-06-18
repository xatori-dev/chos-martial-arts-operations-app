# Architecture

## Summary

Cho's Martial Arts Operations App is currently a Vite, React, and TypeScript single-page pilot for studio operations. It has a login gate, manager operations pages, messaging workflows, merchandise/order records, scheduling, events, check-ins, reports, and a GitHub Pages-ready service worker.

When `VITE_SUPABASE_URL`, a publishable key, and a Supabase Auth session are present, staging uses Supabase for manager authentication, owner-provisioned accounts, live chat, direct messages, message logs, and the main operations state stored in `app_state_items`. If Supabase is configured but no Supabase session exists, operations state does not fall back to browser-local persistence. Device-local preferences such as theme, tutorial completion, and browser notification permission state can still use localStorage.

## Systems

| Area | Current implementation | Xatori target |
| --- | --- | --- |
| Frontend | Vite 8, React 19, React Router 7, TypeScript | Preserve until a backend phase is approved |
| Backend | Supabase Auth/REST tables for manager auth, account creation, messaging, and app state; device preferences remain local | Expand private backend surfaces by approved feature phase |
| Database | Supabase staging for Auth profiles, message tables, and `app_state_items`; device preferences remain browser localStorage | Add production Supabase only after staging validation and launch approval |
| Auth | Supabase Auth for configured staging Manager123 login; local prototype fallback only when Supabase env is absent | Harden production Auth settings before real users |
| Payments | None | Future Stripe test/live resources only if product scope requires payments |
| Messaging | Browser queue/export contracts for Twilio and Web Push | Private server owns provider credentials, consent, audit logs, and sends |
| Hosting | GitHub Pages workflow from `xatori-dev/chos-martial-arts-operations-app`, verified at `https://xatori-dev.github.io/chos-martial-arts-operations-app/` | Keep staging healthy; choose a production hosting/domain path only after launch approval |
| Monitoring | None | Future per-app monitoring project if the app becomes production-backed |

## Data Boundaries

- Manager Auth, owner-provisioned pilot accounts, live chat, direct messages, message logs, and operations app state persist in Supabase staging when Supabase env and a valid Supabase session are present.
- If Supabase env is configured but no Supabase session is present, operations records clear stale localStorage and do not treat browser storage as authoritative.
- Device-local preferences, browser permission state, and diagnostic prototype sessions can still use localStorage or sessionStorage.
- Exported Twilio/Web Push manifests are credential-free handoff artifacts.
- Twilio Auth Tokens, API secrets, VAPID private keys, Stripe secret keys, Supabase service-role keys, and production credentials must live only in 1Password and platform secret stores.
- Real student, guardian, payment, messaging, or auth data must not be introduced until a backend and security plan is approved.

## Routing And Deployment

- `src/main.tsx` derives the React Router basename from `import.meta.env.BASE_URL`.
- `vite.config.ts` sets the production base path from `GITHUB_REPOSITORY`, preserving GitHub Pages project-subpath hosting.
- `.github/workflows/deploy-pages.yml` runs tests, builds the app, creates `dist/404.html`, and deploys through GitHub Pages.
- The Xatori target Pages deployment is verified through the `Deploy to GitHub Pages` workflow from `main`.
- GitHub Pages deep links use the deployed `404.html` SPA fallback. Direct paths can return HTTP 404 while still serving the app shell.
