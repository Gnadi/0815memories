import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiArrowRight, HiShieldCheck } from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginViewer, loginAdmin } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isAdminMode) {
        await loginAdmin(email, password)
      } else {
        await loginViewer(password)
      }
      navigate('/home')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.illustrationSide}>
        <img
          src="https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800&q=80"
          alt="Family gathering around table"
        />
        <div className={styles.illustrationOverlay}>
          <h2>Your digital living room awaits.</h2>
          <p>Safe, private, and filled with the ones who matter most.</p>
        </div>
      </div>

      <div className={styles.formSide}>
        <div className={styles.formContainer}>
          <div className={styles.brandHeader}>
            <span>🏠</span> FamilyHearth
          </div>
          <div className={styles.brandIcon}>🏠</div>
          <h1 className={styles.title}>Welcome Home</h1>
          <p className={styles.subtitle}>
            {isAdminMode
              ? 'Sign in to manage your family hearth.'
              : 'Step inside the digital living room of your loved ones.'}
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            {error && <div className={styles.error}>{error}</div>}

            {isAdminMode && (
              <div>
                <label className={styles.fieldLabel}>Family Email</label>
                <div className={styles.inputWrapper}>
                  <HiMail className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="admin@hearth.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className={styles.fieldLabel}>Private Key</label>
              <div className={styles.inputWrapper}>
                <HiLockClosed className={styles.inputIcon} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="Enter your private key"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <HiEyeOff /> : <HiEye />}
                </button>
              </div>
            </div>

            <div className={styles.optionsRow}>
              <label className={styles.stayLogged}>
                <input type="checkbox" />
                Stay logged in
              </label>
              <a href="#" className={styles.forgotLink}>Lost your key?</a>
            </div>

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? 'Opening...' : 'Enter the Home'}
              {!loading && <HiArrowRight />}
            </button>

            {!isAdminMode && (
              <>
                <p className={styles.dividerText}>New to the family?</p>
                <button type="button" className={styles.secondaryButton}>
                  Request an Invite
                </button>
              </>
            )}
          </form>

          <div className={styles.footer}>
            <HiShieldCheck className={styles.footerIcon} />
            Encrypted & Private Family Network
          </div>

          <div className={styles.adminToggle}>
            <button
              className={styles.adminToggleLink}
              onClick={() => {
                setIsAdminMode(!isAdminMode)
                setError('')
              }}
            >
              {isAdminMode ? 'Back to family login' : 'Admin Login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
