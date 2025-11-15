import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Apply recommended rules to all files
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Ignore patterns
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'src/frontend/**'],
  },

  {
    // Relax some rules that are too strict for this codebase
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none', // Don't error on unused catch variables
        },
      ],
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'no-useless-escape': 'warn',
      'no-case-declarations': 'warn',
    },
  },

  {
    // Even more lenient for test files
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
);
