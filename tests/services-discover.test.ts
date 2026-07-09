import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalConfigError, discoverServices } from '../bin/services/discover.js';

const HOME = '/home/testuser';
const roots: string[] = [];

afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

// A fixture ROOT with tenant containers; write(path, value) drops JSON files into it.
function makeRoot(): { root: string; write: (rel: string, value: unknown) => void } {
  const root = mkdtempSync(join(tmpdir(), 'brot-services-'));
  roots.push(root);
  return {
    root,
    write(rel, value) {
      const p = join(root, rel);
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, JSON.stringify(value));
    },
  };
}

describe('discoverServices', () => {
  it('merges repo defs and inline local defs with correct sources and enablement', () => {
    const { root, write } = makeRoot();
    write('services/bookshelf/brot.service.json', { name: 'bookshelf', cmd: 'node server.js', port: 3010 });
    write('projects/dashboard/brot.service.json', { name: 'dashboard', cmd: 'node dist/index.js', port: 2999 });
    write('.brot/services.local.json', {
      enabled: ['bookshelf'],
      defs: [{ name: 'claude-remote', cmd: '~/bin/claude-remote --serve' }],
    });

    const out = discoverServices({ root, home: HOME });
    expect(out).toHaveLength(3);

    const byName = Object.fromEntries(out.map((s) => [s.def.name, s]));
    expect(byName.bookshelf.source).toBe('services/bookshelf');
    expect(byName.bookshelf.enabled).toBe(true);
    expect(byName.dashboard.source).toBe('projects/dashboard');
    expect(byName.dashboard.enabled).toBe(false);
    expect(byName['claude-remote'].source).toBe('local');
    expect(byName['claude-remote'].enabled).toBe(false);
    expect(byName['claude-remote'].def.cmd).toBe(`${HOME}/bin/claude-remote --serve`);

    expect(out.filter((s) => s.enabled)).toHaveLength(1);
  });

  it('missing services.local.json means nothing enabled, no crash', () => {
    const { root, write } = makeRoot();
    write('packages/notify/brot.service.json', { name: 'notify', cmd: 'node daemon.js' });

    const out = discoverServices({ root, home: HOME });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('packages/notify');
    expect(out[0].enabled).toBe(false);
  });

  it('an array def file yields one known service per entry, same source', () => {
    const { root, write } = makeRoot();
    write('projects/experiments/brot.service.json', [
      { name: 'frog-tour', cmd: 'npm run start', cwd: 'frog-tour', port: 3020 },
      { name: 'knight-moves', cmd: 'npm run start', cwd: 'knight-moves', port: 3021 },
    ]);
    write('.brot/services.local.json', { enabled: ['frog-tour', 'knight-moves'] });

    const out = discoverServices({ root, home: HOME });
    expect(out.map((s) => [s.def.name, s.source, s.enabled])).toEqual([
      ['frog-tour', 'projects/experiments', true],
      ['knight-moves', 'projects/experiments', true],
    ]);
  });

  it('ignores repos without a def file and non-container dirs', () => {
    const { root, write } = makeRoot();
    mkdirSync(join(root, 'services/no-def-here'), { recursive: true });
    write('experiments/rogue/brot.service.json', { name: 'rogue', cmd: 'x' }); // not a container
    write('dotfiles/nvim-conf/brot.service.json', { name: 'nvim-sync', cmd: 'node sync.js' });

    const out = discoverServices({ root, home: HOME });
    expect(out.map((s) => s.def.name)).toEqual(['nvim-sync']);
  });

  it('a malformed services.local.json rejects with LocalConfigError', () => {
    const { root, write } = makeRoot();
    write('.brot/services.local.json', { defs: [] }); // missing enabled
    expect(() => discoverServices({ root, home: HOME })).toThrow(LocalConfigError);
  });
});
