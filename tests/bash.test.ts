import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

// Fold every bash assertion suite into the single vitest run: each tests/*.test.sh
// becomes one `it` case. A non-zero exit throws with the script's stdout+stderr so the
// failing assertions show up in vitest output; a zero exit is a pass.
const here = dirname(fileURLToPath(import.meta.url));
const scripts = globSync(join(here, '*.test.sh')).sort();

describe('bash suites', () => {
  for (const file of scripts) {
    it(basename(file), () => {
      const r = spawnSync('bash', [file], { encoding: 'utf8' });
      const detail = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
      if (r.status !== 0) {
        throw new Error(`${basename(file)} exited ${r.status}\n${detail}`);
      }
    });
  }
});
