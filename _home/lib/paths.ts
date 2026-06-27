import path from 'node:path';

// The repo root is passed explicitly by the systemd unit (Environment=CLAUDE_EXPERIMENTS_ROOT)
// — the same env var bin/lib.sh honors. Falling back to ../ from the standalone server's cwd
// (WorkingDirectory=_home) only matters for `next dev` from this directory.
//
// Only the platform sidebar manifest is still read from the filesystem in-process (features.ts);
// the registry and bookshelf data now come from their standalone services (see registry.ts,
// books.ts), and ideas moved out to its own service entirely.
export const REPO_ROOT =
  process.env.CLAUDE_EXPERIMENTS_ROOT ?? path.resolve(process.cwd(), '..');

export const FEATURES_PATH = path.join(REPO_ROOT, 'data', 'platform-features.json');
