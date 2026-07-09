// Functional core for `npm run setup` — the interactive workspace bootstrapper.
// PURE: no git/gh/fs/network. `detectState` maps filesystem facts to a State;
// `planActions` maps (State, Answers) to a typed Action[] describing side effects as
// data. The thin shell (bin/setup.ts) gathers Answers; effects.ts runs the Action[].

export type State = 'absent' | 'unconfigured' | 'local' | 'configured';

// Filesystem facts about the `.brot` workspace dir, gathered by the shell.
export interface Facts {
  brotExists: boolean; // does <root>/.brot exist at all?
  isGitRepo: boolean; // is .brot its own git repo root?
  hasOrigin: boolean; // does that repo have an `origin` remote?
}

export function detectState(facts: Facts): State {
  if (!facts.brotExists) return 'absent';
  if (!facts.isGitRepo) return 'unconfigured'; // a plain dir (e.g. a leftover scaffold)
  return facts.hasOrigin ? 'configured' : 'local';
}

export type Route = 'create' | 'point' | 'local';

export interface Answers {
  dir: string; // absolute path to the .brot workspace
  route: Route;
  repoName?: string; // create
  visibility?: 'private' | 'public'; // create
  ghAuthed?: boolean; // create — is `gh` authenticated?
  cloneUrl?: string; // point
  origin?: string; // configured — the existing origin URL, for the status message
}

export type Action =
  | { kind: 'scaffold'; dir: string }
  | { kind: 'git-init'; dir: string }
  | { kind: 'commit'; dir: string; message: string }
  | { kind: 'gh-create'; dir: string; name: string; visibility: 'private' | 'public' }
  | { kind: 'clone'; url: string; dir: string }
  | { kind: 'seed-if-empty'; dir: string }
  | { kind: 'message'; text: string }
  | { kind: 'abort'; reason: string };

export const SEED_COMMIT = 'Seed brot workspace';

const LOCAL_MSG = 'Local-only workspace ready. Re-run `npm run setup` to attach a repo later.';

// The skeleton scaffolded into a fresh `.brot`. PURE data so core, effects, and tests
// share one source of truth. Effects writes each file (never clobbering an existing one).
export function skeleton(): { path: string; content: string }[] {
  return [
    { path: 'sync.manifest.json', content: '[]\n' },
    { path: 'plans/.gitkeep', content: '' },
    { path: 'initiatives/.gitkeep', content: '' },
    {
      path: '.gitignore',
      content: [
        '# the user\'s brot workspace — scratch and local cruft, never committed',
        'scratchpad/',
        '.obsidian/',
        '.trash/',
        '.DS_Store',
        'Thumbs.db',
        '*.log',
        '',
      ].join('\n'),
    },
    {
      path: 'README.md',
      content: [
        '# brot workspace',
        '',
        'The user\'s brot-os workspace layer — gitignored by brot-os, backed up as its own repo.',
        '',
        'Holds:',
        '- `sync.manifest.json` — tenant dir -> remote registry, read by `npm run sync`',
        '- `plans/` — plan archive (never deleted)',
        '- `initiatives/` — long-term goal trackers',
        '',
        'Driven from the brot-os root via skills and `npm run sync`; don\'t hand-edit mid-flow.',
        '',
      ].join('\n'),
    },
  ];
}

// Map (State, Answers) to a deterministic Action[]. Pure — same inputs, same output.
export function planActions(state: State, answers: Answers): Action[] {
  const { dir } = answers;

  // Already configured: never clobber. Print status; reconfiguring is a manual step.
  if (state === 'configured') {
    const origin = answers.origin ? ` (origin ${answers.origin})` : '';
    return [
      {
        kind: 'message',
        text: `.brot is already configured${origin} — nothing to do. Remove it manually to reconfigure.`,
      },
    ];
  }

  if (answers.route === 'point') {
    // Cloning needs an empty target; anything already on disk blocks it.
    if (state !== 'absent') return [{ kind: 'abort', reason: 'dir-exists' }];
    return [
      { kind: 'clone', url: answers.cloneUrl ?? '', dir },
      { kind: 'seed-if-empty', dir }, // empty remote -> scaffold + push; populated -> adopt
    ];
  }

  if (answers.route === 'create') {
    if (!answers.ghAuthed) return [{ kind: 'abort', reason: 'gh-unauthed' }];
    const ghCreate: Action = {
      kind: 'gh-create',
      dir,
      name: answers.repoName ?? 'brot-workspace',
      visibility: answers.visibility ?? 'private',
    };
    // local-only already has a repo — attach a remote to it, don't re-init.
    if (state === 'local') {
      return [{ kind: 'scaffold', dir }, { kind: 'commit', dir, message: SEED_COMMIT }, ghCreate];
    }
    return [
      { kind: 'scaffold', dir },
      { kind: 'git-init', dir },
      { kind: 'commit', dir, message: SEED_COMMIT },
      ghCreate,
    ];
  }

  // route === 'local'
  if (state === 'local') {
    return [{ kind: 'message', text: '.brot is already a local-only workspace. ' + LOCAL_MSG }];
  }
  return [
    { kind: 'scaffold', dir },
    { kind: 'git-init', dir },
    { kind: 'commit', dir, message: SEED_COMMIT },
    { kind: 'message', text: LOCAL_MSG },
  ];
}
