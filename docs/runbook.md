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
```

`npm run build:pages` must create `dist/404.html` for GitHub Pages SPA fallback.

## Current Deployment

- Legacy repository: `projektoutside/chos-martial-arts-prototype`
- Legacy Pages URL: `https://projektoutside.github.io/chos-martial-arts-prototype/`
- Workflow: `.github/workflows/deploy-pages.yml`
- Status: keep live until the Xatori mirror and staging deployment are proven.

## Xatori Mirror Workflow

1. Confirm GitHub CLI or connector identity is ready for `xatori-dev`.
2. Create `xatori-dev/chos-martial-arts-operations-app`.
3. Push from `C:\Dev\Business\Clients\active\chos-martial-arts\operations-app\repo`.
4. Enable Actions and Pages or Cloudflare Pages staging.
5. Run the Pages workflow and verify the deployed URL.
6. Only after verification, decide whether to update the primary remote, archive the legacy repo, redirect users, or leave a documented exception.

## Messaging And Notifications

- The static app can queue SMS work, export credential-free relay manifests, and validate browser-safe relay health responses.
- Live Twilio sends, inbound webhook persistence, status callbacks, Web Push storage, and Web Push sends must be handled by a private server.
- Server implementation must enforce manager auth, CSRF protection, server-held credentials, consent evidence, opt-out handling, rate limits, idempotency, audit logs, and Twilio webhook signatures.

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
