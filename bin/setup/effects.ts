// Effects layer for `npm run setup` — executes a typed Action[] via an INJECTABLE
// command runner (default runs real git/gh) plus fs. All decisions that depend on the
// world at run time (is a cloned repo empty?) live here; planning stays pure in core.ts.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Action, SEED_COMMIT, skeleton } from './core.js';

export interface RunResult {
  ok: boolean;
  out: string;
}

// Injectable so tests can assert the exact command sequence with a fake.
export type Runner = (cmd: string, args: string[], opts?: { cwd?: string }) => RunResult;

export const realRunner: Runner = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts,
  });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
};

export interface ExecOptions {
  runner?: Runner;
}

export interface ExecResult {
  ok: boolean;
  messages: string[];
}

// Write the skeleton into `dir`, never clobbering a file that already exists (idempotent).
function scaffold(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const f of skeleton()) {
    const p = join(dir, f.path);
    if (existsSync(p)) continue;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.content);
  }
}

export function executeActions(actions: Action[], opts: ExecOptions = {}): ExecResult {
  const runner = opts.runner ?? realRunner;
  const messages: string[] = [];
  const must = (r: RunResult, what: string) => {
    if (!r.ok) throw new Error(`${what} failed: ${r.out}`);
  };

  for (const a of actions) {
    switch (a.kind) {
      case 'message':
        messages.push(a.text);
        break;

      case 'abort':
        return { ok: false, messages: [...messages, `setup aborted: ${a.reason}`] };

      case 'scaffold':
        scaffold(a.dir);
        break;

      case 'git-init':
        must(runner('git', ['-C', a.dir, 'init', '-q']), 'git init');
        break;

      case 'commit':
        // stage everything, then commit; tolerate "nothing to commit" so re-runs pass.
        runner('git', ['-C', a.dir, 'add', '-A']);
        runner('git', ['-C', a.dir, 'commit', '-q', '-m', a.message]);
        break;

      case 'gh-create': {
        const vis = a.visibility === 'public' ? '--public' : '--private';
        // --source/--remote/--push: create the remote, add origin, push existing commits.
        must(
          runner('gh', [
            'repo',
            'create',
            a.name,
            vis,
            '--source',
            a.dir,
            '--remote',
            'origin',
            '--push',
          ]),
          'gh repo create',
        );
        messages.push(`Created ${a.visibility} repo ${a.name} and pushed the workspace.`);
        break;
      }

      case 'clone':
        must(runner('git', ['clone', a.url, a.dir]), 'git clone');
        break;

      case 'seed-if-empty': {
        // an empty clone has no HEAD commit — scaffold + push; otherwise adopt as-is.
        const head = runner('git', ['-C', a.dir, 'rev-parse', 'HEAD']);
        if (!head.ok) {
          scaffold(a.dir);
          runner('git', ['-C', a.dir, 'add', '-A']);
          runner('git', ['-C', a.dir, 'commit', '-q', '-m', SEED_COMMIT]);
          must(runner('git', ['-C', a.dir, 'push', '-u', 'origin', 'HEAD']), 'git push');
          messages.push('Cloned repo was empty — scaffolded and pushed the skeleton.');
        } else {
          messages.push('Adopted the existing workspace repo as-is.');
        }
        break;
      }
    }
  }
  return { ok: true, messages };
}
