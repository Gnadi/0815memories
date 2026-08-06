import '@testing-library/jest-dom'

// Initialize i18next once for the whole test run. Components rendered in tests
// use useTranslation() and would otherwise get raw keys; this makes them render
// real English strings so existing assertions keep working. Force English so
// snapshots/text assertions are deterministic regardless of the host locale.
import i18n, { ensureAppTranslations } from '../i18n'
i18n.changeLanguage('en')

// In the app the signed-in namespaces arrive with the route chunk (see
// lazyPage() in App.jsx). Tests render those components directly, so register
// them up front — otherwise assertions would match raw translation keys.
await ensureAppTranslations()
