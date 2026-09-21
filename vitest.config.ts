import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/api'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
      },
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/generated/**',
        '**/main.ts',
        '**/main.tsx',
        '**/src/testing/**',
        '**/test/**',
        '**/*.d.ts',
        '**/*.config.{js,ts,mjs,cjs}',
        '**/.{eslint,prettier}rc.{js,cjs,yml}',
      ],
    },
  },
});
