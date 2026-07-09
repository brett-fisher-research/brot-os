// Non-interactive CLI behavior against a fixture daemon: status table, logs
// tail (daemon-independent), stop via socket, enable/disable file edits, and
// non-zero exits on unknown names.

import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { request, socketPath } from '../bin/services/control.js';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const BROTD = join(REPO, 'bin', 'services', 'brotd.ts');
const CLI = join(REPO, 'bin', 'services', 'cli.ts');

let root: string;
let daemon: ChildProcess;

function write(base: string, rel: string, content: string): void {
  const path = join(base, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(fixtureRoot: string, args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', CLI, ...args],
      { cwd: REPO, env: { ...process.env, BROT_SERVICES_ROOT: fixtureRoot } },
      (err, stdout, stderr) => {
        resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout, stderr });
      },
    );
  });
}

async function waitFor(fn: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await fn().catch(() => false))) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 100));
  }
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'brot-cli-test-'));
  write(root, 'services/steady/serve.js', "console.log('steady up'); setInterval(() => {}, 1000);");
  write(
    root,
    'services/steady/brot.service.json',
    JSON.stringify({ name: 'steady', cmd: 'node serve.js', port: 3998 }),
  );
  // quiet: known but disabled; its log is pre-seeded so `logs` is deterministic
  write(root, 'services/quiet/brot.service.json', JSON.stringify({ name: 'quiet', cmd: 'node -e 0' }));
  write(
    root,
    '.logs/services/quiet.log',
    Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n') + '\n',
  );
  write(root, '.brot/services.local.json', JSON.stringify({ enabled: ['steady'] }));

  daemon = spawn(process.execPath, ['--import', 'tsx', BROTD], {
    cwd: REPO,
    env: { ...process.env, BROT_SERVICES_ROOT: root, BROTD_KILL_TIMEOUT_MS: '1000' },
    stdio: 'ignore',
  });
  await waitFor(async () => {
    const res = await request(socketPath(root), { cmd: 'status' }, 500);
    return res.ok && (res.services ?? []).some((s) => s.name === 'steady' && s.state === 'running');
  });
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

describe('services CLI', () => {
  it('status prints the table with live daemon state', async () => {
    const { code, stdout } = await cli(root, ['status']);
    expect(code).toBe(0);
    expect(stdout).toContain('NAME');
    expect(stdout).toContain('RESTARTS');
    const steadyRow = stdout.split('\n').find((l) => l.startsWith('steady'));
    expect(steadyRow).toBeDefined();
    expect(steadyRow).toContain('running');
    expect(steadyRow).toContain('3998');
    const quietRow = stdout.split('\n').find((l) => l.startsWith('quiet'));
    expect(quietRow).toContain('stopped');
  });

  it('logs <name> -n 5 prints exactly the last 5 lines, daemon not required', async () => {
    const { code, stdout } = await cli(root, ['logs', 'quiet', '-n', '5']);
    expect(code).toBe(0);
    expect(stdout).toBe('line 6\nline 7\nline 8\nline 9\nline 10\n');
  });

  it('stop <name> stops the service via the socket', async () => {
    const { code } = await cli(root, ['stop', 'steady']);
    expect(code).toBe(0);
    const res = await request(socketPath(root), { cmd: 'status' });
    if (!res.ok) throw new Error('status failed');
    const steady = res.services?.find((s) => s.name === 'steady');
    expect(steady?.state).toBe('stopped');
  });

  it('exits non-zero on unknown service names and unknown verbs', async () => {
    expect((await cli(root, ['logs', 'nope'])).code).not.toBe(0);
    expect((await cli(root, ['stop', 'nope'])).code).not.toBe(0);
    expect((await cli(root, ['frobnicate'])).code).not.toBe(0);
  });

  // Fixture roots never match the OS root, so daemon-start takes the detached
  // fallback here even on a host with a real boot shim installed.
  it('daemon-start brings brotd up detached in a fresh root; status then reports it', async () => {
    const fresh = mkdtempSync(join(tmpdir(), 'brot-cli-ds-'));
    try {
      write(fresh, 'services/svc/brot.service.json', JSON.stringify({ name: 'svc', cmd: 'node -e 0' }));

      const started = await cli(fresh, ['daemon-start']);
      expect(started.code).toBe(0);
      expect(started.stdout).toContain('brotd: started (via detached)');

      const status = await cli(fresh, ['status']);
      expect(status.code).toBe(0);
      expect(status.stdout).toMatch(/brotd: running \(pid \d+, via detached\)/);

      const again = await cli(fresh, ['daemon-start']);
      expect(again.code).toBe(0);
      expect(again.stdout).toContain('brotd: already running');
    } finally {
      await cli(fresh, ['shutdown']);
      await new Promise((r) => setTimeout(r, 300));
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it('enable/disable edit the local enabled list, creating the file if missing', async () => {
    const fresh = mkdtempSync(join(tmpdir(), 'brot-cli-en-'));
    try {
      write(fresh, 'services/svc/brot.service.json', JSON.stringify({ name: 'svc', cmd: 'node -e 0' }));
      const localPath = join(fresh, '.brot', 'services.local.json');
      expect(existsSync(localPath)).toBe(false);

      expect((await cli(fresh, ['enable', 'svc'])).code).toBe(0);
      expect(JSON.parse(readFileSync(localPath, 'utf8')).enabled).toEqual(['svc']);

      expect((await cli(fresh, ['disable', 'svc'])).code).toBe(0);
      expect(JSON.parse(readFileSync(localPath, 'utf8')).enabled).toEqual([]);

      expect((await cli(fresh, ['enable', 'nope'])).code).not.toBe(0);
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });
});
