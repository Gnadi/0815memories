import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
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
    // Firestore is reached through src/config/firestore.js, the one module the
    // demo switches to its in-browser database. A direct import of the SDK
    // would go around it, and the demo would break on that feature.
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/config/firestore.js', 'src/config/firebase.js', 'src/demo/**', 'src/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'firebase/firestore',
          message: 'Import from src/config/firestore.js, which demo mode switches to its in-browser database.',
        }],
      }],
    },
  },
  {
    // src/services/ reads and writes Firestore; hooks, pages and components
    // ask it. The files listed here predate it and still query Firestore
    // themselves. Each area moves over in a change of its own, and the list
    // only shrinks. Timestamp is a value that dates are converted with, not a
    // query, so it stays importable everywhere.
    //
    // This block replaces the one above for the files it covers, so it repeats
    // its rule.
    files: ['src/**/*.{js,jsx}'],
    ignores: [
      'src/config/**',
      'src/services/**',
      'src/demo/**',
      'src/__tests__/**',
      // Not in src/services/ yet:
      'src/context/AuthContext.jsx',
      'src/hooks/useFeedback.js',
      'src/hooks/useOurYear.js',
      'src/hooks/useTimeline.js',
      'src/components/admin/ManageAdminsPanel.jsx',
      'src/components/admin/NasExportButton.jsx',
      'src/components/admin/SettingsPanel.jsx',
      'src/pages/InviteRedeemPage.jsx',
      'src/pages/LoginDesignerPage.jsx',
      'src/pages/LoginPage.jsx',
      'src/pages/OurYearChapterPage.jsx',
      'src/pages/OurYearSetupPage.jsx',
      'src/utils/familySlug.js',
      'src/utils/nasExport.js',
      'src/utils/notifications.js',
      'src/utils/thumbnailMigration.js',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'firebase/firestore',
          message: 'Import from src/config/firestore.js, which demo mode switches to its in-browser database.',
        }],
        patterns: [{
          regex: '(^|/)config/firestore(\\.js)?$',
          allowImportNames: ['Timestamp'],
          message: 'Read and write Firestore through src/services/ — see docs/architecture.md.',
        }],
      }],
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
    // Cloud Functions, the Vercel functions, the migration scripts and the
    // Playwright setup run in Node, where `process` and friends exist and
    // `window` does not.
    files: [
      'functions/**/*.js',
      'api/**/*.js',
      'scripts/**/*.{js,mjs}',
      '.github/scripts/**/*.mjs',
      'e2e/**/*.js',
      'playwright.config.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
])
