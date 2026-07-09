import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type Action } from '../bin/setup/core.js';
import { type RunResult, type Runner, executeActions } from '../bin/setup/effects.js';

// A fake runner that records every command and lets a test override specific results.
function fakeRunner(override?: (cmd: string, args: string[]) => RunResult | undefined) {
  const calls: string[][] = [];
  const runner: Runner = (cmd, args) => {
    calls.push([cmd, ...args]);
    return override?.(cmd, args) ?? { ok: true, out: '' };
  };
  return { runner, calls };
}

const tmps: string[] = [];
function tmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'brot-setup-'));
  tmps.push(d);
  return join(d, '.brot');
}
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('effects — create route (fake runner)', () => {
  it('runs init, add, commit, then gh repo create --push', () => {
    const dir = tmpDir();
    const { runner, calls } = fakeRunner();
    const actions: Action[] = [
      { kind: 'scaffold', dir },
      { kind: 'git-init', dir },
      { kind: 'commit', dir, message: 'Seed brot workspace' },
      { kind: 'gh-create', dir, name: 'brot-workspace', visibility: 'private' },
    ];
    const res = executeActions(actions, { runner });
    expect(res.ok).toBe(true);
    expect(calls).toEqual([
      ['git', '-C', dir, 'init', '-q'],
      ['git', '-C', dir, 'add', '-A'],
      ['git', '-C', dir, 'commit', '-q', '-m', 'Seed brot workspace'],
      ['gh', 'repo', 'create', 'brot-workspace', '--private', '--source', dir, '--remote', 'origin', '--push'],
    ]);
    // scaffold really wrote the skeleton
    expect(existsSync(join(dir, 'sync.manifest.json'))).toBe(true);
  });

  it('maps public visibility to --public', () => {
    const dir = tmpDir();
    const { runner, calls } = fakeRunner();
    executeActions([{ kind: 'gh-create', dir, name: 'w', visibility: 'public' }], { runner });
    expect(calls[0]).toContain('--public');
  });
});

describe('effects — point route (fake runner)', () => {
  it('empty clone: scaffolds, commits, and pushes', () => {
    const dir = tmpDir();
    // rev-parse HEAD fails -> empty repo
    const { runner, calls } = fakeRunner((cmd, args) =>
      args.includes('rev-parse') ? { ok: false, out: '' } : undefined,
    );
    const actions: Action[] = [
      { kind: 'clone', url: 'https://x/w.git', dir },
      { kind: 'seed-if-empty', dir },
    ];
    const res = executeActions(actions, { runner });
    expect(res.ok).toBe(true);
    expect(calls).toEqual([
      ['git', 'clone', 'https://x/w.git', dir],
      ['git', '-C', dir, 'rev-parse', 'HEAD'],
      ['git', '-C', dir, 'add', '-A'],
      ['git', '-C', dir, 'commit', '-q', '-m', 'Seed brot workspace'],
      ['git', '-C', dir, 'push', '-u', 'origin', 'HEAD'],
    ]);
    expect(existsSync(join(dir, 'sync.manifest.json'))).toBe(true);
  });

  it('populated clone: adopts as-is, no scaffold or push', () => {
    const dir = tmpDir();
    // rev-parse HEAD succeeds -> populated repo
    const { runner, calls } = fakeRunner();
    const res = executeActions(
      [
        { kind: 'clone', url: 'https://x/w.git', dir },
        { kind: 'seed-if-empty', dir },
      ],
      { runner },
    );
    expect(res.ok).toBe(true);
    expect(calls).toEqual([
      ['git', 'clone', 'https://x/w.git', dir],
      ['git', '-C', dir, 'rev-parse', 'HEAD'],
    ]);
    expect(res.messages).toContain('Adopted the existing workspace repo as-is.');
  });
});

describe('effects — abort short-circuits', () => {
  it('stops and returns ok=false', () => {
    const { runner, calls } = fakeRunner();
    const res = executeActions([{ kind: 'abort', reason: 'gh-unauthed' }], { runner });
    expect(res.ok).toBe(false);
    expect(calls).toEqual([]);
    expect(res.messages).toContain('setup aborted: gh-unauthed');
  });
});

describe('effects — local-only scaffold (real tmpdir)', () => {
  it('writes the full skeleton to disk', () => {
    const dir = tmpDir();
    executeActions([{ kind: 'scaffold', dir }]); // real runner unused by scaffold
    expect(readFileSync(join(dir, 'sync.manifest.json'), 'utf8')).toBe('[]\n');
    expect(existsSync(join(dir, 'plans/.gitkeep'))).toBe(true);
    expect(existsSync(join(dir, 'initiatives/.gitkeep'))).toBe(true);
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('scratchpad/');
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain('brot workspace');
  });

  it('never clobbers an existing file', () => {
    const dir = tmpDir();
    executeActions([{ kind: 'scaffold', dir }]);
    // hand-edit the manifest, re-scaffold: the edit must survive
    const p = join(dir, 'sync.manifest.json');
    const edited = '[{"dir":"x","repo":"y"}]\n';
    writeFileSync(p, edited);
    executeActions([{ kind: 'scaffold', dir }]);
    expect(readFileSync(p, 'utf8')).toBe(edited);
  });
});
