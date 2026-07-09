// Interactive-menu core - pure. Status snapshot in, choices out; a picked
// action maps to a dispatch descriptor cli.ts executes. No TTY, no inquirer
// imports here, so the whole menu brain unit-tests headless.

import type { StatusEntry } from './control.js';

export interface Snapshot {
  daemonUp: boolean;
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

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

export function serviceLabel(s: StatusEntry): string {
  const bits = [
    pad(s.name, 24),
    pad(s.state, 9),
    pad(s.enabled ? 'enabled' : 'disabled', 9),
    pad(s.pid === null ? '-' : String(s.pid), 8),
    s.port === null ? '' : `:${s.port}`,
  ];
  return bits.join(' ').trimEnd();
}

// Top-level picker: one entry per service plus refresh/quit, and shutdown of
// the daemon itself when one is actually running.
export function serviceChoices(
  snap: Snapshot,
): Choice<string | 'refresh' | 'shutdown-daemon' | 'quit'>[] {
  const rows: Choice<string | 'refresh' | 'shutdown-daemon' | 'quit'>[] = snap.services.map(
    (s) => ({ name: serviceLabel(s), value: s.name }),
  );
  rows.push({ name: 'refresh', value: 'refresh' });
  if (snap.daemonUp) rows.push({ name: 'shutdown brotd (stop everything)', value: 'shutdown-daemon' });
  rows.push({ name: 'quit', value: 'quit' });
  return rows;
}

// Per-service action picker, shaped by current state + enablement.
export function actionChoices(s: StatusEntry): Choice<MenuAction>[] {
  const out: Choice<MenuAction>[] = [];
  if (s.state === 'running' || s.state === 'backoff') {
    out.push({ name: 'stop', value: 'stop' }, { name: 'restart', value: 'restart' });
  } else {
    out.push({ name: 'start', value: 'start' });
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
