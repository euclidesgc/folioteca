import { defineConfig } from "@playwright/test";

const API_PORT = 3000;
const WEB_PORT = 5173;
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: WEB_URL,
  },
  webServer: [
    {
      command: "pnpm --filter api run start",
      cwd: "../../",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        DATABASE_URL: "postgresql://folioteca:senha@localhost:5433/folioteca",
        WEB_ORIGIN: WEB_URL,
      },
    },
    {
      command: "pnpm --filter web run dev",
      cwd: "../../",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_API_URL: API_URL,
      },
    },
  ],
});
