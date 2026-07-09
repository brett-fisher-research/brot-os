// brotd behavior against a fixture tree: crash-loop respawn with growing
// backoff, log capture, socket status, stop semantics, clean shutdown, stale
// socket recovery. The daemon runs as a real child process via tsx.

import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type StatusEntry, logFile, request, socketPath } from '../bin/services/control.js';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const BROTD = join(REPO, 'bin', 'services', 'brotd.ts');
const BACKOFF_BASE = 100;

let root: string;
let daemon: ChildProcess;

function write(rel: string, content: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

async function status(): Promise<StatusEntry[]> {
  const res = await request(socketPath(root), { cmd: 'status' });
  if (!res.ok || !res.services) throw new Error('status failed');
  return res.services;
}

async function waitFor<T>(fn: () => Promise<T | undefined>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const out = await fn().catch(() => undefined);
    if (out !== undefined) return out;
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 100));
  }
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'brotd-test-'));
  write(
    'services/crashy/crash.js',
    "console.log('crashy alive'); setTimeout(() => process.exit(1), 250);",
  );
  write('services/crashy/brot.service.json', JSON.stringify({ name: 'crashy', cmd: 'node crash.js' }));
  write(
    'services/steady/serve.js',
    "console.log('steady up'); setInterval(() => {}, 1000);",
  );
  write(
    'services/steady/brot.service.json',
    JSON.stringify({ name: 'steady', cmd: 'node serve.js', port: 3999 }),
  );
  // envy: repo-relative envFile (.env in its own repo), ../ traversal to a
  // sibling dir, and a missing file that must warn without blocking the spawn.
  write(
    'services/envy/show-env.js',
    "console.log('envy FROM_REPO=' + process.env.FROM_REPO + ' FROM_SIBLING=' + process.env.FROM_SIBLING); setInterval(() => {}, 1000);",
  );
  write('services/envy/.env', 'FROM_REPO=repo-value');
  write('services/shared/x.env', 'FROM_SIBLING=sibling-value');
  write(
    'services/envy/brot.service.json',
    JSON.stringify({
      name: 'envy',
      cmd: 'node show-env.js',
      envFile: ['.env', '../shared/x.env', 'missing.env'],
    }),
  );
  // localdef: inline local def, relative envFile resolves against the brot-os root.
  write('local.js', "console.log('localdef FROM_ROOT=' + process.env.FROM_ROOT); setInterval(() => {}, 1000);");
  write('local.env', 'FROM_ROOT=root-value');
  write(
    '.brot/services.local.json',
    JSON.stringify({
      enabled: ['crashy', 'steady', 'envy', 'localdef'],
      defs: [{ name: 'localdef', cmd: 'node local.js', envFile: 'local.env' }],
    }),
  );

  // Stale-socket recovery: a dead leftover socket file must not block startup.
  mkdirSync(dirname(socketPath(root)), { recursive: true });
  writeFileSync(socketPath(root), '');

  daemon = spawn(process.execPath, ['--import', 'tsx', BROTD], {
    cwd: REPO,
    env: {
      ...process.env,
      BROT_SERVICES_ROOT: root,
      BROTD_BACKOFF_BASE_MS: String(BACKOFF_BASE),
      BROTD_KILL_TIMEOUT_MS: '1000',
    },
    stdio: 'ignore',
  });
  await waitFor(async () => ((await status()).length > 0 ? true : undefined));
}, 30_000);

afterAll(async () => {
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    daemon.kill('SIGKILL');
  }
  rmSync(root, { recursive: true, force: true });
});

