# AGENTS.md

## Project Snapshot

- This is Cho's Martial Arts App Prototype: a Vite + React + TypeScript single-page app.
- Stack: React 19, React Router 7, Vite 8, strict TypeScript, Vitest, Testing Library, jsdom, lucide-react, date-fns, and Three.js.
- This is a local prototype with no backend, payment processor, SMS/email provider, calendar account, CAPTCHA service, or production auth. Mock app state persists in `localStorage`.
- The app is GitHub Pages-ready. Preserve subpath routing and asset loading.

## Start Here

- Run `git status -sb` before editing. This repo is often dirty, and active user changes must be preserved.
- Inspect the real source before changing behavior. Do not patch from memory.
- Prefer small, high-confidence diffs over broad rewrites.
- Use `rg` for searches when available.
- Avoid new dependencies unless the user approves them.

## Architecture Map

- `src/main.tsx` mounts the app, wraps it in `BrowserRouter`, and derives the basename from `import.meta.env.BASE_URL`.
- `src/App.tsx` owns the login gate. Preserve `AuthLaunchLogo`, `LaunchLogoAnimation`, and `LoginLandingPage` unless the user explicitly asks to change them.
- Authenticated users enter `src/OperationsApp.tsx`, the current staff/manager operations workspace.
- `src/OperationsApp.tsx` owns manager routes: `/`, `/manager`, `/dashboard`, `/students`, `/classes`, `/schedule`, `/messages`, `/check-ins`, `/events`, `/merchandise`, and `/reports`.
- `src/state.tsx` is the central localStorage-backed prototype state surface for sessions, roles, students, classes, scheduling, messages, events, merchandise, check-ins, cart, orders, bookings, and contacts.
- `src/data.ts` is the source of truth for studio info, public content, products, categories, class rules, belt ranks, and app topic labels.
- `src/types.ts` defines shared contracts. Update types before changing data/state/UI that depends on them.
- `src/styles.css` is large and global. Reuse existing class naming and visual language before adding new style systems.

## Product Rules

- Do not remove or degrade the login intro animation and login page.
- The post-login experience should stay focused on practical Cho's business workflows: manager home, manager launcher, scheduling, marketing/messages, sign-ins/check-ins, events, students, classes, merchandise, and reports.
- The `/` manager home route is currently presented as the Profile surface. Keep the compact PROFILE header, Manager's Panel/Log Out actions, locked page shell, and internally scrolling message feed unless the user explicitly asks to rework that structure.
- Favor phone-app-style icon launchers and direct workflow pages over long scrolling dashboards when redesigning authenticated surfaces.
- Keep the UI polished, responsive, accessible, and usable on mobile-sized screens.
- Use real app behavior and testable controls; avoid marketing-only screens when the user asks for an app feature.

## State And Data Rules

- Treat `localStorage` persistence as intentional prototype behavior.
- When adding or changing workflow data, update `src/types.ts`, `src/state.tsx`, the relevant UI, and tests together.
- Keep localStorage reads/writes tolerant of blocked or failing storage.
- Do not introduce real backend assumptions unless the user explicitly chooses a backend integration.
- Preserve source-faithful Cho's content, product names, prices, categories, class times, and labels.

## Routing And Assets

- Respect GitHub Pages project-subpath hosting. Use React Router links and existing `import.meta.env.BASE_URL` patterns.
- Use imported `src/assets` files for bundled UI assets and `public/` for public runtime assets.
- Do not hardcode root-relative asset paths that break under `/chos-martial-arts-prototype/`.
- The default manager profile portrait is `public/assets/CheetahProfilePic/Cheetah.png`; reference it through the existing `publicAsset()` helper so local and GitHub Pages paths both work.
- Do not make runtime code depend on ignored or local-only folders. If an asset is required by the app, ensure it is tracked or moved into an appropriate tracked asset location.
- Keep `dist/`, logs, `node_modules/`, scratch/reference folders, and export artifacts out of commits.

## Styling Rules

- Preserve the current dark Cho's brand system: black/charcoal base, red/gold accents, Cormorant font assets, and high-contrast readable text.
- Keep global CSS changes scoped with existing class prefixes such as `manager-`, `operations-`, `auth-`, `dojo-`, and `student-`.
- Avoid style-only rewrites. Change layout and styling only when it supports the requested behavior.
- Maintain accessible labels, roles, focus states, button names, and Testing Library-friendly semantics.
- Top-level page header titles must stay consistent with the established `PROFILE` and `MANAGER PANEL` treatment: top-left placement, shared ornamental line art, subtle line glow, title-bar height, font family, text shadow, and theme-aware color variables. Reuse `ManagerPageTitleFrame`, `.manager-page-title-bar`, and `.manager-page-title-frame` for manager/operations top page titles instead of hand-rolling separate `<h1>` styling; if a longer title needs smaller type, add a scoped modifier while preserving the same x/y alignment, title frame rhythm, and line glow.

