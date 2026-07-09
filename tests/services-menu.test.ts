// The interactive menu core is pure: status snapshot in -> rendered choices
// out, picked action -> dispatch descriptor out. No TTY involved.

import { describe, expect, it } from 'vitest';

import type { StatusEntry } from '../bin/services/control.js';
import {
  actionChoices,
  colorEnabled,
  dispatch,
  headerLine,
  serviceChoices,
  serviceLabel,
} from '../bin/services/menu.js';

const ESC = '\u001b';

function entry(over: Partial<StatusEntry>): StatusEntry {
  return {
    name: 'svc',
    source: 'services/svc',
    enabled: false,
    state: 'stopped',
    pid: null,
    port: null,
    restarts: 0,
    backoffMs: 0,
    lastExitCode: null,
    uptimeMs: null,
    ...over,
  };
}

describe('menu core', () => {
  it('renders one choice per service plus refresh and quit, labels carrying state/pid/port', () => {
    const snap = {
      daemonUp: true,
      services: [
        entry({ name: 'bookshelf', state: 'running', enabled: true, pid: 4242, port: 3010 }),
        entry({ name: 'quiet' }),
      ],
    };
    const choices = serviceChoices(snap);
    expect(choices.map((c) => c.value)).toEqual([
      'bookshelf',
      'quiet',
      'refresh',
      'shutdown-daemon',
      'quit',
    ]);
    expect(choices[0].name).toContain('running');
    expect(choices[0].name).toContain('4242');
    expect(choices[0].name).toContain(':3010');
    expect(choices[1].name).toContain('stopped');
  });

  it('daemon down: "start brotd" leads the list, shutdown is absent', () => {
    const snap = { daemonUp: false, services: [entry({ name: 'quiet' })] };
    const choices = serviceChoices(snap);
    expect(choices.map((c) => c.value)).toEqual(['start-daemon', 'quiet', 'refresh', 'quit']);
    expect(choices[0].name).toBe('start brotd');
  });

  it('daemon up: no "start brotd" option, shutdown offered instead', () => {
    const snap = { daemonUp: true, services: [entry({ name: 'quiet' })] };
    expect(serviceChoices(snap).map((c) => c.value)).toEqual([
      'quiet',
      'refresh',
      'shutdown-daemon',
      'quit',
    ]);
  });

  it('offers stop/restart for running services and start for stopped ones', () => {
    const running = actionChoices(entry({ state: 'running', enabled: true })).map((c) => c.value);
    expect(running).toEqual(['stop', 'restart', 'disable', 'logs', 'back']);
    const stopped = actionChoices(entry({ state: 'stopped', enabled: false })).map((c) => c.value);
    expect(stopped).toEqual(['start', 'enable', 'logs', 'back']);
  });

  it('daemon down: control actions are hidden, logs and enablement remain', () => {
    const down = actionChoices(entry({ state: 'stopped', enabled: true }), false).map(
      (c) => c.value,
    );
    expect(down).toEqual(['disable', 'logs', 'back']);
  });

  it('dispatches each action to the right command descriptor', () => {
    expect(dispatch('start', 'svc')).toEqual({ kind: 'control', cmd: 'start', name: 'svc' });
    expect(dispatch('restart', 'svc')).toEqual({ kind: 'control', cmd: 'restart', name: 'svc' });
    expect(dispatch('enable', 'svc')).toEqual({ kind: 'set-enabled', enable: true, name: 'svc' });
    expect(dispatch('disable', 'svc')).toEqual({ kind: 'set-enabled', enable: false, name: 'svc' });
    expect(dispatch('logs', 'svc')).toEqual({ kind: 'logs', name: 'svc' });
    expect(dispatch('back', 'svc')).toEqual({ kind: 'none' });
  });
});

describe('header line', () => {
  it('states pid and launch route when brotd is up, green under color', () => {
    const snap = {
      daemonUp: true,
      daemon: { pid: 1234, via: 'shim' as const },
      services: [],
    };
    expect(headerLine(snap, false)).toBe('brotd: running (pid 1234, via shim)');
    const colored = headerLine(snap, true);
    expect(colored).toContain(`${ESC}[32m`);
    expect(colored).toContain('brotd: running (pid 1234, via shim)');
  });

  it('states not running when brotd is down, red under color', () => {
    const snap = { daemonUp: false, services: [] };
    expect(headerLine(snap, false)).toBe('brotd: not running');
    expect(headerLine(snap, true)).toContain(`${ESC}[31m`);
  });
});

describe('colors', () => {
  it('service labels: green running, red backoff/stopped-while-enabled, dim disabled', () => {
    expect(serviceLabel(entry({ state: 'running', enabled: true }), true)).toContain(`${ESC}[32m`);
    expect(serviceLabel(entry({ state: 'backoff', enabled: true }), true)).toContain(`${ESC}[31m`);
    expect(serviceLabel(entry({ state: 'stopped', enabled: true }), true)).toContain(`${ESC}[31m`);
    expect(serviceLabel(entry({ state: 'stopped', enabled: false }), true)).toContain(`${ESC}[90m`);
  });

  it('TTY snapshot carries ANSI codes; color off strips every escape', () => {
    const snap = {
      daemonUp: true,
      daemon: { pid: 7, via: 'detached' as const },
      services: [entry({ name: 'bookshelf', state: 'running', enabled: true })],
    };
    const colored = serviceChoices(snap, true).map((c) => c.name);
    expect(colored.some((n) => n.includes(ESC))).toBe(true);
    const plain = serviceChoices(snap, false).map((c) => c.name);
    expect(plain.every((n) => !n.includes(ESC))).toBe(true);
    expect(headerLine(snap, false)).not.toContain(ESC);
  });

  it('colorEnabled: TTY only, and NO_COLOR always wins', () => {
    expect(colorEnabled(true, {})).toBe(true);
    expect(colorEnabled(true, { NO_COLOR: '1' })).toBe(false);
    expect(colorEnabled(true, { NO_COLOR: '' })).toBe(false);
    expect(colorEnabled(false, {})).toBe(false);
  });
});
