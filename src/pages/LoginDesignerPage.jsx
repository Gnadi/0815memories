import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import {
  Save, Copy, Check, Palette, Code, RotateCcw, ArrowLeft,
  Image as ImageIcon, ShieldCheck,
} from 'lucide-react'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import UploadWidget from '../components/admin/UploadWidget'
import CustomLoginCanvas from '../components/CustomLoginCanvas'
import LoginDecorations from '../components/LoginDecorations'
import FamilyIllustration from '../components/FamilyIllustration'
import LoginForm from '../components/auth/LoginForm'
import KaydoLogo from '../components/KaydoLogo'
import {
  LOGIN_THEME_PRESETS, THEME_FONTS, THEME_DECORATIONS,
  themeToStyles, themeDecorationEmojis, themeText,
} from '../utils/loginTheme'
import { normalizeLoginCard, CARD_STYLES, LOGIN_CARD_STYLES } from '../utils/loginCard'
import { LOGIN_STARTER_TEMPLATES } from '../utils/loginPageTemplates'
import { MAX_LOGIN_HTML_LENGTH, MAX_LOGIN_CSS_LENGTH } from '../utils/loginPageSanitizer'

const MODES = ['classic', 'theme', 'custom']

export default function LoginDesignerPage() {
  const { isAdmin, familyId } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('settings')

  const [mode, setMode] = useState('classic')
  const [theme, setTheme] = useState(LOGIN_THEME_PRESETS.sunset)
  const [html, setHtml] = useState('')
  const [css, setCss] = useState('')
  const [loginCard, setLoginCard] = useState(normalizeLoginCard(null))
  const [familyName, setFamilyName] = useState('')
  const [headerImage, setHeaderImage] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loaded, setLoaded] = useState(false)

  // Debounced code for the custom-mode preview so the shadow root isn't
  // rebuilt on every keystroke.
  const [previewCode, setPreviewCode] = useState({ html: '', css: '' })
  useEffect(() => {
    const id = setTimeout(() => setPreviewCode({ html, css }), 300)
    return () => clearTimeout(id)
  }, [html, css])

  useEffect(() => {
    if (!isAdmin) navigate('/home', { replace: true })
  }, [isAdmin, navigate])

  useEffect(() => {
    if (!familyId || !db) return
    getDoc(doc(db, 'families', familyId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data()
        const storedMode = MODES.includes(data.loginPageMode) ? data.loginPageMode : 'classic'
        setMode(storedMode)
        if (data.loginTheme && typeof data.loginTheme === 'object') {
          setTheme({ ...LOGIN_THEME_PRESETS.sunset, ...data.loginTheme })
        }
        setHtml(data.loginCustomHtml || '')
        setCss(data.loginCustomCss || '')
        setLoginCard(normalizeLoginCard(data.loginCard))
        setFamilyName(data.familyName || '')
        setHeaderImage(data.loginHeaderImage || '')
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [familyId])

  if (!isAdmin) return null

  const htmlTooLong = html.length > MAX_LOGIN_HTML_LENGTH
  const cssTooLong = css.length > MAX_LOGIN_CSS_LENGTH
  const saveBlocked = mode === 'custom' && (htmlTooLong || cssTooLong)

  const flashMessage = (text) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleSave = async () => {
    if (!familyId || saving || saveBlocked) return
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'families', familyId),
        {
          loginPageMode: mode,
          loginTheme: theme,
          loginCustomHtml: html,
          loginCustomCss: css,
          loginCard,
        },
        { merge: true }
      )
      flashMessage(t('loginDesigner.saved'))
    } catch {
      flashMessage(t('loginDesigner.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!familyId || saving) return
    if (!window.confirm(t('loginDesigner.resetConfirm'))) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'families', familyId), { loginPageMode: 'classic' }, { merge: true })
      setMode('classic')
      flashMessage(t('loginDesigner.saved'))
    } catch {
      flashMessage(t('loginDesigner.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleLoadTemplate = (template) => {
    if ((html || css) && !window.confirm(t('loginDesigner.loadTemplateConfirm'))) return
    setHtml(template.html)
    setCss(template.css)
  }

  // Any manual edit of a theme field marks the theme as customized.
  const updateTheme = (patch) => {
    setTheme((prev) => ({ ...prev, ...patch, preset: 'custom' }))
  }

  return (
    <div className="min-h-screen bg-cream flex overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />
        <main className="flex-1 px-4 lg:px-8 py-6 max-w-6xl mx-auto w-full">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1.5 text-sm text-bark-muted hover:text-kaydo transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('loginDesigner.backToSettings')}
          </button>

          <h1 className="text-2xl font-bold text-bark mb-1">{t('loginDesigner.title')}</h1>
          <p className="text-sm text-bark-muted mb-6">{t('loginDesigner.description')}</p>

          {message && (
            <p className="text-sm text-kaydo bg-cream-dark px-4 py-2 rounded-lg mb-4">{message}</p>
          )}

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {/* ===== Editor column ===== */}
            <div className="bg-warm-white rounded-2xl p-4 lg:p-6 shadow-sm">
              {/* Mode selector */}
              <label className="block text-sm font-medium text-bark mb-2">
                {t('loginDesigner.modeLabel')}
              </label>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      mode === m
                        ? 'border-kaydo bg-cream shadow-sm'
                        : 'border-cream-dark bg-warm-white hover:border-kaydo/50'
                    }`}
                    aria-pressed={mode === m}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-bark">
                      {m === 'classic' && <ImageIcon className="w-4 h-4" />}
                      {m === 'theme' && <Palette className="w-4 h-4" />}
                      {m === 'custom' && <Code className="w-4 h-4" />}
                      {t(`loginDesigner.mode${m[0].toUpperCase()}${m.slice(1)}`)}
                    </div>
                    <p className="text-xs text-bark-muted mt-1">
                      {t(`loginDesigner.mode${m[0].toUpperCase()}${m.slice(1)}Desc`)}
                    </p>
                  </button>
                ))}
              </div>

              {mode === 'theme' && <ThemeEditor theme={theme} setTheme={setTheme} updateTheme={updateTheme} t={t} />}
              {mode === 'custom' && (
                <>
                  <LoginBoxControls card={loginCard} setCard={setLoginCard} t={t} />
                  <CodeEditor
                    html={html} setHtml={setHtml} htmlTooLong={htmlTooLong}
                    css={css} setCss={setCss} cssTooLong={cssTooLong}
                    onLoadTemplate={handleLoadTemplate} t={t}
                  />
                </>
              )}
              {mode === 'classic' && (
                <p className="text-sm text-bark-muted mb-6">{t('loginDesigner.modeClassicDesc')}</p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-cream-dark">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || saveBlocked || !loaded}
                  className="btn-kaydo flex items-center gap-1.5 text-sm px-4 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {t('loginDesigner.save')}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving || !loaded}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border-2 border-cream-dark text-bark-muted hover:border-kaydo/50 hover:text-bark transition-colors disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('loginDesigner.resetLabel')}
                </button>
              </div>
              {saveBlocked && (
                <p className="text-xs text-red-600 mt-2">{t('loginDesigner.tooLong')}</p>
              )}
            </div>

            {/* ===== Preview column ===== */}
            <div className="lg:sticky lg:top-6">
              <label className="block text-sm font-medium text-bark mb-2">
                {t('loginDesigner.previewLabel')}
              </label>
              <PreviewPane
                mode={mode}
                theme={theme}
                html={previewCode.html}
                css={previewCode.css}
                familyName={familyName}
                headerImage={headerImage}
                card={loginCard}
                t={t}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function ThemeEditor({ theme, setTheme, updateTheme, t }) {
  const background = theme.background || {}
  const updateBackground = (patch) => {
    updateTheme({ background: { ...background, ...patch } })
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Presets */}
      <div>
        <label className="block text-sm font-medium text-bark mb-2">
          {t('loginDesigner.presetsLabel')}
        </label>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(LOGIN_THEME_PRESETS).map(([key, preset]) => {
            const { pageStyle } = themeToStyles(preset)
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTheme({ ...preset })}
                className={`rounded-xl border-2 p-1.5 transition-all ${
                  theme.preset === key
                    ? 'border-kaydo shadow-sm'
                    : 'border-cream-dark hover:border-kaydo/50'
                }`}
                aria-pressed={theme.preset === key}
              >
                <div className="h-10 rounded-lg" style={pageStyle} />
                <span className="block text-xs text-bark mt-1 truncate">
                  {t(`loginDesigner.presets.${key}`)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Background */}
      <div>
        <label className="block text-sm font-medium text-bark mb-2">
          {t('loginDesigner.backgroundLabel')}
        </label>
        <div className="flex gap-2 mb-3">
          {['color', 'gradient', 'image'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateBackground({ type })}
              className={`px-3 py-1.5 rounded-full text-sm border-2 transition-colors ${
                background.type === type
                  ? 'border-kaydo bg-cream text-bark font-semibold'
                  : 'border-cream-dark text-bark-muted hover:border-kaydo/50'
              }`}
              aria-pressed={background.type === type}
            >
              {t(`loginDesigner.background${type[0].toUpperCase()}${type.slice(1)}`)}
            </button>
          ))}
        </div>

        {background.type === 'color' && (
          <input
            type="color"
            value={background.color || '#fdf8f0'}
            onChange={(e) => updateBackground({ color: e.target.value })}
            className="w-16 h-10 rounded-lg border border-cream-dark cursor-pointer"
          />
        )}
        {background.type === 'gradient' && (
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-bark-light">
              {t('loginDesigner.gradientFrom')}
              <input
                type="color"
                value={background.from || '#ff9a56'}
                onChange={(e) => updateBackground({ from: e.target.value })}
                className="w-12 h-9 rounded-lg border border-cream-dark cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-bark-light">
              {t('loginDesigner.gradientTo')}
              <input
                type="color"
                value={background.to || '#ff5e8a'}
                onChange={(e) => updateBackground({ to: e.target.value })}
                className="w-12 h-9 rounded-lg border border-cream-dark cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-bark-light flex-1 min-w-[10rem]">
              {t('loginDesigner.gradientAngle')}
              <input
                type="range"
                min="0"
                max="360"
                value={Number.isFinite(Number(background.angle)) ? Number(background.angle) : 160}
                onChange={(e) => updateBackground({ angle: Number(e.target.value) })}
                className="flex-1 accent-kaydo"
              />
            </label>
          </div>
        )}
        {background.type === 'image' && (
          <UploadWidget
            unencrypted
            currentUrl={background.imageUrl || ''}
            onUpload={(url, publicId) => updateBackground({ imageUrl: url, imagePublicId: publicId })}
          />
        )}
      </div>

      {/* Font */}
      <div>
        <label className="block text-sm font-medium text-bark mb-2">
          {t('loginDesigner.fontLabel')}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.keys(THEME_FONTS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => updateTheme({ font: key })}
              className={`rounded-xl border-2 px-2 py-2 text-sm transition-all ${
                theme.font === key
                  ? 'border-kaydo bg-cream text-bark font-semibold'
                  : 'border-cream-dark text-bark-muted hover:border-kaydo/50'
              }`}
              style={THEME_FONTS[key] ? { fontFamily: THEME_FONTS[key] } : undefined}
              aria-pressed={theme.font === key}
            >
              {t(`loginDesigner.fonts.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-bark-light">
          {t('loginDesigner.textColorLabel')}
          <input
            type="color"
            value={theme.textColor || '#4a3f35'}
            onChange={(e) => updateTheme({ textColor: e.target.value })}
            className="w-12 h-9 rounded-lg border border-cream-dark cursor-pointer"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-bark-light">
          {t('loginDesigner.accentColorLabel')}
          <input
            type="color"
            value={theme.accentColor || '#e0745c'}
            onChange={(e) => updateTheme({ accentColor: e.target.value })}
            className="w-12 h-9 rounded-lg border border-cream-dark cursor-pointer"
          />
        </label>
      </div>

      {/* Welcome texts */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-bark mb-1.5">
            {t('loginDesigner.welcomeTitleLabel')}
          </label>
          <input
            type="text"
            maxLength={200}
            value={theme.welcomeTitle || ''}
            onChange={(e) => updateTheme({ welcomeTitle: e.target.value })}
            placeholder={t('loginDesigner.welcomeTitlePlaceholder')}
            className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark text-base placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-bark mb-1.5">
            {t('loginDesigner.welcomeMessageLabel')}
          </label>
          <input
            type="text"
            maxLength={200}
            value={theme.welcomeMessage || ''}
            onChange={(e) => updateTheme({ welcomeMessage: e.target.value })}
            placeholder={t('loginDesigner.welcomeMessagePlaceholder')}
            className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark text-base placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
          />
        </div>
      </div>

      {/* Decorations */}
      <div>
        <label className="block text-sm font-medium text-bark mb-2">
          {t('loginDesigner.decorationsLabel')}
        </label>
        <div className="flex flex-wrap gap-2">
          {Object.keys(THEME_DECORATIONS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => updateTheme({ decorations: key })}
              className={`px-3 py-1.5 rounded-full text-sm border-2 transition-colors ${
                theme.decorations === key
                  ? 'border-kaydo bg-cream text-bark font-semibold'
                  : 'border-cream-dark text-bark-muted hover:border-kaydo/50'
              }`}
              aria-pressed={theme.decorations === key}
            >
              {THEME_DECORATIONS[key][0] || ''} {t(`loginDesigner.decorations.${key}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Swatch backgrounds hinting at each login-card preset in the picker.
const CARD_SWATCHES = {
  light: 'bg-warm-white border border-cream-dark',
  dark: 'bg-zinc-900',
  glass: 'bg-gradient-to-br from-white/80 to-white/30 border border-white/60',
}

function LoginBoxControls({ card, setCard, t }) {
  const set = (patch) => setCard((prev) => ({ ...normalizeLoginCard(prev), ...patch }))
  return (
    <div className="space-y-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-bark mb-2">
          {t('loginDesigner.loginBoxLabel')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {['minimized', 'card'].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => set({ behavior: b })}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                card.behavior === b
                  ? 'border-kaydo bg-cream shadow-sm'
                  : 'border-cream-dark bg-warm-white hover:border-kaydo/50'
              }`}
              aria-pressed={card.behavior === b}
            >
              <span className="text-sm font-semibold text-bark">
                {t(b === 'minimized' ? 'loginDesigner.loginBoxMinimized' : 'loginDesigner.loginBoxCard')}
              </span>
              <p className="text-xs text-bark-muted mt-1">
                {t(b === 'minimized' ? 'loginDesigner.loginBoxMinimizedDesc' : 'loginDesigner.loginBoxCardDesc')}
              </p>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-bark mb-2">
          {t('loginDesigner.cardStyleLabel')}
        </label>
        <div className="flex gap-2">
          {LOGIN_CARD_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set({ style: s })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border-2 transition-colors ${
                card.style === s
                  ? 'border-kaydo bg-cream text-bark font-semibold'
                  : 'border-cream-dark text-bark-muted hover:border-kaydo/50'
              }`}
              aria-pressed={card.style === s}
            >
              <span className={`inline-block w-4 h-4 rounded-full ${CARD_SWATCHES[s]}`} />
              {t(`loginDesigner.card${s[0].toUpperCase()}${s.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function CodeEditor({ html, setHtml, htmlTooLong, css, setCss, cssTooLong, onLoadTemplate, t }) {
  const [uploadedUrls, setUploadedUrls] = useState([])
  const [copiedUrl, setCopiedUrl] = useState('')
  const [uploadKey, setUploadKey] = useState(0)

  const handleCopy = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(''), 2000)
    } catch {
      // Clipboard unavailable — the URL is still visible for manual copy.
    }
  }

  return (
    <div className="space-y-5 mb-6">
      <div className="flex items-start gap-2 text-xs text-bark-muted bg-cream-dark/60 rounded-xl px-3 py-2">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
        {t('loginDesigner.securityNote')}
      </div>

      <div>
        <label className="block text-sm font-medium text-bark mb-2">
          {t('loginDesigner.templatesLabel')}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {LOGIN_STARTER_TEMPLATES.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => onLoadTemplate(template)}
              className="rounded-xl border-2 border-cream-dark p-1.5 transition-all hover:border-kaydo/50"
            >
              <div className="h-10 rounded-lg" style={{ background: template.swatch }} />
              <span className="block text-xs text-bark mt-1 truncate">
                {t(`loginDesigner.templates.${template.key}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-bark">{t('loginDesigner.htmlLabel')}</label>
          <span className={`text-xs ${htmlTooLong ? 'text-red-600 font-semibold' : 'text-bark-muted'}`}>
            {t('loginDesigner.charCount', { used: html.length, max: MAX_LOGIN_HTML_LENGTH })}
          </span>
        </div>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          spellCheck={false}
          rows={12}
          className="w-full px-3 py-2.5 bg-cream-dark rounded-xl text-bark font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-kaydo/30 resize-y"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-bark">{t('loginDesigner.cssLabel')}</label>
          <span className={`text-xs ${cssTooLong ? 'text-red-600 font-semibold' : 'text-bark-muted'}`}>
            {t('loginDesigner.charCount', { used: css.length, max: MAX_LOGIN_CSS_LENGTH })}
          </span>
        </div>
        <textarea
          value={css}
          onChange={(e) => setCss(e.target.value)}
          spellCheck={false}
          rows={10}
          className="w-full px-3 py-2.5 bg-cream-dark rounded-xl text-bark font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-kaydo/30 resize-y"
        />
      </div>

      {/* Image uploads for use inside the custom HTML */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          {t('loginDesigner.imagesLabel')}
        </label>
        <p className="text-xs text-bark-muted mb-3">{t('loginDesigner.imagesHint')}</p>
        <UploadWidget
          key={uploadKey}
          unencrypted
          onUpload={(url) => {
            if (!url) return
            setUploadedUrls((list) => [...list, url])
            // Remount so the widget is ready for the next upload right away.
            setUploadKey((k) => k + 1)
          }}
        />
        {uploadedUrls.length > 0 && (
          <ul className="mt-3 space-y-2">
            {uploadedUrls.map((url) => (
              <li key={url} className="flex items-center gap-2">
                <img src={url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                <input
                  type="text"
                  readOnly
                  value={url}
                  className="flex-1 min-w-0 px-3 py-1.5 bg-cream-dark rounded-lg text-bark text-xs outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(url)}
                  className="btn-kaydo flex items-center gap-1 text-xs px-3 py-1.5"
                >
                  {copiedUrl === url ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedUrl === url ? t('loginDesigner.copied') : t('loginDesigner.copyUrl')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PreviewPane({ mode, theme, html, css, familyName, headerImage, card, t }) {
  const { t: tAuth } = useTranslation('auth')
  const [previewOpen, setPreviewOpen] = useState(false)
  const { behavior, style } = normalizeLoginCard(card)
  const preset = CARD_STYLES[style] || CARD_STYLES.light
  const darkCard = mode === 'custom' && preset.tone === 'dark'
  const welcomeHeading = (mode === 'theme' && themeText(theme, 'welcomeTitle'))
    || (familyName
      ? tAuth('login.welcomeFamily', { name: familyName })
      : tAuth('login.welcomeHome'))
  const welcomeSubtitle = (mode === 'theme' && themeText(theme, 'welcomeMessage'))
    || tAuth('login.subtitle')

  const { pageStyle, headingStyle, textStyle, accentColor } =
    mode === 'theme' ? themeToStyles(theme) : { pageStyle: {}, headingStyle: {}, textStyle: {}, accentColor: '' }

  const previewFormProps = {
    showAdminLogin: false,
    email: '', setEmail: () => {},
    password: '', setPassword: () => {},
    showPassword: false, setShowPassword: () => {},
    stayLoggedIn: false, setStayLoggedIn: () => {},
    error: '', loading: false,
    handleSubmit: (e) => e.preventDefault(),
  }

  const formCard = (
    <div
      className={`pointer-events-auto relative w-full max-w-sm rounded-2xl shadow-2xl p-5 ${
        mode === 'custom' ? preset.cardClass : 'bg-warm-white/95 backdrop-blur'
      }`}
      style={mode === 'theme' && accentColor ? { borderTop: `4px solid ${accentColor}` } : undefined}
    >
      {mode === 'custom' && behavior === 'minimized' && (
        <button
          type="button"
          onClick={() => setPreviewOpen(false)}
          aria-label={tAuth('login.closeLogin')}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center ${
            darkCard ? 'text-cream/70 hover:text-cream hover:bg-white/10' : 'text-bark-muted hover:text-bark hover:bg-cream-dark'
          }`}
        >
          ✕
        </button>
      )}
      <div className="flex justify-center mb-3">
        <KaydoLogo size={32} />
      </div>
      {mode !== 'theme' && (
        <>
          <h2 className={`text-xl font-bold text-center mb-1 ${darkCard ? 'text-cream' : 'text-bark'}`}>{welcomeHeading}</h2>
          <p className={`text-center text-xs mb-4 ${darkCard ? 'text-cream/80' : 'text-bark-light'}`}>{welcomeSubtitle}</p>
        </>
      )}
      {/* Preview only — the form is inert */}
      <fieldset disabled className="pointer-events-none">
        <LoginForm {...previewFormProps} tone={darkCard ? 'dark' : 'light'} />
      </fieldset>
    </div>
  )

  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-cream-dark bg-cream h-[70vh] min-h-[24rem]">
      {mode === 'custom' ? (
        <>
          {behavior === 'card' || previewOpen ? (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center p-4">
              {behavior === 'minimized' && (
                <div
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
                  onClick={() => setPreviewOpen(false)}
                />
              )}
              {formCard}
            </div>
          ) : (
            <div className="absolute bottom-4 inset-x-0 z-10 flex justify-center pointer-events-none">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="pointer-events-auto flex items-center gap-2 bg-warm-white/95 backdrop-blur text-bark font-semibold rounded-full shadow-2xl px-5 py-2.5 text-sm"
              >
                <KaydoLogo size={18} />
                {tAuth('login.openLogin')}
              </button>
            </div>
          )}
          <CustomLoginCanvas html={html} css={css} />
        </>
      ) : (
        <div className="absolute inset-0 overflow-y-auto" style={mode === 'theme' ? pageStyle : {}}>
          {mode === 'theme' && <LoginDecorations emojis={themeDecorationEmojis(theme)} />}
          <div className="relative flex flex-col items-center px-5 py-6">
            {mode === 'classic' && (
              <div className="w-full max-w-sm rounded-2xl overflow-hidden mb-4 h-36">
                {headerImage
                  ? <img src={headerImage} alt={t('upload.previewAlt')} className="w-full h-full object-cover" />
                  : <FamilyIllustration />}
              </div>
            )}
            {mode === 'theme' && (
              <>
                <h2 className="text-2xl font-bold text-bark text-center mb-1" style={headingStyle}>
                  {welcomeHeading}
                </h2>
                <p className="text-bark-light text-center text-sm mb-4" style={textStyle}>
                  {welcomeSubtitle}
                </p>
              </>
            )}
            {formCard}
          </div>
        </div>
      )}
    </div>
  )
}
