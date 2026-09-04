import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['coverage/', 'dist/', 'node_modules/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.ts', 'vitest.config.ts'],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.ts', 'vitest.config.ts'],
  })),
  {
    files: ['src/**/*.ts', 'vitest.config.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },
  {
    files: ['benchmarks/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
