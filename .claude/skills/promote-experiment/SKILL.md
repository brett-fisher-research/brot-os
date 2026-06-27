---
name: promote-experiment
description: Promote an existing experiment from the experiments repo into a first-class platform feature — graduate it into apps/ (optionally splitting it into a backend service + a frontend app), move it into the home dashboard so it shares the dashboard's layout/chrome, and add it to the platform sidebar. Use when the user says "/promote-experiment", "promote <slug>", "add <experiment> to the sidebar", "make <experiment> part of the platform", or wants an experiment elevated from scratch into the global nav.
argument-hint: "<slug> [label] [icon]"
allowed-tools: Bash Read Write Edit
---

# Promote an experiment to a platform feature

Promotion **moves an experiment into the home dashboard app** (`_home/app/<slug>/`) so it becomes a
route segment of `_home` rather than its own standalone service. This is the big idea: a promoted
experiment then shares the dashboard's root layout — the platform **sidebar chrome**, the shared
`<SubPage>` page header (the "← Home" link + standardized title), and the `.wrap` container — for
**free**, with no per-app injection. It also gets listed in the **platform sidebar** manifest
(`data/platform-features.json`, served via `/api/platform-features`).

After promotion the experiment is **no longer in `registry.json`** and has **no Caddy route / systemd
service** of its own: Caddy's root fallback already routes every unmatched path (including
`/<slug>/*`) to `_home` on port 2999. It will therefore no longer appear on the `/experiments`
registry page — it lives in the sidebar instead.

Promotion also **graduates the experiment out of the shared `experiments/` repo into `apps/`** —
where each project is its own git repo. Step 1b below is the key claude-os decision: **keep it as a
single frontend app, or split it into a backend service (`services/`) + a frontend app (`apps/`)**.

Read `~/claude-os/CLAUDE.md` (esp. the "Platform sidebar" section), `~/claude-os/services/CLAUDE.md`,
`~/claude-os/apps/CLAUDE.md`, and the target experiment's own `CLAUDE.md` for conventions before
moving code.

**Promotion moves and edits code, so it rides on a PR.** Before moving anything, invoke the **`/pr`**
skill to guard against unsaved work, branch off an up-to-date `main` (e.g. `feat/promote-<slug>`),
and set up the commit-at-every-step discipline. Commit each increment as you go; don't push or open
the PR here — that's `/raise`, then `/merge` once the user is happy.

## Steps

0. **Start the PR.** Invoke **`/pr`** with a `feat/promote-<slug>` branch. Everything below happens
   on that branch, committed step by step.

1. **Resolve the target.** The slug is in `$ARGUMENTS` (first token). Confirm it's a registered
   experiment (its source lives in `~/claude-os/experiments/<slug>/`) and not a worker:
   ```bash
   jq -r '.experiments["<slug>"] // "MISSING"' ~/claude-os/registry.json
   ```
   - `MISSING` → tell the user and stop (or offer `/new-experiment`).
   - `"type": "worker"` → workers have no web page; can't be a sidebar feature. Stop.
   - `"type": "static"` → a static app can't be a Next route segment as-is; flag it and stop unless
     the user wants it ported to Next (out of scope here).
   - Reserved slugs (`ideas`, `experiments`, `api`, `home`, …) are rejected by the script anyway.

1b. **ASK: split into a service + app, or keep as a single app?** This is the central claude-os
   promotion decision — surface it to the user before moving any code, with a recommendation:
   - **Split (service + app) — recommended when the experiment OWNS DATA others will want.** If the
     thing has a real data store that other surfaces should read/write (e.g. the home dashboard's
     "Currently reading" widget reading the bookshelf), the data belongs behind an **API**, not
     inside one frontend. Then:
       - Carve the data + API into a new **service** in `~/claude-os/services/<slug>/` (its own git
         repo, owns its `data/`, runs as a `systemd --user` unit on `127.0.0.1`, ships a
         `SERVICE_CONTRACT.md`). All reads/writes go through it.
       - The promoted **app** in `~/claude-os/apps/<slug>/` becomes *just another client* — its
         pages/components `fetch(...)` the service's API instead of touching data in-process.
       - Other consumers (the dashboard widget, other apps) call the same service API — one owner of
         the invariants. Migrate the experiment's existing data into the service's `data/` (snapshot
         first; never wipe a live store).
   - **Keep as a single app — fine when it owns no shared data.** A self-contained, mostly-stateless
     experiment (a game, a calculator, a viewer) just graduates to `~/claude-os/apps/<slug>/` as one
     Next app. No service.
   - In both cases the project **moves out of the `experiments/` repo** into its own repo under
     `apps/` (and `services/` for the split). Once landed under `apps/`, the steps below move that
     app's frontend into `_home/app/<slug>/` exactly as before — referring to "the app" means the
     `apps/<slug>/` copy (the single app, or the split frontend that calls the service).

2. **Pick label + icon** (only ask if genuinely ambiguous). Defaults are good:
   - `label`: title-cased slug (the script does this if omitted). The sidebar **label and the app's
     own page `<h1>` must match exactly, emoji included** (see step 3d) — pick one name, use it both
     places.
   - `icon`: prefer an **emoji** that reads cleanly at sidebar size and matches the one in the app's
     `<h1>` (e.g. `--icon "📚"` for a bookshelf whose `<h1>` is "📚 Bookshelf"). The script default is
     a neutral `📦` (promoted experiments no longer ship their own PWA icon).

