import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'api',
    globals: true,
    environment: 'node',
    root: import.meta.dirname,
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
