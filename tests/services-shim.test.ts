// Boot-shim generation is pure, so all three platform branches assert here on
// linux. Nothing is installed - content and install paths only.

import { describe, expect, it } from 'vitest';

import { bootShimPlan } from '../bin/services/shim.js';

const NODE = '/usr/local/bin/node';
const REPO = '/home/u/brot-os';
const PATH_A = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
const PATH_B = '/home/u/.local/bin:/usr/bin:/bin';

describe('boot shim generation', () => {
  it('linux: systemd user unit at ~/.config/systemd/user, enable+restart commands, linger note', () => {
    const plan = bootShimPlan({
      platform: 'linux',
      home: '/home/u',
      repoRoot: REPO,
      nodePath: NODE,
      path: PATH_A,
    });
    expect(plan.files).toHaveLength(1);
    expect(plan.files[0].path).toBe('/home/u/.config/systemd/user/brotd.service');
    expect(plan.files[0].content).toContain(
      `ExecStart=${NODE} --import tsx ${REPO}/bin/services/brotd.ts`,
    );
    expect(plan.files[0].content).toContain(`WorkingDirectory=${REPO}`);
    expect(plan.files[0].content).toContain('WantedBy=default.target');
    expect(plan.commands).toEqual([
      ['systemctl', '--user', 'daemon-reload'],
      ['systemctl', '--user', 'enable', 'brotd.service'],
      ['systemctl', '--user', 'restart', 'brotd.service'],
    ]);
    expect(plan.notes.join(' ')).toContain('enable-linger');
  });

  it('darwin: launchd plist at ~/Library/LaunchAgents, loaded via launchctl', () => {
    const plan = bootShimPlan({
      platform: 'darwin',
      home: '/Users/u',
      repoRoot: REPO,
      nodePath: NODE,
      path: PATH_A,
    });
    expect(plan.files[0].path).toBe('/Users/u/Library/LaunchAgents/dev.brot.brotd.plist');
    expect(plan.files[0].content).toContain('<string>dev.brot.brotd</string>');
    expect(plan.files[0].content).toContain(`<string>${NODE}</string>`);
    expect(plan.files[0].content).toContain(`<string>${REPO}/bin/services/brotd.ts</string>`);
    expect(plan.files[0].content).toContain('<key>RunAtLoad</key><true/>');
    expect(plan.commands).toEqual([
      ['launchctl', 'load', '-w', '/Users/u/Library/LaunchAgents/dev.brot.brotd.plist'],
    ]);
  });

  it('win32: launcher cmd under AppData plus a schtasks ONLOGON task', () => {
    const plan = bootShimPlan({
      platform: 'win32',
      home: 'C:\\Users\\u',
      repoRoot: 'C:\\brot-os',
      nodePath: 'C:\\node\\node.exe',
      path: 'C:\\node;C:\\Windows\\system32',
    });
    expect(plan.files[0].path).toBe('C:\\Users\\u\\AppData\\Local\\brot\\brotd.cmd');
    expect(plan.files[0].content).toContain('cd /d "C:\\brot-os"');
    expect(plan.files[0].content).toContain(
      '"C:\\node\\node.exe" --import tsx "C:\\brot-os\\bin\\services\\brotd.ts"',
    );
    const task = plan.commands[0];
    expect(task[0]).toBe('schtasks');
    expect(task).toContain('/Create');
    expect(task).toContain('ONLOGON');
    expect(task).toContain('"C:\\Users\\u\\AppData\\Local\\brot\\brotd.cmd"');
  });
});

describe('boot shim bakes the installer PATH', () => {
  it('linux: unit carries Environment=PATH=<installer PATH>', () => {
    const plan = bootShimPlan({
      platform: 'linux',
      home: '/home/u',
      repoRoot: REPO,
      nodePath: NODE,
      path: PATH_A,
    });
    expect(plan.files[0].content).toContain(`Environment=PATH=${PATH_A}`);
  });

  it('darwin: plist carries EnvironmentVariables/PATH', () => {
    const plan = bootShimPlan({
      platform: 'darwin',
      home: '/Users/u',
      repoRoot: REPO,
      nodePath: NODE,
      path: PATH_A,
    });
    expect(plan.files[0].content).toContain('<key>EnvironmentVariables</key>');
    expect(plan.files[0].content).toContain(`<key>PATH</key><string>${PATH_A}</string>`);
  });

  it('darwin: PATH is XML-escaped inside the plist', () => {
    const plan = bootShimPlan({
      platform: 'darwin',
      home: '/Users/u',
      repoRoot: REPO,
      nodePath: NODE,
      path: '/opt/a&b/bin:/usr/bin',
    });
    expect(plan.files[0].content).toContain(
      '<key>PATH</key><string>/opt/a&amp;b/bin:/usr/bin</string>',
    );
  });

  it('win32: launcher cmd sets PATH before exec (schtasks carries no env)', () => {
    const plan = bootShimPlan({
      platform: 'win32',
      home: 'C:\\Users\\u',
      repoRoot: 'C:\\brot-os',
      nodePath: 'C:\\node\\node.exe',
      path: 'C:\\node;C:\\tools\\bin;C:\\Windows\\system32',
    });
    const lines = plan.files[0].content.split('\r\n');
    const setIdx = lines.indexOf('set "PATH=C:\\node;C:\\tools\\bin;C:\\Windows\\system32"');
    const execIdx = lines.findIndex((l) => l.includes('brotd.ts'));
    expect(setIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeLessThan(execIdx);
  });

  it.each(['linux', 'darwin', 'win32'] as const)(
    '%s: regenerating with a different PATH swaps it (reinstall refreshes)',
    (platform) => {
      const base = {
        home: platform === 'win32' ? 'C:\\Users\\u' : '/home/u',
        repoRoot: platform === 'win32' ? 'C:\\brot-os' : REPO,
        nodePath: platform === 'win32' ? 'C:\\node\\node.exe' : NODE,
      };
      const first = bootShimPlan({ platform, ...base, path: PATH_A });
      const second = bootShimPlan({ platform, ...base, path: PATH_B });
      expect(first.files[0].path).toBe(second.files[0].path); // same file, updated in place
      expect(first.files[0].content).toContain(PATH_A);
      expect(first.files[0].content).not.toContain(PATH_B);
      expect(second.files[0].content).toContain(PATH_B);
      expect(second.files[0].content).not.toContain(PATH_A);
    },
  );
});
