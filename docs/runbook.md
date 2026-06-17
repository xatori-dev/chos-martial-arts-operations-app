# Runbook

## Local Development

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/`.

## Validation

```powershell
npm run test
npm run build:pages
npm audit --audit-level=moderate
git diff --check
```

`npm run build:pages` must create `dist/404.html` for GitHub Pages SPA fallback.

## Current Deployment

- Xatori repository: `xatori-dev/chos-martial-arts-operations-app`
- Legacy repository: `projektoutside/chos-martial-arts-prototype`
- Legacy Pages URL: `https://projektoutside.github.io/chos-martial-arts-prototype/`
- Staging Pages URL: `https://xatori-dev.github.io/chos-martial-arts-operations-app/`
- Workflow: `.github/workflows/deploy-pages.yml`
- Status: Xatori GitHub Pages is the real staging pilot target. It is not production hosting.
- Staging build requirements: repo variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_ENABLE_DEVELOPER_ACCOUNT=true` must be present before the workflow builds the Pages artifact. `VITE_SUPABASE_URL` must point to Cho's staging Supabase project `zfuwbbepsnmmlpgfkmhz`.
- Public staging account model: `Manager123` validates real Supabase manager auth when the approved password is supplied from the secret store. `Dev123` is intentionally enabled on public staging for developer diagnostics during this pilot.

## Xatori Deployment Workflow

1. Confirm GitHub CLI or connector identity is ready for `xatori-dev`; local `gh` currently authenticates as `projektoutside`.
2. Confirm local `main` tracks `origin/main`.
3. Confirm repository variables are set for Cho's staging Supabase project and the selected public `Dev123` staging pilot.
4. Push to `main`, then wait for `Deploy to GitHub Pages` to complete successfully.
5. Verify the deployed URL, `app-version.json`, and live bundle before inviting pilot users.
6. Only after verification, decide whether to archive the legacy repo, redirect users, or leave a documented exception.

## Messaging And Notifications

- The static app can queue SMS work, export credential-free relay manifests, and validate browser-safe relay health responses.
- Live Twilio sends, inbound webhook persistence, status callbacks, Web Push storage, and Web Push sends must be handled by a private server.
- Server implementation must enforce manager auth, CSRF protection, server-held credentials, consent evidence, opt-out handling, rate limits, idempotency, audit logs, and Twilio webhook signatures.
- Individual staff Supabase login is not part of this staging pilot. The current app accepts `Manager123` and the gated `Dev123` diagnostic account; non-owner staff profiles are rejected by the client until a staff-account release is approved.

## Rollback

For the current legacy GitHub Pages deployment:

1. Identify the last successful workflow run on `main`.
2. Revert or reset through a normal reviewed Git commit.
3. Push to `main`.
4. Verify the GitHub Pages workflow and live URL.

For future Xatori staging/production:

1. Document the exact deployment platform before first production release.
2. Keep the previous artifact/build available.
3. Record rollback owner, command, and validation URL in this runbook.

## Incident Notes

- Treat any raw secret in the repo, chat, browser localStorage export, or public artifact as a rotation event.
- Do not claim production readiness while provider readiness is incomplete.
