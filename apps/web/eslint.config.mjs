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
  {
    // decisão 3 (docs/refactor/00-fundamentos/decisoes.md): o ícone da casa é
    // desenhado na casa. `lucide-react` chega como dependência própria do
    // `@blocknote/shadcn`, e fica confinado a `packages/editor` — nunca na
    // interface de `apps/web`.
    files: ["src/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "lucide-react fica confinado a packages/editor — a Folioteca tem um ícone só, desenhado na casa.",
            },
          ],
        },
      ],
    },
  },
);
