import { spawn } from 'node:child_process';
import { globSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

// Fold every bash assertion suite into the single vitest run: each tests/*.test.sh
// becomes one `it.concurrent` case. Each script owns an isolated mktemp fixture, so
// they share no state and run in parallel - the file's wall time is bounded by the
// slowest script, not the serial sum. Spawning async (not spawnSync) is what lets the
// cases overlap: a blocking spawnSync would pin the single worker thread and serialize
// them. A non-zero exit rejects with the script's stdout+stderr so the failing
// assertions show up in vitest output; a zero exit passes.
const here = dirname(fileURLToPath(import.meta.url));
const scripts = globSync(join(here, '*.test.sh')).sort();

function runBash(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [file]);
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${basename(file)} exited ${code}\n${out.trim()}`));
    });
  });
}

describe('bash suites', () => {
  for (const file of scripts) {
    it.concurrent(basename(file), () => runBash(file));
  }
});
