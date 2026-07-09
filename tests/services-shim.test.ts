// Boot-shim generation is pure, so all three platform branches assert here on
// linux. Nothing is installed - content and install paths only.

import { describe, expect, it } from 'vitest';

import { bootShimPlan } from '../bin/services/shim.js';

const NODE = '/usr/local/bin/node';
const REPO = '/home/u/brot-os';

describe('boot shim generation', () => {
  it('linux: systemd user unit at ~/.config/systemd/user, enable commands, linger note', () => {
    const plan = bootShimPlan({ platform: 'linux', home: '/home/u', repoRoot: REPO, nodePath: NODE });
    expect(plan.files).toHaveLength(1);
    expect(plan.files[0].path).toBe('/home/u/.config/systemd/user/brotd.service');
    expect(plan.files[0].content).toContain(
      `ExecStart=${NODE} --import tsx ${REPO}/bin/services/brotd.ts`,
    );
    expect(plan.files[0].content).toContain(`WorkingDirectory=${REPO}`);
    expect(plan.files[0].content).toContain('WantedBy=default.target');
    expect(plan.commands).toEqual([
      ['systemctl', '--user', 'daemon-reload'],
      ['systemctl', '--user', 'enable', '--now', 'brotd.service'],
    ]);
    expect(plan.notes.join(' ')).toContain('enable-linger');
  });

  it('darwin: launchd plist at ~/Library/LaunchAgents, loaded via launchctl', () => {
    const plan = bootShimPlan({
      platform: 'darwin',
      home: '/Users/u',
      repoRoot: REPO,
      nodePath: NODE,
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
