import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', '.wrangler/**', 'public/**', 'scripts/**'] },
  ...tseslint.configs.recommended,
  { files: ['test/**'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
