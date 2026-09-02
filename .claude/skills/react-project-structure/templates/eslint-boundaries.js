import importPlugin from 'eslint-plugin-import';

export const boundaries = {
  plugins: { import: importPlugin },
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './src/shared',
            from: './src/features',
            message: 'shared não depende de features: o compartilhado deixaria de ser compartilhável.',
          },
          {
            target: './src/shared',
            from: './src/app',
            message: 'shared não depende de app.',
          },
          {
            target: './src/features',
            from: './src/app',
            message: 'feature não depende de app: quem compõe features é app.',
          },
        ],
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/features/*/*'],
            message: 'Importe o barril `@/features/<feature>`, nunca o interior dela.',
          },
          {
            group: ['../../features/*', '../../../features/*'],
            message: 'Use o alias `@/features/<feature>` em vez de caminho relativo entre features.',
          },
        ],
      },
    ],
  },
};
