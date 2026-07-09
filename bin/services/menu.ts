// Interactive-menu core - pure. Status snapshot in, choices out; a picked
// action maps to a dispatch descriptor cli.ts executes. No TTY, no inquirer
// imports here, so the whole menu brain unit-tests headless.
//
// Color is a plain boolean the caller computes (colorEnabled below): raw ANSI,
// no deps, off when stdout is not a TTY or NO_COLOR is set. Non-interactive
// verbs never pass color=true - plain text stays the AI/grep face.

import type { DaemonInfo, StatusEntry } from './control.js';

export interface Snapshot {
  daemonUp: boolean;
  daemon?: DaemonInfo;
  services: StatusEntry[];
}

export interface Choice<V> {
  name: string; // rendered label
  value: V;
}

export type MenuAction =
  | 'start'
  | 'stop'
  | 'restart'
  | 'enable'
  | 'disable'
  | 'logs'
  | 'back';

export type Dispatch =
  | { kind: 'control'; cmd: 'start' | 'stop' | 'restart'; name: string }
  | { kind: 'set-enabled'; enable: boolean; name: string }
  | { kind: 'logs'; name: string }
  | { kind: 'none' };

export function colorEnabled(isTTY: boolean, env: NodeJS.ProcessEnv): boolean {
  return isTTY && env.NO_COLOR === undefined;
}

const ANSI = { green: '32', red: '31', dim: '90' } as const;

function paint(s: string, code: keyof typeof ANSI, on: boolean): string {
  return on ? `\u001b[${ANSI[code]}m${s}\u001b[0m` : s;
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

// green running, red backoff or stopped-while-enabled, dim gray disabled.
function stateColor(s: StatusEntry): keyof typeof ANSI {
  if (s.state === 'running') return 'green';
  if (s.state === 'backoff' || s.enabled) return 'red';
  return 'dim';
}

// One line stating brotd itself, always shown at the top of the menu.
export function headerLine(snap: Snapshot, color: boolean): string {
  if (!snap.daemonUp) return paint('brotd: not running', 'red', color);
  const pid = snap.daemon?.pid ?? '?';
  const via = snap.daemon?.via ?? 'detached';
  return paint(`brotd: running (pid ${pid}, via ${via})`, 'green', color);
}

export function serviceLabel(s: StatusEntry, color = false): string {
  const bits = [
    pad(s.name, 24),
    paint(`● ${pad(s.state, 9)}`, stateColor(s), color),
    pad(s.enabled ? 'enabled' : 'disabled', 9),
    pad(s.pid === null ? '-' : String(s.pid), 8),
    s.port === null ? '' : `:${s.port}`,
  ];
  return bits.join(' ').trimEnd();
}

// Top-level picker: one entry per service plus refresh/quit. Daemon down:
// "start brotd" leads the list; daemon up: shutdown is offered.
export function serviceChoices(
  snap: Snapshot,
  color = false,
): Choice<string | 'start-daemon' | 'refresh' | 'shutdown-daemon' | 'quit'>[] {
  const rows: Choice<string | 'start-daemon' | 'refresh' | 'shutdown-daemon' | 'quit'>[] = [];
  if (!snap.daemonUp) rows.push({ name: 'start brotd', value: 'start-daemon' });
  for (const s of snap.services) rows.push({ name: serviceLabel(s, color), value: s.name });
  rows.push({ name: 'refresh', value: 'refresh' });
  if (snap.daemonUp) rows.push({ name: 'shutdown brotd (stop everything)', value: 'shutdown-daemon' });
  rows.push({ name: 'quit', value: 'quit' });
  return rows;
}

// Per-service action picker, shaped by current state + enablement. Control
// actions (start/stop/restart) need a live daemon; they are hidden until
// brotd is up. Logs and enable/disable work daemon-down.
export function actionChoices(s: StatusEntry, daemonUp = true): Choice<MenuAction>[] {
  const out: Choice<MenuAction>[] = [];
  if (daemonUp) {
    if (s.state === 'running' || s.state === 'backoff') {
      out.push({ name: 'stop', value: 'stop' }, { name: 'restart', value: 'restart' });
    } else {
      out.push({ name: 'start', value: 'start' });
    }
  }
  out.push(
    s.enabled
      ? { name: 'disable (drop from boot set)', value: 'disable' }
      : { name: 'enable (add to boot set)', value: 'enable' },
    { name: 'tail logs', value: 'logs' },
    { name: 'back', value: 'back' },
  );
  return out;
}

export function dispatch(action: MenuAction, name: string): Dispatch {
  switch (action) {
    case 'start':
    case 'stop':
    case 'restart':
      return { kind: 'control', cmd: action, name };
    case 'enable':
      return { kind: 'set-enabled', enable: true, name };
    case 'disable':
      return { kind: 'set-enabled', enable: false, name };
    case 'logs':
      return { kind: 'logs', name };
    case 'back':
      return { kind: 'none' };
  }
}
