import tseslint from "typescript-eslint";
import valorMagico from "./eslint-rules/valor-magico.js";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/shared/api/generated/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/**"],
    ignores: ["src/shared/components/**"],
    plugins: {
      local: { rules: { "valor-magico": valorMagico } },
    },
    rules: {
      "local/valor-magico": "error",
    },
  },
);
