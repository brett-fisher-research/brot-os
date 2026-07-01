# OPT-IN: making an experiment installable (PWA) under a sub-path

> **PWA is opt-in, not the default.** New experiments are plain web apps opened through the
> dashboard — no manifest, service worker, or icons are scaffolded by default. Follow this
> guide **only when you want a specific experiment to be installable** ("Add to Home Screen"
> → standalone). The template files in `templates/` (`manifest.webmanifest`,
> `sw.js`, `register-sw.tsx`, `gen-icons.py`) are the opt-in materials.

If you do want this, every experiment is served at
`https://intel-nuc.mullet-ostrich.ts.net/<slug>/`, so `basePath`, the manifest
`scope`/`start_url`, the service-worker scope, and every hand-written asset URL must all
equal `/<slug>/`. Get these four right and iOS "Add to Home Screen" → standalone works.

## Steps to add a PWA to a Next app (opt-in)

1. **next.config** — set `basePath: '/<slug>'` and `output: 'standalone'`
   (see `next.config.snippet.js`).

2. **public/** — copy and substitute `@@SLUG@@`/`@@NAME@@`/`@@SHORT@@`:
   - `manifest.webmanifest` (from template) → `public/manifest.webmanifest`
   - `sw.js` (from template) → `public/sw.js`
   - icons → `uv run templates/gen-icons.py --out public --label <Initial>`
   With `basePath` set, these are served at `/<slug>/manifest.webmanifest`,
   `/<slug>/sw.js`, `/<slug>/icon-192.png`, etc.

3. **Root layout `<head>`** — raw tags are NOT auto-prefixed by basePath, so write the
   slug explicitly. In `app/layout.tsx` use the Metadata API or plain tags:

   ```tsx
   export const metadata = {
     title: '<Name>',
     manifest: '/<slug>/manifest.webmanifest',
     appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '<Short>' },
     icons: { apple: '/<slug>/icon-192.png' },
   };
   export const viewport = {
     themeColor: '#0b0f17',
     width: 'device-width',
     initialScale: 1,
     viewportFit: 'cover',
   };
   ```

4. **Register the service worker** — copy `register-sw.tsx` (substituting the slug) into
   the app and render `<RegisterSW />` once in the root layout.

5. **Mobile-first** — design for a phone viewport first: large tap targets, no horizontal
   scroll, respect `env(safe-area-inset-*)`, `touch-action` where relevant.

## Static experiments (opt-in)
For a pure static experiment Caddy strips the `/<slug>/` prefix, so use **relative** asset
paths (`./style.css`, `./app.js`) and a `manifest.webmanifest` with `start_url`/`scope`
of `"./"` (or the explicit `/<slug>/`). Place `manifest.webmanifest`, `sw.js`, and icons
next to `index.html`.
