import { defineConfig } from 'vitest/config';

// Scope vitest to brot-os's own suites only. Tenant repos live in gitignored container
// dirs (projects/, services/, experiments/, dotfiles/, packages/, .brot) and carry their
// own tests — they must never be swept into the OS-layer run.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      'projects/**',
      'services/**',
      'experiments/**',
      'dotfiles/**',
      'packages/**',
      '.brot/**',
    ],
  },
});
