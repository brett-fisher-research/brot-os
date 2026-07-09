// brotd - the brot-os service supervisor.
//
// Discovers services (discover.ts), spawns every enabled one, restarts crashed
// children with exponential backoff (cap 30s), appends child output to
// .logs/services/<name>.log (size-rotated to .log.1 past ~5MB), and answers a
// newline-delimited-JSON control protocol (status/start/stop/restart/shutdown)
// on a local socket - unix socket on posix, named pipe on win32 (control.ts).
//
// Cross-platform: children spawn via child_process with shell:true so bare
// commands resolve through PATH on every OS. On posix each child gets its own
// process group so stop kills the whole tree; on win32 child.kill() is used.
//
// Env knobs (tests): BROT_SERVICES_ROOT fixture root, BROTD_BACKOFF_BASE_MS
// backoff base (default 500), BROTD_KILL_TIMEOUT_MS SIGTERM->SIGKILL grace
// (default 3000).

import { type ChildProcess, spawn } from 'node:child_process';
import {
  type WriteStream,
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { type Server, type Socket, createServer } from 'node:net';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ControlRequest,
  type ControlResponse,
  type ServiceState,
  type StatusEntry,
  logDir,
  logFile,
  request,
  socketPath,
} from './control.js';
import { type KnownService, discoverServices } from './discover.js';

const BACKOFF_BASE_MS = Number(process.env.BROTD_BACKOFF_BASE_MS ?? 500);
const BACKOFF_CAP_MS = 30_000;
const KILL_TIMEOUT_MS = Number(process.env.BROTD_KILL_TIMEOUT_MS ?? 3000);
const STABLE_MS = 30_000; // uptime past this resets the backoff ladder
const ROTATE_BYTES = 5 * 1024 * 1024;

interface Managed {
  ks: KnownService;
  child: ChildProcess | null;
  log: WriteStream | null;
  state: ServiceState;
  desired: 'up' | 'down';
  restarts: number;
  backoffMs: number;
  lastExitCode: number | null;
  startedAt: number | null;
  timer: NodeJS.Timeout | null;
  stopWaiters: (() => void)[];
}

function rootDir(): string {
  return resolve(
    process.env.BROT_SERVICES_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'),
  );
}

// Minimal dotenv: KEY=VALUE lines, # comments and blanks skipped, optional
// single/double quotes stripped. Missing files are ignored.
export function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, '');
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// A service's repo root: the tenant dir for repo defs, the brot-os root for
// inline local defs. Everything path-like in a def (cwd, relative envFile
// entries) resolves against it.
export function serviceRepoRoot(ks: KnownService, root: string): string {
  return ks.source === 'local' ? root : join(root, ks.source);
}

export function serviceCwd(ks: KnownService, root: string): string {
  const repoRoot = serviceRepoRoot(ks, root);
  return ks.def.cwd ? resolve(repoRoot, ks.def.cwd) : repoRoot;
}

// Relative envFile paths resolve against the service's repo root (same base as
// cwd); absolute and ~-expanded paths pass through. A listed file that is
// missing warns via `warn` and is skipped; the spawn still proceeds.
export function buildEnv(
  ks: KnownService,
  root: string,
  warn: (line: string) => void = () => {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const file of ks.def.envFile ?? []) {
    const path = resolve(serviceRepoRoot(ks, root), file);
    if (!existsSync(path)) {
      warn(`envFile not found, skipped: ${path}`);
      continue;
    }
    Object.assign(env, parseEnvFile(readFileSync(path, 'utf8')));
  }
  Object.assign(env, ks.def.env);
  prependNodeDir(env);
  return env;
}

// Children must find the node that runs brotd. Under a minimal boot
// environment (systemd's PATH) the daemon's node dir (e.g. an nvm dir) is
// absent, so `node ...` cmds die with "node: not found". Prepend
// dirname(process.execPath) to whatever PATH the env/envFiles/def produced:
// their entries still win in order, the node dir just leads the list (deduped
// if already present). Win32 env keys are case-insensitive, so reuse the
// existing PATH-ish key.
export function prependNodeDir(
  env: NodeJS.ProcessEnv,
  nodeDir: string = dirname(process.execPath),
): void {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const parts = (env[key] ?? '').split(delimiter).filter((p) => p !== '' && p !== nodeDir);
  env[key] = [nodeDir, ...parts].join(delimiter);
}

