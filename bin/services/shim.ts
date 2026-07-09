// Boot-shim generation - pure. Given a platform and paths, produce the files
// to write, the commands to run, and human notes. The shim's ONLY job is
// launching brotd at login; brotd itself owns everything after that.
//
// Pure so all three platform branches unit-test on any OS; cli.ts install-boot
// does the actual writing/executing for the current platform only.

export type ShimPlatform = 'linux' | 'darwin' | 'win32';

export interface ShimInputs {
  platform: ShimPlatform;
  home: string; // target home dir (overridable for tests)
  repoRoot: string; // absolute brot-os root
  nodePath: string; // absolute node binary
  path: string; // PATH of the installing shell, baked into the shim so brotd
  // and its children see the human's PATH, not the init system's minimal one.
  // Re-running install-boot rewrites the shim, refreshing the baked value.
}

export interface ShimPlan {
  files: { path: string; content: string }[];
  commands: string[][]; // argv arrays, run in order after files are written
  notes: string[];
}

// Minimal XML escaping for text embedded in plist <string> values.
function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function linuxPlan({ home, repoRoot, nodePath, path }: ShimInputs): ShimPlan {
  const unit = [
    '[Unit]',
    'Description=brotd - brot-os service supervisor',
    '',
    '[Service]',
    `Environment=PATH=${path}`,
    `ExecStart=${nodePath} --import tsx ${repoRoot}/bin/services/brotd.ts`,
    `WorkingDirectory=${repoRoot}`,
    'Restart=on-failure',
    'RestartSec=5',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
  return {
    files: [{ path: `${home}/.config/systemd/user/brotd.service`, content: unit }],
    commands: [
      ['systemctl', '--user', 'daemon-reload'],
      ['systemctl', '--user', 'enable', 'brotd.service'],
      // restart, not `enable --now`: a reinstall must relaunch a running brotd
      // so it picks up the freshly baked PATH (restart also starts if stopped)
      ['systemctl', '--user', 'restart', 'brotd.service'],
    ],
    notes: [
      'run `loginctl enable-linger $USER` once so brotd starts at boot, not just at login',
    ],
  };
}

function darwinPlan({ home, repoRoot, nodePath, path }: ShimInputs): ShimPlan {
  const plistPath = `${home}/Library/LaunchAgents/dev.brot.brotd.plist`;
  const plist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key><string>dev.brot.brotd</string>',
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${nodePath}</string>`,
    '    <string>--import</string>',
    '    <string>tsx</string>',
    `    <string>${repoRoot}/bin/services/brotd.ts</string>`,
    '  </array>',
    `  <key>WorkingDirectory</key><string>${repoRoot}</string>`,
    '  <key>EnvironmentVariables</key>',
    '  <dict>',
    `    <key>PATH</key><string>${xmlEscape(path)}</string>`,
    '  </dict>',
    '  <key>RunAtLoad</key><true/>',
    `  <key>StandardOutPath</key><string>${repoRoot}/.logs/services/brotd-boot.log</string>`,
    `  <key>StandardErrorPath</key><string>${repoRoot}/.logs/services/brotd-boot.log</string>`,
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
  return {
    files: [{ path: plistPath, content: plist }],
    commands: [['launchctl', 'load', '-w', plistPath]],
    notes: [
      'reinstalling over a loaded agent: run `launchctl unload` then `launchctl load -w` (or log out/in) so launchd picks up the refreshed PATH',
    ],
  };
}

function win32Plan({ home, repoRoot, nodePath, path }: ShimInputs): ShimPlan {
  // Scheduled tasks can't carry env vars declaratively; the launcher cmd sets
  // PATH before exec instead, so a reinstall refreshing the file refreshes PATH.
  const cmdPath = `${home}\\AppData\\Local\\brot\\brotd.cmd`;
  const cmd = [
    '@echo off',
    `set "PATH=${path}"`,
    `cd /d "${repoRoot}"`,
    `"${nodePath}" --import tsx "${repoRoot}\\bin\\services\\brotd.ts"`,
    '',
  ].join('\r\n');
  return {
    files: [{ path: cmdPath, content: cmd }],
    commands: [
      ['schtasks', '/Create', '/F', '/SC', 'ONLOGON', '/TN', 'brotd', '/TR', `"${cmdPath}"`],
    ],
    notes: [],
  };
}

export function bootShimPlan(inputs: ShimInputs): ShimPlan {
  switch (inputs.platform) {
    case 'linux':
      return linuxPlan(inputs);
    case 'darwin':
      return darwinPlan(inputs);
    case 'win32':
      return win32Plan(inputs);
  }
}
