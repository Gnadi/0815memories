import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * The desktop footer of the login and signup pages.
 *
 * Its links used to be spans styled as links that went nowhere, "Help Center"
 * among them, which Kaydo does not have; contact is what there is.
 *
 * `textStyle` is a login theme's text colour. The footer sits on the family's
 * background, and in the default brown it was close to unreadable on a dark
 * theme.
 */
export default function AuthFooter({ textStyle }) {
  const { t } = useTranslation('auth')
  const tinted = !!textStyle?.color
  return (
    <footer
      className={`relative hidden lg:flex px-6 py-4 items-center justify-between text-xs text-bark-muted border-t ${tinted ? 'border-current/20' : 'border-cream-dark'}`}
      style={tinted ? textStyle : undefined}
    >
      <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
      <div className="flex gap-4">
        <Link to="/privacy-policy" className="hover:underline">{t('footer.privacy')}</Link>
        <Link to="/terms" className="hover:underline">{t('footer.terms')}</Link>
        <Link to="/contact" className="hover:underline">{t('footer.contact')}</Link>
      </div>
    </footer>
  )
}
