#!/usr/bin/env node
// brot-os tenant sync — the deterministic engine behind `npm run sync` and /brot-sync.
//
// Reads a manifest (JSON array of { dir, repo }) and, per entry:
//   - dir missing        -> git clone <repo> <dir>
//   - dir clean          -> fetch --prune, land on the default branch, ff to remote
//   - dir dirty          -> skip, flag `dirty` (never touch a dirty repo)
//   - tenant defines a `setup` npm script -> npm run setup --prefix <dir>
//
// Clean-repo recovery: a clone left on an orphaned feature branch (its upstream
// deleted after a merged --delete-branch PR) used to hard-fail `git pull --ff-only`.
// Instead we `git fetch --prune origin` (prune drops the dead remote-tracking ref),
// resolve the default branch from origin/HEAD (set-head then fall back to main),
// check it out if the clone drifted, and `git merge --ff-only` it up to the remote.
// A clean repo that genuinely diverged still surfaces as `failed`, never a silent pass.
// Then flags `unlisted`: subdirectories of any manifest-covered container dir
// (e.g. dotfiles/) that no manifest entry claims.
//
// Manifest path: ./sync.manifest.json next to the brot-os root, overridable via
// BROT_SYNC_MANIFEST. Entry dirs resolve relative to the manifest's directory,
// so test fixtures are self-contained.
//
// Exit code: non-zero only on hard failures (clone/pull/setup errors).
// dirty/unlisted are warnings and exit 0 — resolving them is /brot-sync's job.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(process.env.BROT_SYNC_MANIFEST ?? join(ROOT, 'sync.manifest.json'));
const BASE = dirname(manifestPath);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function git(dir, ...args) {
  return run('git', ['-C', dir, ...args]);
}

// The repo's default branch, from origin/HEAD; set it if unset, fall back to main.
function defaultBranch(dir) {
  let head = git(dir, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
  if (!head.ok) {
    git(dir, 'remote', 'set-head', 'origin', '-a');
    head = git(dir, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
  }
  return head.ok ? head.out.replace(/^origin\//, '') : 'main';
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`sync: cannot read manifest at ${manifestPath}: ${e.message}`);
  process.exit(1);
}

const results = []; // { dir, status: synced|cloned|dirty|failed, setup: ran|failed|none, detail }
let hardFailure = false;

for (const entry of manifest) {
  const dir = resolve(BASE, entry.dir);
  const res = { dir: entry.dir, status: '', setup: 'none', detail: '' };
  results.push(res);

  if (!existsSync(dir)) {
    const c = run('git', ['clone', entry.repo, dir]);
    if (!c.ok) {
      res.status = 'failed';
      res.detail = `clone: ${c.out.split('\n').pop()}`;
      hardFailure = true;
      continue;
    }
    res.status = 'cloned';
  } else {
    const st = git(dir, 'status', '--porcelain');
    if (!st.ok) {
      res.status = 'failed';
      res.detail = `not a git repo? ${st.out.split('\n').pop()}`;
      hardFailure = true;
      continue;
    }
    if (st.out !== '') {
      res.status = 'dirty';
      res.detail = 'uncommitted changes — skipped, resolve then re-run';
      continue;
    }
    // prune first: drops remote-tracking refs for branches deleted upstream,
    // the root of the "no such ref was fetched" failure on orphaned branches.
    const f = git(dir, 'fetch', '--prune', 'origin');
    if (!f.ok) {
      res.status = 'failed';
      res.detail = `fetch: ${f.out.split('\n').pop()}`;
      hardFailure = true;
      continue;
    }
    // land on the default branch — the clone may sit on an orphaned feature branch
    const def = defaultBranch(dir);
    const cur = git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');
    if (cur.ok && cur.out !== def) {
      const co = git(dir, 'checkout', def);
      if (!co.ok) {
        res.status = 'failed';
        res.detail = `checkout ${def}: ${co.out.split('\n').pop()}`;
        hardFailure = true;
        continue;
      }
    }
    // ff the default branch to the remote; a genuine divergence surfaces as failed
    const m = git(dir, 'merge', '--ff-only', `origin/${def}`);
    if (!m.ok) {
      res.status = 'failed';
      res.detail = `ff ${def}: ${m.out.split('\n').pop()}`;
      hardFailure = true;
      continue;
    }
    res.status = 'synced';
  }

  // idempotent per-tenant setup, when the tenant declares one
  const pkgPath = join(dir, 'package.json');
  if (existsSync(pkgPath)) {
    let pkg;
    try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { pkg = {}; }
    if (pkg.scripts?.setup) {
      const s = run('npm', ['run', 'setup', '--prefix', dir]);
      if (s.ok) {
        res.setup = 'ran';
      } else {
        res.setup = 'failed';
        res.detail = `setup: ${s.out.split('\n').pop()}`;
        hardFailure = true;
      }
    }
  }
}

// drift: dirs inside manifest-covered containers that no entry claims
const containers = [...new Set(manifest.map((e) => dirname(resolve(BASE, e.dir))))];
const listed = new Set(manifest.map((e) => resolve(BASE, e.dir)));
const unlisted = [];
for (const c of containers) {
  if (!existsSync(c)) continue;
  for (const name of readdirSync(c)) {
    const p = join(c, name);
    try {
      if (statSync(p).isDirectory() && !listed.has(resolve(p))) unlisted.push(join(c, name));
    } catch { /* vanished mid-scan */ }
  }
}

// report — one line per entry, machine-greppable
console.log('brot-os sync report');
console.log('-------------------');
for (const r of results) {
  const setup = r.setup === 'none' ? '' : ` setup=${r.setup}`;
  const detail = r.detail ? ` (${r.detail})` : '';
  console.log(`${r.status.padEnd(6)} ${r.dir}${setup}${detail}`);
}
for (const u of unlisted) console.log(`unlisted ${u} — exists on disk, not in manifest`);
const counts = results.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
console.log('-------------------');
console.log(
  `total ${results.length}: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}` +
  (unlisted.length ? `; ${unlisted.length} unlisted` : ''),
);

process.exit(hardFailure ? 1 : 0);
