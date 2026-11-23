import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import KaydoLogo from '../KaydoLogo'
import LoginArt from './LoginArt'
import { pickLoginArt } from './loginArtFiles'
import AuthFooter from './AuthFooter'
import { usePictureRoom } from '../../hooks/usePictureRoom'

/**
 * The frame of the signup and invite pages: the login page's picture beside
 * the form on a desktop, above it on a phone.
 *
 * One tree for every screen size. The pages used to render a phone layout and
 * a desktop layout side by side and hide one with CSS, so every field, error
 * and step existed twice — the email confirmation step polled twice, and
 * password managers and screen readers met each field twice.
 *
 * `badge` is the line under the form on a desktop; `footer` adds the links to
 * the privacy policy, terms and contact.
 */
export default function AuthPageLayout({ title, subtitle, badge, footer = false, children }) {
  const { t } = useTranslation('auth')
  // One motif per visit, as on the login page.
  const [motif] = useState(() => pickLoginArt())
  const [observePicture, pictureTooSmall] = usePictureRoom()

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      {/* Desktop header */}
      <header className="hidden lg:flex px-6 py-4 items-center justify-between">
        <Link to="/" aria-label={t('login.homeLink')} className="flex items-center gap-2 text-bark font-semibold text-lg">
          <KaydoLogo size={22} />
          <span>Kaydo</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-stretch px-5 pt-4 pb-8 lg:p-0">
        {/* Phone brand */}
        <Link to="/" aria-label={t('login.homeLink')} className="lg:hidden flex items-center gap-2 mb-4 self-start">
          <KaydoLogo size={22} />
          <span className="text-lg font-bold text-bark">Kaydo</span>
        </Link>

        {/* Picture: on a phone, as on the login page, it takes the height the
            form leaves over, up to its banner's shape, and steps aside where
            that is a strip; picture and form are centred together. The page
            used to scroll, with the picture at full size above a long form.
            On a desktop it is an inset, rounded card without text. */}
        <div
          ref={observePicture}
          className="relative overflow-hidden rounded-2xl mb-6 w-full max-w-xl mx-auto max-lg:mt-auto flex-1 min-h-0 max-lg:max-h-[calc(min(100vw-2.5rem,36rem)*var(--art-ratio))] lg:flex-none lg:mx-0 lg:max-w-none lg:w-[calc(50%-1.5rem)] lg:ms-6 lg:mt-2 lg:mb-6 lg:rounded-[28px] lg:shadow-[0_18px_40px_-18px_rgba(60,40,20,0.35)]"
          style={{ '--art-ratio': motif.mobile.height / motif.mobile.width }}
        >
          {!pictureTooSmall && <LoginArt motif={motif} />}
        </div>

        {/* Form column */}
        <div className="flex flex-col w-full max-w-xl mx-auto max-lg:mb-auto lg:max-w-none lg:mx-0 lg:w-1/2 lg:items-center lg:justify-center lg:px-16">
          <div className="w-full lg:max-w-md">
            <div className="hidden lg:flex justify-center mb-6">
              <KaydoLogo size={52} />
            </div>

            <h1 className="text-3xl lg:text-4xl font-bold text-bark text-center mb-2">{title}</h1>
            <p className="text-bark-light text-center mb-6 lg:mb-8">{subtitle}</p>

            {children}

            {badge && (
              <div className="hidden lg:flex mt-8 items-center justify-center gap-2 text-sm text-bark-muted">
                <Shield className="w-4 h-4" aria-hidden="true" />
                {badge}
              </div>
            )}
          </div>
        </div>
      </main>

      {footer && <AuthFooter />}
    </div>
  )
}
