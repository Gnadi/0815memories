import '@testing-library/jest-dom'

// Initialize i18next once for the whole test run. Components rendered in tests
// use useTranslation() and would otherwise get raw keys; this makes them render
// real English strings so existing assertions keep working. Force English so
// snapshots/text assertions are deterministic regardless of the host locale.
import i18n from '../i18n'
i18n.changeLanguage('en')