describe('brotd supervisor', () => {
  it('respawns a crash-loop service with a growing restart count and backoff', async () => {
    const entry = await waitFor(async () => {
      const s = (await status()).find((e) => e.name === 'crashy');
      return s && s.restarts >= 2 ? s : undefined;
    });
    expect(entry.restarts).toBeGreaterThanOrEqual(2);
    // backoffMs is the NEXT delay: base doubled once per restart, capped at 30s.
    expect(entry.backoffMs).toBe(Math.min(BACKOFF_BASE * 2 ** entry.restarts, 30_000));
    expect(entry.backoffMs).toBeGreaterThan(BACKOFF_BASE);
    expect(readFileSync(logFile(root, 'crashy'), 'utf8')).toContain('crashy alive');
  });

  it('reports a running service with pid, port, and its output in the log', async () => {
    const entry = await waitFor(async () => {
      const s = (await status()).find((e) => e.name === 'steady');
      return s && s.state === 'running' ? s : undefined;
    });
    expect(entry.pid).toBeGreaterThan(0);
    expect(entry.port).toBe(3999);
    expect(entry.enabled).toBe(true);
    await waitFor(async () =>
      readFileSync(logFile(root, 'steady'), 'utf8').includes('steady up') ? true : undefined,
    );
  });

  it('stop transitions a running service to stopped and clears its pid', async () => {
    const res = await request(socketPath(root), { cmd: 'stop', name: 'steady' }, 10_000);
    expect(res.ok).toBe(true);
    const entry = (await status()).find((e) => e.name === 'steady');
    expect(entry?.state).toBe('stopped');
    expect(entry?.pid).toBeNull();
  });

  it('stop freezes a crash loop (no further respawns)', async () => {
    const res = await request(socketPath(root), { cmd: 'stop', name: 'crashy' }, 10_000);
    expect(res.ok).toBe(true);
    const before = (await status()).find((e) => e.name === 'crashy');
    expect(before?.state).toBe('stopped');
    await new Promise((r) => setTimeout(r, 600));
    const after = (await status()).find((e) => e.name === 'crashy');
    expect(after?.state).toBe('stopped');
    expect(after?.restarts).toBe(before?.restarts);
  });

  it('resolves relative envFile paths against the service repo root, including ../ traversal', async () => {
    const out = await waitFor(async () => {
      const log = readFileSync(logFile(root, 'envy'), 'utf8');
      return log.includes('FROM_REPO=') ? log : undefined;
    });
    expect(out).toContain('FROM_REPO=repo-value');
    expect(out).toContain('FROM_SIBLING=sibling-value');
  });

  it('warns about a missing envFile in the service log and still starts the service', async () => {
    const entry = await waitFor(async () => {
      const s = (await status()).find((e) => e.name === 'envy');
      return s && s.state === 'running' ? s : undefined;
    });
    expect(entry.pid).toBeGreaterThan(0);
    const log = readFileSync(logFile(root, 'envy'), 'utf8');
    expect(log).toContain(`[brotd] envFile not found, skipped: ${join(root, 'services', 'envy', 'missing.env')}`);
  });

  it('resolves an inline local def envFile against the brot-os root', async () => {
    const out = await waitFor(async () => {
      const log = readFileSync(logFile(root, 'localdef'), 'utf8');
      return log.includes('FROM_ROOT=') ? log : undefined;
    });
    expect(out).toContain('FROM_ROOT=root-value');
  });

  it('rejects control commands for unknown services', async () => {
    const res = await request(socketPath(root), { cmd: 'start', name: 'nope' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('nope');
  });

  it('shutdown stops children, exits, and removes the socket', async () => {
    // start steady back up so shutdown has a live child to reap
    await request(socketPath(root), { cmd: 'start', name: 'steady' });
    const entry = await waitFor(async () => {
      const s = (await status()).find((e) => e.name === 'steady');
      return s?.state === 'running' && s.pid ? s : undefined;
    });
    const pid = entry.pid as number;

    const res = await request(socketPath(root), { cmd: 'shutdown' }, 10_000);
    expect(res.ok).toBe(true);
    await waitFor(async () => (daemon.exitCode !== null ? true : undefined));
    expect(existsSync(socketPath(root))).toBe(false);
    // the child process group is gone
    await waitFor(async () => {
      try {
        process.kill(pid, 0);
        return undefined;
      } catch {
        return true;
      }
    });
  });
});