3. **Move the app into the dashboard** (`apps/<slug>/` → `_home/app/<slug>/`). This is the heart of
   the skill; reconcile per-app, but the shape is always:
   - **a. Move the source.** Pages, components, `lib`, and `app/api/*` go under `_home/app/<slug>/`.
     The route prefix `/<slug>/` falls out **for free** from the directory nesting — **delete the
     app's `basePath`** (there is none in `_home`). Then **fix every path that relied on basePath**:
     `next/link` `href`s and `router.push(...)` that pointed at app-internal routes must now include
     the explicit `/<slug>` prefix (e.g. `href={\`/<slug>/book/${id}/\`}`, `router.push('/<slug>/')`).
     `fetch('/<slug>/api/...')` calls are already absolute — leave them.
   - **b. Convert the root layout → a nested segment layout** `_home/app/<slug>/layout.tsx`: **no
     `<html>/<body>`** (those come from `_home/app/layout.tsx`). Keep only `export const metadata`
     and a wrapper `<div className="<slug>">{children}</div>` that scopes the CSS. **Drop** the PWA
     bits (service worker, `manifest.webmanifest`, icons, `register-sw.tsx`) and the old sidebar
     injector (`platform-sidebar.tsx`, the `platform-chrome.css` `<link>`) — the root layout already
     provides the sidebar + chrome.
   - **c. Scope the app's CSS.** The dashboard and the app will collide on common class names
     (`.card`, `.grid`, `.section-head`) and on `--accent`/`--bg`/`--text` var **values**. Rename the
     app's `globals.css` → `_home/app/<slug>/<slug>.css`, move its `:root` vars and resets under the
     `.<slug>` wrapper, and **prefix every selector** with `.<slug> `. Import it **only** from the
     segment layout. ⚠️ Exclude the shared back link from any `a` reset
     (`.<slug> a:not(.platform-back) { … }`) or you'll clobber its platform-blue styling.
   - **d. Adopt the shared header.** Render each page through `_home/app/_components/SubPage.tsx`
     (`<SubPage title="📚 <Label>" sub=… actions=…>`). It emits the `.platform-back` "← Home" link as
     the first child of `<main>` (so the hamburger safe-area rule applies) + the standardized title
     row. The `<h1>` must equal the sidebar label including the emoji. Nested pages can point the
     back link elsewhere via `backHref`/`backLabel` (e.g. a detail page → `backHref="/<slug>/"`).
     The back link is now `next/link` (internal route), **not** a plain `<a>`.
   - **e. Wire shared packages.** If the app imports a `packages/*` module, add it to `_home` the same
     way the app did: `_home/.npmrc` with `install-links=true` (already present) and a `file:` dep in
     `_home/package.json` (e.g. `"@exp/books": "file:../packages/books"` — note the single `../`).
     Import it directly (`@exp/<name>`) in the segment's API routes — `@/lib/*` may already be taken
     by a dashboard module. Run `npm install` in `_home` to refresh the lockfile + copy the package.
   - **f. Server config.** If the app needs `trailingSlash`/`images.unoptimized`, set them in
     `_home/next.config.js` (they apply dashboard-wide — confirm that's acceptable).

4. **Add to the sidebar manifest** (deterministic part):
   ```bash
   ~/claude-os/bin/promote-experiment.sh <slug> [--label "Name"] [--icon "📚"]
   ```
   Idempotent (promoting twice = one entry).

5. **Rebuild the dashboard** — ships the new `/<slug>/` route on `_home` (port 2999):
   ```bash
   ~/claude-os/bin/rebuild-home.sh
   ```

6. **Tear down the old standalone service** (AFTER step 5, so `/<slug>/` never 404s):
   ```bash
   ~/claude-os/bin/unregister-experiment.sh <slug>
   ```
   This stops/removes `exp-<slug>.service`, drops the registry entry, and re-renders Caddy (the old
   `/<slug>/*` route disappears; the root fallback now serves it). Then remove the old `apps/<slug>/`
   directory.

7. **Verify in a real browser** (curl/build don't catch runtime errors). Load every affected page:
   ```bash
   node ~/claude-os/bin/console-check/check.mjs \
     https://intel-nuc.mullet-ostrich.ts.net/ \
     https://intel-nuc.mullet-ostrich.ts.net/<slug>/
   ```
   Confirm the sidebar opens on `/<slug>/` and highlights it, the shared "← Home" header matches the
   other pages, and the app's data/API still work. **If it reads/writes a live data store, snapshot
   it first and never wipe it.**

8. **Make sure everything is committed** on the PR branch from step 0 (one repo). Per `/pr`, never
   leave uncommitted work when you hand back. Don't push or open a PR here — the user runs
   **`/raise`** when they want it up, then **`/merge`** to land it.

## Demote
`bin/demote-experiment.sh <slug>` removes the sidebar manifest entry. The app stays a route segment
of `_home` (still reachable at `/<slug>/`) — it just leaves the global nav. To fully revert a promotion
you'd move the app back to `apps/<slug>/` and `register-experiment.sh` it again.
