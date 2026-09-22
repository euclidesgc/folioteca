import js from '@eslint/js';
import checkFile from 'eslint-plugin-check-file';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/generated/**',
      'apps/web/public/mockServiceWorker.js',
    ],
  },

  {
    plugins: {
      import: importPlugin,
      'check-file': checkFile,
    },
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          tsconfig: {
            configFile: './tsconfig.json',
            references: 'auto',
          },
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // React só existe no app web.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs['recommended-latest'],
      jsxA11y.flatConfigs.recommended,
    ],
  },

  // Direção dos imports: compartilhado → features → app.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './apps/web/src/features/auth',
              from: './apps/web/src/features',
              except: ['./auth'],
            },
            {
              target: './apps/web/src/features/connection',
              from: './apps/web/src/features',
              except: ['./connection'],
            },
            {
              target: './apps/web/src/features/installation',
              from: './apps/web/src/features',
              except: ['./installation'],
            },
            {
              target: './apps/web/src/features/documents',
              from: './apps/web/src/features',
              except: ['./documents'],
            },
            {
              target: './apps/web/src/features/org-units',
              from: './apps/web/src/features',
              except: ['./org-units'],
            },
            {
              target: './apps/web/src/features/invitations',
              from: './apps/web/src/features',
              except: ['./invitations'],
            },
            {
              target: './apps/web/src/features',
              from: './apps/web/src/app',
            },
            {
              target: [
                './apps/web/src/components',
                './apps/web/src/hooks',
                './apps/web/src/lib',
                './apps/web/src/types',
                './apps/web/src/utils',
                './apps/web/src/config',
              ],
              from: ['./apps/web/src/features', './apps/web/src/app'],
            },
          ],
        },
      ],
    },
  },

  // Arquivos e pastas em kebab-case.
  {
    files: ['**/*.{js,ts,tsx}'],
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{js,ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
  {
    files: ['**/*'],
    rules: {
      'check-file/folder-naming-convention': [
        'error',
        { '(apps|packages)/*/src/**/!(__tests__)': 'KEBAB_CASE' },
      ],
    },
  },
);
