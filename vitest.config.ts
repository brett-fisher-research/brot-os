import { defineConfig } from 'vitest/config';

// Scope vitest to brot-os's own suites only. Tenant repos live in gitignored container
// dirs (projects/, services/, dotfiles/, packages/, .brot) and carry their
// own tests — they must never be swept into the OS-layer run.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Bash suites (folded in via tests/bash.test.ts) do real git clones per case;
    // give every test a generous ceiling so they never trip the 5s default.
    testTimeout: 120000,
    exclude: [
      '**/node_modules/**',
      'projects/**',
      'services/**',
      'dotfiles/**',
      'packages/**',
      '.brot/**',
    ],
  },
});
