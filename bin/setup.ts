#!/usr/bin/env node
// `npm run setup` — the interactive brot workspace bootstrapper (thin shell).
// All logic lives in bin/setup/core.ts (pure) and bin/setup/effects.ts (effects); this
// file only wires @inquirer prompts to gather Answers, then plans and executes.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirm, input, select } from '@inquirer/prompts';
import {
  type Answers,
  type Facts,
  type Route,
  detectState,
  planActions,
} from './setup/core.js';
import { executeActions, realRunner } from './setup/effects.js';

const ROOT = resolve(
  process.env.BROT_SYNC_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'),
);
const dir = join(ROOT, '.brot');

function gatherFacts(): Facts {
  const brotExists = existsSync(dir);
  if (!brotExists) return { brotExists: false, isGitRepo: false, hasOrigin: false };
  const top = realRunner('git', ['-C', dir, 'rev-parse', '--show-toplevel']);
  const isGitRepo = top.ok && existsSync(join(dir, '.git'));
  const hasOrigin = isGitRepo && realRunner('git', ['-C', dir, 'remote', 'get-url', 'origin']).ok;
  return { brotExists, isGitRepo, hasOrigin };
}

async function main(): Promise<number> {
  const facts = gatherFacts();
  const state = detectState(facts);

  if (state === 'configured') {
    const origin = realRunner('git', ['-C', dir, 'remote', 'get-url', 'origin']).out;
    const answers: Answers = { dir, route: 'local', origin };
    const res = executeActions(planActions(state, answers));
    for (const m of res.messages) console.log(m);
    return 0;
  }

  console.log(`brot workspace setup — target: ${dir}`);
  if (state === 'unconfigured') console.log('note: .brot exists as a plain dir; it will be initialized in place.');
  if (state === 'local') console.log('note: .brot is a local-only git repo (no remote).');

  let route = (await select<Route>({
    message: 'How do you want to set up the workspace?',
    choices: [
      { name: 'Create a new GitHub repo', value: 'create' },
      { name: 'Point at an existing repo (clone)', value: 'point' },
      { name: 'Local-only (no remote yet)', value: 'local' },
    ],
  })) as Route;

  const answers: Answers = { dir, route };

  if (route === 'create') {
    const ghAuthed = realRunner('gh', ['auth', 'status']).ok;
    if (!ghAuthed) {
      const fallback = await confirm({
        message: 'gh is not authenticated. Fall back to a local-only workspace?',
        default: true,
      });
      if (!fallback) {
        console.log('Run `gh auth login`, then re-run `npm run setup`.');
        return 1;
      }
      route = 'local';
      answers.route = 'local';
    } else {
      answers.ghAuthed = true;
      answers.repoName = await input({ message: 'Repo name:', default: 'brot-workspace' });
      answers.visibility = await select<'private' | 'public'>({
        message: 'Visibility:',
        choices: [
          { name: 'private', value: 'private' },
          { name: 'public', value: 'public' },
        ],
      });
    }
  }

  if (route === 'point') {
    answers.cloneUrl = await input({ message: 'Existing repo URL to clone:' });
  }

  const res = executeActions(planActions(state, answers), { runner: realRunner });
  for (const m of res.messages) console.log(m);
  return res.ok ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
