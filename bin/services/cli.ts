// `npm run services` - the one front door to brotd.
//
// Bare invocation: interactive @inquirer/prompts loop for the human. With a
// verb: plain greppable text for the AI:
//
//   status                     table: name, enabled, state, pid, port, restarts
//   logs <name> [-n N]         last N log lines (default 200), works daemon-down
//   start|stop|restart <name>  via the control socket; auto-starts brotd if down
//   enable|disable <name>      edit .brot/services.local.json enabled list
//   shutdown                   stop all children cleanly, then brotd exits
//   install-boot               idempotent per-OS login shim that launches brotd
//
// Exits non-zero on unknown services, unknown verbs, and failed actions.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ControlRequest,
  type StatusEntry,
  logFile,
  request,
  socketPath,
} from './control.js';
import { LOCAL_FILE, discoverServices } from './discover.js';
import { type Dispatch, type Snapshot, actionChoices, dispatch, serviceChoices } from './menu.js';
import { bootShimPlan } from './shim.js';

const OS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function rootDir(): string {
  return resolve(process.env.BROT_SERVICES_ROOT ?? OS_ROOT);
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function daemonStatus(root: string, timeoutMs = 1500): Promise<StatusEntry[] | null> {
  try {
    const res = await request(socketPath(root), { cmd: 'status' }, timeoutMs);
    if (res.ok && res.services) return res.services;
    return null;
  } catch {
    return null;
  }
}

// The status picture even when brotd is down: discovery gives the roster,
// every service reads stopped.
function offlineStatus(root: string): StatusEntry[] {
  return discoverServices({ root }).map((ks) => ({
    name: ks.def.name,
    source: ks.source,
    enabled: ks.enabled,
    state: 'stopped' as const,
    pid: null,
    port: ks.def.port ?? null,
    restarts: 0,
    backoffMs: 0,
    lastExitCode: null,
    uptimeMs: null,
  }));
}

async function snapshot(root: string): Promise<Snapshot> {
  const live = await daemonStatus(root);
  if (live) return { daemonUp: true, services: live };
  return { daemonUp: false, services: offlineStatus(root) };
}

// Launch brotd detached (survives this CLI) and wait for its socket.
async function ensureDaemon(root: string): Promise<void> {
  if (await daemonStatus(root, 500)) return;
  const brotd = join(OS_ROOT, 'bin', 'services', 'brotd.ts');
  const child = spawn(process.execPath, ['--import', 'tsx', brotd], {
    cwd: OS_ROOT, // tsx resolves from brot-os's node_modules
    env: { ...process.env, BROT_SERVICES_ROOT: root },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await daemonStatus(root, 500)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  fail('brotd did not come up within 10s');
}

function requireKnown(root: string, name: string): void {
  const known = discoverServices({ root });
  if (!known.some((ks) => ks.def.name === name)) {
    fail(`unknown service "${name}" (known: ${known.map((k) => k.def.name).join(', ') || 'none'})`);
  }
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function printStatus(snap: Snapshot): void {
  if (!snap.daemonUp) console.log('brotd: not running (states below assume stopped)');
  const header = ['NAME', 'ENABLED', 'STATE', 'PID', 'PORT', 'RESTARTS'];
  const rows = snap.services.map((s) => [
    s.name,
    s.enabled ? 'yes' : 'no',
    s.state,
    s.pid === null ? '-' : String(s.pid),
    s.port === null ? '-' : String(s.port),
    String(s.restarts),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  for (const row of [header, ...rows]) {
    console.log(row.map((cell, i) => pad(cell, widths[i])).join('  ').trimEnd());
  }
}

function tailLines(path: string, n: number): string[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-n);
}

function cmdLogs(root: string, args: string[]): void {
  const name = args[0];
  if (!name) fail('usage: services logs <name> [-n N]');
  requireKnown(root, name);
  let n = 200;
  const flag = args.indexOf('-n');
  if (flag !== -1) {
    n = Number(args[flag + 1]);
    if (!Number.isInteger(n) || n <= 0) fail('-n takes a positive integer');
  }
  for (const line of tailLines(logFile(root, name), n)) console.log(line);
}

async function cmdControl(root: string, cmd: 'start' | 'stop' | 'restart', name?: string): Promise<void> {
  if (!name) fail(`usage: services ${cmd} <name>`);
  requireKnown(root, name);
  await ensureDaemon(root);
  const res = await request(socketPath(root), { cmd, name } as ControlRequest, 15_000);
  if (!res.ok) fail(res.error);
  console.log(`${name}: ${cmd} ok`);
}

// Ask a running brotd to stop all children and exit. No daemon -> non-zero;
// never starts one just to kill it.
async function cmdShutdown(root: string): Promise<void> {
  if ((await daemonStatus(root)) === null) fail('brotd is not running');
  const res = await request(socketPath(root), { cmd: 'shutdown' }, 15_000);
  if (!res.ok) fail(res.error);
  console.log('brotd: shutdown ok (all services stopping, daemon exiting)');
}

interface LocalConfig {
  enabled: string[];
  [key: string]: unknown;
}

function setEnabled(root: string, name: string, enable: boolean): void {
  requireKnown(root, name);
  const path = join(root, LOCAL_FILE);
  let cfg: LocalConfig = { enabled: [] };
  if (existsSync(path)) cfg = JSON.parse(readFileSync(path, 'utf8')) as LocalConfig;
  const set = new Set(cfg.enabled ?? []);
  if (enable) set.add(name);
  else set.delete(name);
  cfg.enabled = [...set].sort();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
  console.log(`${name}: ${enable ? 'enabled' : 'disabled'} (${path})`);
  console.log('note: brotd reads enablement at startup; restart it (or `start`/`stop` directly) to apply now');
}

function cmdInstallBoot(): void {
  const platform = process.platform;
  if (platform !== 'linux' && platform !== 'darwin' && platform !== 'win32') {
    fail(`install-boot: unsupported platform ${platform}`);
  }
  const plan = bootShimPlan({
    platform,
    home: process.env.BROT_BOOT_HOME ?? homedir(),
    repoRoot: OS_ROOT,
    nodePath: process.execPath,
  });
  for (const file of plan.files) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content);
    console.log(`wrote ${file.path}`);
  }
  for (const argv of plan.commands) {
    console.log(`running: ${argv.join(' ')}`);
    const res = spawnSync(argv[0], argv.slice(1), { stdio: 'inherit' });
    if (res.status !== 0) fail(`command failed: ${argv.join(' ')}`);
  }
  for (const note of plan.notes) console.log(`note: ${note}`);
}

async function runDispatch(root: string, d: Dispatch): Promise<void> {
  if (d.kind === 'control') {
    await cmdControl(root, d.cmd, d.name);
  } else if (d.kind === 'set-enabled') {
    setEnabled(root, d.name, d.enable);
  } else if (d.kind === 'logs') {
    const lines = tailLines(logFile(root, d.name), 20);
    console.log(lines.length ? lines.join('\n') : '(no log output yet)');
  }
}

async function interactive(root: string): Promise<void> {
  const { select } = await import('@inquirer/prompts');
  for (;;) {
    const snap = await snapshot(root);
    if (!snap.daemonUp) console.log('brotd: not running (actions will auto-start it)');
    if (snap.services.length === 0) {
      console.log('no services discovered');
      return;
    }
    const picked = await select({ message: 'services', choices: serviceChoices(snap), pageSize: 20 });
    if (picked === 'quit') return;
    if (picked === 'refresh') continue;
    if (picked === 'shutdown-daemon') {
      await cmdShutdown(root);
      return;
    }
    const svc = snap.services.find((s) => s.name === picked);
    if (!svc) continue;
    const action = await select({ message: svc.name, choices: actionChoices(svc) });
    await runDispatch(root, dispatch(action, svc.name));
  }
}

async function main(): Promise<void> {
  const root = rootDir();
  const [verb, ...args] = process.argv.slice(2);
  switch (verb) {
    case undefined:
      await interactive(root);
      break;
    case 'status':
      printStatus(await snapshot(root));
      break;
    case 'logs':
      cmdLogs(root, args);
      break;
    case 'start':
    case 'stop':
    case 'restart':
      await cmdControl(root, verb, args[0]);
      break;
    case 'enable':
      if (!args[0]) fail('usage: services enable <name>');
      setEnabled(root, args[0], true);
      break;
    case 'disable':
      if (!args[0]) fail('usage: services disable <name>');
      setEnabled(root, args[0], false);
      break;
    case 'shutdown':
      await cmdShutdown(root);
      break;
    case 'install-boot':
      cmdInstallBoot();
      break;
    default:
      fail(`unknown verb "${verb}" (status|logs|start|stop|restart|enable|disable|shutdown|install-boot)`);
  }
}

void main();
