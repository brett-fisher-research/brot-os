import { describe, expect, it } from 'vitest';
import {
  type Action,
  type Answers,
  type State,
  SEED_COMMIT,
  detectState,
  planActions,
  skeleton,
} from '../bin/setup/core.js';

const DIR = '/ws/.brot';
const LOCAL_MSG = 'Local-only workspace ready. Re-run `npm run setup` to attach a repo later.';

function ans(partial: Partial<Answers>): Answers {
  return { dir: DIR, route: 'local', ...partial };
}

describe('detectState', () => {
  it('absent when .brot does not exist', () => {
    expect(detectState({ brotExists: false, isGitRepo: false, hasOrigin: false })).toBe('absent');
  });
  it('unconfigured when a plain dir (not a git repo)', () => {
    expect(detectState({ brotExists: true, isGitRepo: false, hasOrigin: false })).toBe('unconfigured');
  });
  it('local when a git repo without origin', () => {
    expect(detectState({ brotExists: true, isGitRepo: true, hasOrigin: false })).toBe('local');
  });
  it('configured when a git repo with origin', () => {
    expect(detectState({ brotExists: true, isGitRepo: true, hasOrigin: true })).toBe('configured');
  });
});

describe('planActions — configured (idempotent, never clobbers)', () => {
  for (const route of ['create', 'point', 'local'] as const) {
    it(`route=${route} yields a status message`, () => {
      const out = planActions('configured', ans({ route, origin: 'git@x:me/w.git' }));
      expect(out).toEqual([
        {
          kind: 'message',
          text: '.brot is already configured (origin git@x:me/w.git) — nothing to do. Remove it manually to reconfigure.',
        },
      ]);
    });
  }
  it('omits the origin clause when unknown', () => {
    const out = planActions('configured', ans({ route: 'local' }));
    expect(out[0]).toEqual({
      kind: 'message',
      text: '.brot is already configured — nothing to do. Remove it manually to reconfigure.',
    });
  });
});

describe('planActions — point route', () => {
  it('absent: clone then seed-if-empty', () => {
    const out = planActions('absent', ans({ route: 'point', cloneUrl: 'https://x/w.git' }));
    expect(out).toEqual<Action[]>([
      { kind: 'clone', url: 'https://x/w.git', dir: DIR },
      { kind: 'seed-if-empty', dir: DIR },
    ]);
  });
  for (const state of ['unconfigured', 'local'] as State[]) {
    it(`${state}: aborts (dir-exists) — will not clone over existing content`, () => {
      const out = planActions(state, ans({ route: 'point', cloneUrl: 'https://x/w.git' }));
      expect(out).toEqual([{ kind: 'abort', reason: 'dir-exists' }]);
    });
  }
});

describe('planActions — create route', () => {
  const base = { route: 'create', ghAuthed: true, repoName: 'brot-workspace', visibility: 'private' } as const;
  const ghCreate: Action = { kind: 'gh-create', dir: DIR, name: 'brot-workspace', visibility: 'private' };

  for (const state of ['absent', 'unconfigured'] as State[]) {
    it(`${state}: scaffold, init, commit, gh-create`, () => {
      const out = planActions(state, ans(base));
      expect(out).toEqual<Action[]>([
        { kind: 'scaffold', dir: DIR },
        { kind: 'git-init', dir: DIR },
        { kind: 'commit', dir: DIR, message: SEED_COMMIT },
        ghCreate,
      ]);
    });
  }
  it('local: attach remote to existing repo (no git-init)', () => {
    const out = planActions('local', ans(base));
    expect(out).toEqual<Action[]>([
      { kind: 'scaffold', dir: DIR },
      { kind: 'commit', dir: DIR, message: SEED_COMMIT },
      ghCreate,
    ]);
  });
  it('aborts when gh is not authenticated', () => {
    const out = planActions('absent', ans({ ...base, ghAuthed: false }));
    expect(out).toEqual([{ kind: 'abort', reason: 'gh-unauthed' }]);
  });
  it('defaults name and visibility when omitted', () => {
    const out = planActions('absent', ans({ route: 'create', ghAuthed: true }));
    expect(out.at(-1)).toEqual({ kind: 'gh-create', dir: DIR, name: 'brot-workspace', visibility: 'private' });
  });
  it('honors public visibility', () => {
    const out = planActions('absent', ans({ ...base, visibility: 'public' }));
    expect(out.at(-1)).toEqual({ kind: 'gh-create', dir: DIR, name: 'brot-workspace', visibility: 'public' });
  });
});

describe('planActions — local route', () => {
  for (const state of ['absent', 'unconfigured'] as State[]) {
    it(`${state}: scaffold, init, commit, message`, () => {
      const out = planActions(state, ans({ route: 'local' }));
      expect(out).toEqual<Action[]>([
        { kind: 'scaffold', dir: DIR },
        { kind: 'git-init', dir: DIR },
        { kind: 'commit', dir: DIR, message: SEED_COMMIT },
        { kind: 'message', text: LOCAL_MSG },
      ]);
    });
  }
  it('local: already local-only, message only', () => {
    const out = planActions('local', ans({ route: 'local' }));
    expect(out).toEqual([
      { kind: 'message', text: '.brot is already a local-only workspace. ' + LOCAL_MSG },
    ]);
  });
});

describe('skeleton', () => {
  it('seeds an empty manifest, dirs, gitignore, and readme', () => {
    const paths = skeleton().map((f) => f.path);
    expect(paths).toEqual([
      'sync.manifest.json',
      'plans/.gitkeep',
      'initiatives/.gitkeep',
      '.gitignore',
      'README.md',
    ]);
    expect(skeleton().find((f) => f.path === 'sync.manifest.json')?.content).toBe('[]\n');
    expect(skeleton().find((f) => f.path === '.gitignore')?.content).toContain('scratchpad/');
  });
});
