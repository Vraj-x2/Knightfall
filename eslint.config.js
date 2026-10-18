// Lints the client (TypeScript + React) and the server (Node JavaScript) from one place.
// typescript-eslint needs TypeScript's JS API, which TypeScript 7 doesn't ship, so this root package
// pins TypeScript 6 for parsing only. The client still builds and type-checks with its own TypeScript 7.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'client/public/**'] },
  js.configs.recommended,
  {
    files: ['client/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['server/**/*.js', 'client/scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
);
