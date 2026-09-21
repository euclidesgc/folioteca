import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/api', 'apps/web'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
      },
      include: ['apps/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/generated/**',
        '**/types/**',
        '**/main.ts',
        '**/main.tsx',
        '**/src/testing/**',
        '**/__tests__/**',
        '**/test/**',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/*.config.{js,ts,mjs,cjs,mts}',
        '**/.{eslint,prettier}rc.{js,cjs,yml}',
      ],
    },
  },
});
