// Mirrors the assembly of `MOCK_PASSWORD` in `src/testing/mocks/utils.ts`.
// Not imported directly: that file sits in a different TypeScript project
// (`tsconfig.app.json`, with `import.meta.env` typed by the Vite client),
// and `tsconfig.e2e.json` cannot reference it without pulling in that
// project's types.
//
// Not a secret: readable and low-entropy on purpose, so it never looks like
// a leaked credential to a secret scanner.
export const MOCK_EMAIL = 'ana.souza@exemplo.com.br';

export const MOCK_PASSWORD = ['mock', 'password', '0'.repeat(12)].join('-');
