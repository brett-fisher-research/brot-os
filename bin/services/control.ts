// Shared plumbing between brotd and the services CLI: where the control socket
// and per-service logs live, plus a tiny newline-delimited-JSON request client.
//
// Socket: unix socket under the root's .logs/services/ run dir on posix, a
// named pipe (\\.\pipe\brotd-<hash>) on win32 so both sides agree without a
// filesystem path.

import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { join } from 'node:path';

export function logDir(root: string): string {
  return join(root, '.logs', 'services');
}

export function logFile(root: string, name: string): string {
  return join(logDir(root), `${name}.log`);
}

export function socketPath(root: string): string {
  if (process.platform === 'win32') {
    const hash = createHash('sha1').update(root).digest('hex').slice(0, 12);
    return `\\\\.\\pipe\\brotd-${hash}`;
  }
  return join(logDir(root), 'brotd.sock');
}

export type ServiceState = 'running' | 'backoff' | 'stopping' | 'stopped';

export interface StatusEntry {
  name: string;
  source: string;
  enabled: boolean;
  state: ServiceState;
  pid: number | null;
  port: number | null;
  restarts: number;
  backoffMs: number;
  lastExitCode: number | null;
  uptimeMs: number | null;
}

export type ControlRequest =
  | { cmd: 'status' }
  | { cmd: 'start' | 'stop' | 'restart'; name: string }
  | { cmd: 'shutdown' };

export type ControlResponse =
  | { ok: true; services?: StatusEntry[] }
  | { ok: false; error: string };

// One request, one JSON-line response, then hang up.
export function request(
  socket: string,
  msg: ControlRequest,
  timeoutMs = 5000,
): Promise<ControlResponse> {
  return new Promise((resolve, reject) => {
    const conn = createConnection(socket);
    let buf = '';
    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error('control request timed out'));
    }, timeoutMs);
    conn.on('connect', () => conn.write(`${JSON.stringify(msg)}\n`));
    conn.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      const nl = buf.indexOf('\n');
      if (nl === -1) return;
      clearTimeout(timer);
      conn.end();
      try {
        resolve(JSON.parse(buf.slice(0, nl)) as ControlResponse);
      } catch (e) {
        reject(e as Error);
      }
    });
    conn.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}
