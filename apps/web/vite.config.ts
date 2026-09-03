import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

function requireApiUrlOnBuild(): Plugin {
  let command: "build" | "serve" = "serve";
  let apiUrl: string | undefined;

  return {
    name: "require-api-url-on-build",
    configResolved(config) {
      command = config.command;
      apiUrl = config.env.VITE_API_URL;
    },
    buildStart() {
      if (command === "build" && !apiUrl) {
        this.error("VITE_API_URL is required to build apps/web");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), requireApiUrlOnBuild()],
  envDir: "../../",
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    env: {
      VITE_API_URL: "http://localhost:3000",
    },
  },
});
