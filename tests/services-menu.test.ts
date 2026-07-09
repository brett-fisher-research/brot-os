// The interactive menu core is pure: status snapshot in -> rendered choices
// out, picked action -> dispatch descriptor out. No TTY involved.

import { describe, expect, it } from 'vitest';

import type { StatusEntry } from '../bin/services/control.js';
import { actionChoices, dispatch, serviceChoices } from '../bin/services/menu.js';

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

  it('offers daemon shutdown only when brotd is up', () => {
    const snap = { daemonUp: false, services: [entry({ name: 'quiet' })] };
    expect(serviceChoices(snap).map((c) => c.value)).toEqual(['quiet', 'refresh', 'quit']);
  });

  it('offers stop/restart for running services and start for stopped ones', () => {
    const running = actionChoices(entry({ state: 'running', enabled: true })).map((c) => c.value);
    expect(running).toEqual(['stop', 'restart', 'disable', 'logs', 'back']);
    const stopped = actionChoices(entry({ state: 'stopped', enabled: false })).map((c) => c.value);
    expect(stopped).toEqual(['start', 'enable', 'logs', 'back']);
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
