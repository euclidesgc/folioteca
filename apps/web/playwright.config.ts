import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const baseURL = `http://localhost:${PORT}`;
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
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Starts the app with the mocked API (see the api-mocking skill).
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: baseURL,
    env: { VITE_APP_ENABLE_API_MOCKING: 'true' },
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
