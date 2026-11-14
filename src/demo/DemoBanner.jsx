import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { exitDemo } from './demoMode'

/**
 * The bar across the top of every page in a demo tab, so nobody mistakes the
 * demo family for their own — or what they add to it for something kept.
 *
 * Both ways out are hard navigations that clear the flag first (see
 * demoMode.js). Signing up from inside the demo would otherwise land on a
 * signup page whose "already signed in" redirect sends them straight back.
 */
export default function DemoBanner() {
  const { t } = useTranslation('demo')
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 bg-kaydo-dark px-4 py-2 text-center text-xs font-medium text-warm-white"
    >
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {t('banner.text')}
      </span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => exitDemo('/signup')}
          className="font-bold underline underline-offset-2"
        >
          {t('banner.cta')}
        </button>
        <button
          type="button"
          onClick={() => exitDemo('/')}
          className="rounded-full border border-warm-white/50 px-2.5 py-0.5 font-semibold hover:bg-warm-white/10 transition-colors"
        >
          {t('banner.exit')}
        </button>
      </span>
    </div>
  )
}
