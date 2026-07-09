// Child PATH prepend: brotd children must find the node that runs the daemon
// even when brotd itself was launched under a minimal boot environment
// (systemd shim PATH without the nvm dir). Unit-tests prependNodeDir ordering
// and dedupe, then proves the behavior end to end: a daemon spawned with a
// PATH that cannot resolve `node` still starts a `node -e ...` service.

import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prependNodeDir } from '../bin/services/brotd.js';
import { type StatusEntry, logFile, request, socketPath } from '../bin/services/control.js';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const BROTD = join(REPO, 'bin', 'services', 'brotd.ts');
const NODE_DIR = dirname(process.execPath);

describe('prependNodeDir', () => {
  it('prepends the node dir to an existing PATH', () => {
    const env: NodeJS.ProcessEnv = { PATH: `/usr/bin${delimiter}/bin` };
    prependNodeDir(env, '/opt/node/bin');
    expect(env.PATH).toBe(`/opt/node/bin${delimiter}/usr/bin${delimiter}/bin`);
  });

  it('dedupes when the node dir is already on PATH, keeping it first', () => {
    const env: NodeJS.ProcessEnv = { PATH: `/usr/bin${delimiter}/opt/node/bin${delimiter}/bin` };
    prependNodeDir(env, '/opt/node/bin');
    expect(env.PATH).toBe(`/opt/node/bin${delimiter}/usr/bin${delimiter}/bin`);
  });

  it('sets PATH when the env has none', () => {
    const env: NodeJS.ProcessEnv = {};
    prependNodeDir(env, '/opt/node/bin');
    expect(env.PATH).toBe('/opt/node/bin');
  });

  it('reuses a differently-cased PATH key (win32 env semantics)', () => {
    const env: NodeJS.ProcessEnv = { Path: '/usr/bin' };
    prependNodeDir(env, '/opt/node/bin');
    expect(env.Path).toBe(`/opt/node/bin${delimiter}/usr/bin`);
    expect(Object.keys(env)).toEqual(['Path']);
  });
});

describe('brotd child PATH (stripped daemon environment)', () => {
  let root: string;
  let daemon: ChildProcess;
  let strippedPath: string;

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
    root = mkdtempSync(join(tmpdir(), 'brot-path-test-'));
    // an existing dir with no node in it: the daemon's entire PATH
    strippedPath = join(root, 'empty-bin');
    mkdirSync(strippedPath, { recursive: true });

    const dir = join(root, 'services', 'pathy');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'brot.service.json'),
      JSON.stringify({
        name: 'pathy',
        cmd: `node -e "console.log('pathy PATH=' + process.env.PATH); setInterval(() => {}, 1000)"`,
      }),
    );
    mkdirSync(join(root, '.brot'), { recursive: true });
    writeFileSync(join(root, '.brot', 'services.local.json'), JSON.stringify({ enabled: ['pathy'] }));

    // Spawn brotd itself with a PATH that cannot resolve `node` - the shape of
    // the systemd boot shim environment that broke migration.
    daemon = spawn(process.execPath, ['--import', 'tsx', BROTD], {
      cwd: REPO,
      env: {
        ...process.env,
        PATH: strippedPath,
        BROT_SERVICES_ROOT: root,
        BROTD_KILL_TIMEOUT_MS: '1000',
      },
      stdio: 'ignore',
    });
    await waitFor(async () => ((await status()).length > 0 ? true : undefined));
  }, 30_000);

  afterAll(async () => {
    try {
      await request(socketPath(root), { cmd: 'shutdown' }, 3000);
    } catch {
      daemon?.kill('SIGKILL');
    }
    await new Promise((r) => setTimeout(r, 300));
    rmSync(root, { recursive: true, force: true });
  });

  it('starts a plain `node -e` service despite the daemon PATH lacking node', async () => {
    const entry = await waitFor(async () => {
      const s = (await status()).find((e) => e.name === 'pathy');
      return s?.state === 'running' && s.pid ? s : undefined;
    });
    expect(entry.pid).toBeGreaterThan(0);
    // never crash-looped on "node: not found"
    expect(entry.restarts).toBe(0);
    expect(entry.lastExitCode).toBeNull();
  });

  it("gives the child a PATH led by the daemon's node dir, stripped entries preserved after it", async () => {
    const log = await waitFor(async () => {
      const out = readFileSync(logFile(root, 'pathy'), 'utf8');
      return out.includes('pathy PATH=') ? out : undefined;
    });
    const line = log.split('\n').find((l) => l.includes('pathy PATH='));
    const childPath = (line ?? '').slice((line ?? '').indexOf('pathy PATH=') + 'pathy PATH='.length);
    expect(childPath.split(delimiter)[0]).toBe(NODE_DIR);
    expect(childPath.split(delimiter)).toContain(strippedPath);
  });
});
