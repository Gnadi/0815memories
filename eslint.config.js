import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Capitalised names are components, used only as JSX, which this rule
      // does not count — for parameters (`{ icon: Icon }`) as much as for
      // variables. A leading underscore marks a deliberate omission, as in
      // `({ id: _id, ...rest }) => rest`.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      // A provider and its hook belong in one file.
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true, allowExportNames: ['useAuth'] },
      ],
      // Every instance is the same shape: a Firestore subscription hook that
      // returns early with setLoading(false) (or clears a value) when it has no
      // id to subscribe to. That costs one extra render, not a bug, and the fix
      // is to derive `loading` in every data hook — a refactor of its own. A
      // warning keeps it visible without failing CI on it.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // The service worker runs in the ServiceWorkerGlobalScope, not the window —
    // so `self`, `clients`, `registration`, etc. are service-worker globals.
    files: ['src/sw.js'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // Cloud Functions, the Vercel functions and the migration scripts run in
    // Node, where `process` and friends exist and `window` does not.
    files: ['functions/**/*.js', 'api/**/*.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
