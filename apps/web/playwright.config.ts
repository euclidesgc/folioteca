import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const baseURL = `http://localhost:${PORT}`;

// The production bundle, built and served by `vite preview`: the only place
// the build's chunk split runs (bug 199). Still the mocked API.
const PRODUCTION_PORT = 5175;
const productionBaseURL = `http://localhost:${PRODUCTION_PORT}`;
const PRODUCTION_BUILD_SPEC = /production-build\.spec\.ts/;
// Ignored by git and by the lint (`dist`), never the deploy output.
const PRODUCTION_OUT_DIR = 'e2e/dist';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/test-results',
  fullyParallel: true,
  forbidOnly: isCI, // a forgotten test.only fails the CI run
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['html', { open: 'never', outputFolder: 'e2e/report' }]],
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      testIgnore: PRODUCTION_BUILD_SPEC,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'production-build',
      testMatch: PRODUCTION_BUILD_SPEC,
      use: { ...devices['Desktop Chrome'], baseURL: productionBaseURL },
    },
  ],
  // Starts the app with the mocked API (see the api-mocking skill).
  webServer: [
    {
      command: `pnpm dev --port ${PORT} --strictPort`,
      url: baseURL,
      env: { VITE_APP_ENABLE_API_MOCKING: 'true' },
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: `pnpm exec vite build --outDir ${PRODUCTION_OUT_DIR} && pnpm exec vite preview --outDir ${PRODUCTION_OUT_DIR} --port ${PRODUCTION_PORT} --strictPort`,
      url: productionBaseURL,
      env: { VITE_APP_ENABLE_API_MOCKING: 'true' },
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