## UI, Layout, Responsiveness, and Visual Asset Standards

- Every code edit, new component, refactor, replacement, and UI behavior change must be designed for desktop, tablet, mobile, and supported device console/view sizes by default. Do not assume a single viewport unless the user explicitly requires it.
- Layouts must remain clean, readable, professionally spaced, and layout-safe across supported devices. Components should adapt with responsive constraints, wrapping, grid/flex behavior, and sensible min/max sizing instead of relying on fixed desktop-only dimensions.
- All new or modified icons, borders, panels, fonts, buttons, shadows, animations, transitions, visual effects, and UI elements must match the existing Cho's visual language. Inspect the current palette, spacing rhythm, typography scale, icon style, border radius, shadow treatment, and tone before adding new visual styles.
- Do not introduce random colors, mismatched icon styles, inconsistent border radii, oversized typography, conflicting shadows, or effects that feel disconnected from the app theme.
- Prioritize compact, efficient, minimalistic, and neatly organized layouts. Avoid unnecessary empty space, bloated padding, oversized sections, excessive margins, and sparse compositions that make the app feel unfinished.
- Panels, categories, navigation areas, content sections, and interactive zones must be separated clearly and logically. The user should be able to understand each section's purpose immediately.
- Fonts must never be unnecessarily large or visually overpowering. Text must stay readable, balanced, aligned, and safely wrapped across device widths and heights.
- Prevent overlapping text, clipped labels, broken wrapping, inconsistent spacing, crowded controls, awkward floating elements, and randomly positioned content. Every layout decision should be checked mentally against narrow mobile, tablet, desktop, and short-height viewports before implementation.
- Before finalizing any UI change, confirm the layout works cleanly on mobile, tablet, and desktop; spacing is efficient; panels are clearly separated; fonts are properly sized; icons and visuals match the theme; no elements overlap or feel cramped; and the result feels polished, minimal, and easy to understand.
- When new images, icons, illustrations, UI graphics, visual assets, or major visual concepts are needed, use the image-generation MCP / ChatGPT image-generation workflow first to create high-quality reference images or production-ready assets before implementing them into the app.
- For ChatGPT/Codex image work, use the built-in image generation tool exposed in the current session by default; do not start with project scripts, ad hoc SDK calls, or raw OpenAI API model strings.
- Treat official docs and runtime access as separate checks. Even if docs list a model such as `gpt-image-2`, do not call it for this project unless the current runtime has been verified once and the user explicitly wants the API/CLI path instead of the built-in ChatGPT image tool.
- If any image model call returns "model does not exist", stop after that single failure. Do not retry the same model or loop through the same failing command; switch to the built-in ChatGPT image-generation workflow, or report that API/CLI access is unavailable if the built-in tool is not suitable.
- Generated visuals must aim for professional quality, match the existing dark Cho's theme, and avoid placeholder-looking, rushed, or visually inconsistent assets. Temporary assets are allowed only when explicitly requested or clearly marked as temporary.
- The app now supports both dark and light themes. Every UI, layout, icon, image, panel, border, shadow, and interaction change must be evaluated in both themes before completion.
- Prefer theme-aware CSS variables and scoped light/dark overrides over one-off hardcoded colors. New colors must preserve contrast, readability, Cho's brand tone, and visual consistency in both dark and light modes.
- New generated or imported visual assets must render cleanly on dark and light backgrounds. Prefer transparent-background assets for toolbar icons and controls unless a solid background is intentionally part of the design.
- Profile, manager, operations, student, public, modal, and navigation surfaces must continue to accommodate theme switching without clipped text, washed-out controls, invisible borders, or mismatched effects.

## Testing And Verification

Use focused verification for the touched surface:

- `npm run test` for Vitest/Testing Library coverage.
- `npm run build` for TypeScript and production Vite build validation.
- `npm run build:pages` before GitHub Pages publish work; it must create `dist/404.html`.
- `npm audit --audit-level=moderate` and `git diff --cached --check` before commit/push publish flows.
- For local preview, use `npm run dev -- --host 127.0.0.1 --port 5173` and verify the URL responds.

## GitHub Pages Publish Flow

- The workflow is `.github/workflows/deploy-pages.yml` and deploys from `main`.
- For publish requests, separate intended runtime/app changes from scratch/reference material with `git status -sb` and `git ls-files --others --exclude-standard`.
- Stage only intended app files.
- Validate before pushing.
- After pushing to `origin/main`, verify the GitHub Pages workflow and the live Pages URL, not just the local commit.
