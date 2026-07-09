// Daemon-start routing is pure, so all three platform branches assert here on
// linux. Shim installed: start through the init system (it owns the process);
// no shim: the caller's detached-spawn fallback.

import { describe, expect, it } from 'vitest';

import { daemonStartPlan, shimMarkerPath } from '../bin/services/shim.js';

describe('daemon-start routing', () => {
  it('linux: shim present routes through systemctl --user start', () => {
    expect(daemonStartPlan('linux', '/home/u', true)).toEqual({
      kind: 'init',
      argv: ['systemctl', '--user', 'start', 'brotd.service'],
    });
  });

  it('darwin: shim present routes through launchctl load of the plist', () => {
    expect(daemonStartPlan('darwin', '/Users/u', true)).toEqual({
      kind: 'init',
      argv: ['launchctl', 'load', '-w', '/Users/u/Library/LaunchAgents/dev.brot.brotd.plist'],
    });
  });

  it('win32: shim present routes through schtasks /Run', () => {
    expect(daemonStartPlan('win32', 'C:\\Users\\u', true)).toEqual({
      kind: 'init',
      argv: ['schtasks', '/Run', '/TN', 'brotd'],
    });
  });

  it.each(['linux', 'darwin', 'win32'] as const)(
    '%s: no shim falls back to the detached spawn',
    (platform) => {
      expect(daemonStartPlan(platform, '/home/u', false)).toEqual({ kind: 'detached' });
    },
  );

  it('shim markers match what install-boot writes per platform', () => {
    expect(shimMarkerPath('linux', '/home/u')).toBe('/home/u/.config/systemd/user/brotd.service');
    expect(shimMarkerPath('darwin', '/Users/u')).toBe(
      '/Users/u/Library/LaunchAgents/dev.brot.brotd.plist',
    );
    expect(shimMarkerPath('win32', 'C:\\Users\\u')).toBe(
      'C:\\Users\\u\\AppData\\Local\\brot\\brotd.cmd',
    );
  });
});
