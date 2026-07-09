// `services shutdown` via the CLI against a fixture daemon: stops children,
// the daemon process exits and its socket disappears; a second shutdown with
// no daemon running exits non-zero. Fixture root only - never the real brotd.

import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
let steadyPid: number;

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', CLI, ...args],
      { cwd: REPO, env: { ...process.env, BROT_SERVICES_ROOT: root } },
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

function write(rel: string, content: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'brot-shutdown-test-'));
  write('services/steady/serve.js', "console.log('steady up'); setInterval(() => {}, 1000);");
  write('services/steady/brot.service.json', JSON.stringify({ name: 'steady', cmd: 'node serve.js' }));
  write('.brot/services.local.json', JSON.stringify({ enabled: ['steady'] }));

  daemon = spawn(process.execPath, ['--import', 'tsx', BROTD], {
    cwd: REPO,
    env: { ...process.env, BROT_SERVICES_ROOT: root, BROTD_KILL_TIMEOUT_MS: '1000' },
    stdio: 'ignore',
  });
  await waitFor(async () => {
    const res = await request(socketPath(root), { cmd: 'status' }, 500);
    const steady = res.ok ? res.services?.find((s) => s.name === 'steady') : undefined;
    if (steady?.state === 'running' && steady.pid) {
      steadyPid = steady.pid;
      return true;
    }
    return false;
  });
}, 30_000);

afterAll(async () => {
  if (daemon && daemon.exitCode === null) daemon.kill('SIGKILL');
  rmSync(root, { recursive: true, force: true });
});

describe('services shutdown verb', () => {
  it('stops children and the daemon exits, socket gone', async () => {
    const { code, stdout } = await cli(['shutdown']);
    expect(code).toBe(0);
    expect(stdout).toContain('shutdown ok');

    await waitFor(async () => daemon.exitCode !== null);
    expect(existsSync(socketPath(root))).toBe(false);
    // the child process (group) is gone
    await waitFor(async () => {
      try {
        process.kill(steadyPid, 0);
        return false;
      } catch {
        return true;
      }
    });
  });

  it('exits non-zero when no daemon is running', async () => {
    const { code, stderr } = await cli(['shutdown']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('brotd is not running');
  });
});
