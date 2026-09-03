import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../api/openapi.json",
  output: "src/shared/api/generated",
  plugins: ["@hey-api/typescript"],
});
