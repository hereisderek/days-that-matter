// One lint config for every backend workspace.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/contract/**', 'core/src/contract/api.ts'] },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    languageOptions: {
      globals: { console: 'readonly', crypto: 'readonly', URL: 'readonly', URLSearchParams: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The core runs on Workers, Node and Functions: only the Node helpers may use Node modules.
    files: ['core/src/**/*.ts'],
    ignores: ['core/src/node/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['node:*'], message: 'Node-only code goes in src/node/.' }] }],
    },
  },
  {
    files: ['core/web/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly', window: 'readonly', navigator: 'readonly', Intl: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
      },
    },
  },
);