class Supervisor {
  private readonly services = new Map<string, Managed>();
  private server: Server | null = null;
  private shuttingDown = false;

  constructor(private readonly root: string) {}

  private say(line: string): void {
    const stamped = `[${new Date().toISOString()}] ${line}`;
    console.log(stamped);
    try {
      appendFileSync(join(logDir(this.root), 'brotd.log'), `${stamped}\n`);
    } catch {
      // logging must never take the supervisor down
    }
  }

  private rotate(path: string): void {
    try {
      if (existsSync(path) && statSync(path).size > ROTATE_BYTES) {
        renameSync(path, `${path}.1`);
      }
    } catch {
      // rotation is best-effort
    }
  }

  private spawnService(m: Managed): void {
    const path = logFile(this.root, m.ks.def.name);
    this.rotate(path);
    const log = createWriteStream(path, { flags: 'a' });
    const env = buildEnv(m.ks, this.root, (line) => {
      log.write(`[brotd] ${line}\n`);
      console.error(`[${new Date().toISOString()}] ${m.ks.def.name}: ${line}`);
    });
    const child = spawn(m.ks.def.cmd, {
      shell: true,
      cwd: serviceCwd(m.ks, this.root),
      env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.pipe(log, { end: false });
    child.stderr?.pipe(log, { end: false });

    m.child = child;
    m.log = log;
    m.state = 'running';
    m.startedAt = Date.now();
    this.say(`${m.ks.def.name}: started (pid ${child.pid})`);

    child.on('error', (e) => log.write(`[brotd] spawn error: ${e.message}\n`));
    child.on('exit', (code, signal) => {
      const uptime = Date.now() - (m.startedAt ?? Date.now());
      m.lastExitCode = code;
      m.child = null;
      m.startedAt = null;
      log.end();
      m.log = null;
      this.say(`${m.ks.def.name}: exited (code ${code}, signal ${signal}, uptime ${uptime}ms)`);

      if (m.desired === 'down' || this.shuttingDown) {
        m.state = 'stopped';
        for (const wake of m.stopWaiters.splice(0)) wake();
        return;
      }
      if (uptime >= STABLE_MS) m.backoffMs = BACKOFF_BASE_MS;
      m.restarts += 1;
      m.state = 'backoff';
      this.say(`${m.ks.def.name}: respawning in ${m.backoffMs}ms (restart #${m.restarts})`);
      m.timer = setTimeout(() => {
        m.timer = null;
        if (m.desired === 'up' && !this.shuttingDown) this.spawnService(m);
      }, m.backoffMs);
      m.backoffMs = Math.min(m.backoffMs * 2, BACKOFF_CAP_MS);
    });
  }

  private killChild(m: Managed): void {
    const child = m.child;
    if (!child?.pid) return;
    m.state = 'stopping';
    const pid = child.pid;
    const signalGroup = (sig: NodeJS.Signals) => {
      try {
        if (process.platform === 'win32') child.kill();
        else process.kill(-pid, sig);
      } catch {
        try {
          child.kill(sig);
        } catch {
          // already gone
        }
      }
    };
    signalGroup('SIGTERM');
    const hardKill = setTimeout(() => {
      if (m.child === child) signalGroup('SIGKILL');
    }, KILL_TIMEOUT_MS);
    hardKill.unref();
  }

  private stopService(m: Managed): Promise<void> {
    m.desired = 'down';
    if (m.timer) {
      clearTimeout(m.timer);
      m.timer = null;
    }
    if (!m.child) {
      m.state = 'stopped';
      return Promise.resolve();
    }
    return new Promise((done) => {
      m.stopWaiters.push(done);
      this.killChild(m);
    });
  }

  private startService(m: Managed): void {
    m.desired = 'up';
    m.backoffMs = BACKOFF_BASE_MS;
    if (m.timer) {
      clearTimeout(m.timer);
      m.timer = null;
    }
    if (!m.child) this.spawnService(m);
  }

  private status(): StatusEntry[] {
    return [...this.services.values()].map((m) => ({
      name: m.ks.def.name,
      source: m.ks.source,
      enabled: m.ks.enabled,
      state: m.state,
      pid: m.child?.pid ?? null,
      port: m.ks.def.port ?? null,
      restarts: m.restarts,
      backoffMs: m.backoffMs,
      lastExitCode: m.lastExitCode,
      uptimeMs: m.startedAt === null ? null : Date.now() - m.startedAt,
    }));
  }

  // Shim launches set BROTD_VIA=shim; systemd's INVOCATION_ID covers units
  // installed before that env var existed.
  private daemonInfo(): { pid: number; via: 'shim' | 'detached' } {
    const viaShim = process.env.BROTD_VIA === 'shim' || Boolean(process.env.INVOCATION_ID);
    return { pid: process.pid, via: viaShim ? 'shim' : 'detached' };
  }

  private async handle(msg: ControlRequest): Promise<ControlResponse> {
    if (msg.cmd === 'status') {
      return { ok: true, services: this.status(), daemon: this.daemonInfo() };
    }
    if (msg.cmd === 'shutdown') {
      setImmediate(() => void this.shutdown());
      return { ok: true };
    }
    const m = this.services.get(msg.name);
    if (!m) return { ok: false, error: `unknown service "${msg.name}"` };
    if (msg.cmd === 'start') this.startService(m);
    else if (msg.cmd === 'stop') await this.stopService(m);
    else {
      await this.stopService(m);
      this.startService(m);
    }
    return { ok: true };
  }

  // A live brotd already owns the socket -> refuse to double-run. A dead
  // leftover socket file gets unlinked.
  private async clearStaleSocket(socket: string): Promise<void> {
    if (process.platform === 'win32' || !existsSync(socket)) return;
    try {
      await request(socket, { cmd: 'status' }, 1000);
      console.error(`brotd already running (socket ${socket})`);
      process.exit(1);
    } catch {
      unlinkSync(socket);
    }
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.say('shutting down');
    await Promise.all([...this.services.values()].map((m) => this.stopService(m)));
    this.server?.close();
    const socket = socketPath(this.root);
    if (process.platform !== 'win32' && existsSync(socket)) {
      try {
        unlinkSync(socket);
      } catch {
        // best-effort cleanup
      }
    }
    process.exit(0);
  }

  async run(): Promise<void> {
    mkdirSync(logDir(this.root), { recursive: true });
    for (const ks of discoverServices({ root: this.root })) {
      this.services.set(ks.def.name, {
        ks,
        child: null,
        log: null,
        state: 'stopped',
        desired: ks.enabled ? 'up' : 'down',
        restarts: 0,
        backoffMs: BACKOFF_BASE_MS,
        lastExitCode: null,
        startedAt: null,
        timer: null,
        stopWaiters: [],
      });
    }

    const socket = socketPath(this.root);
    await this.clearStaleSocket(socket);
    this.server = createServer((conn: Socket) => {
      let buf = '';
      conn.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        let nl = buf.indexOf('\n');
        while (nl !== -1) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          nl = buf.indexOf('\n');
          void (async () => {
            let res: ControlResponse;
            try {
              res = await this.handle(JSON.parse(line) as ControlRequest);
            } catch (e) {
              res = { ok: false, error: (e as Error).message };
            }
            if (!conn.destroyed) conn.write(`${JSON.stringify(res)}\n`);
          })();
        }
      });
      conn.on('error', () => conn.destroy());
    });
    this.server.listen(socket, () => {
      this.say(`brotd up, root ${this.root}, socket ${socket}`);
    });

    process.on('SIGTERM', () => void this.shutdown());
    process.on('SIGINT', () => void this.shutdown());

    for (const m of this.services.values()) {
      if (m.desired === 'up') this.spawnService(m);
    }
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  void new Supervisor(rootDir()).run();
}
