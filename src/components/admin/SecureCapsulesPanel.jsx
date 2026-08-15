import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  scanBlackboxEncryption,
  migrateBlackboxEncryption,
} from '../../utils/blackboxMigration'
import { devError } from '../../utils/devLog'

/**
 * One-off (but resumable) pass that encrypts Black Box capsules sealed while the
 * hook's field list named a field the create page never wrote — see
 * utils/blackboxMigration.js.
 *
 * Unlike OptimizePhotosPanel, this one hides itself when there is nothing to do,
 * and shows a warning tone when there is: a family with plaintext capsules is
 * looking at a defect, not an optional improvement.
 *
 * Same no-stored-progress design as the thumbnail pass — each run rescans, so
 * stopping or closing the tab loses nothing.
 */
export default function SecureCapsulesPanel() {
  const { familyId, encryptionKey } = useAuth()
  const { t } = useTranslation('settings')

  const [status, setStatus] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [justFinished, setJustFinished] = useState(false)

  const stopRef = useRef(false)
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false }, [])

  const scan = useCallback(async () => {
    if (!familyId || !encryptionKey) return
    setScanning(true)
    setError('')
    try {
      const result = await scanBlackboxEncryption(familyId, encryptionKey)
      if (aliveRef.current) setStatus(result)
    } catch (err) {
      devError('Capsule encryption scan failed:', err)
      if (aliveRef.current) setError(t('secureCapsules.error'))
    } finally {
      if (aliveRef.current) setScanning(false)
    }
  }, [familyId, encryptionKey, t])

  useEffect(() => { scan() }, [scan])

  const handleStart = async () => {
    if (!status?.pending.length || !encryptionKey) return
    stopRef.current = false
    setRunning(true)
    setError('')
    setProgress({ done: 0, total: status.pending.length })

    try {
      await migrateBlackboxEncryption(status.pending, encryptionKey, {
        onProgress: (done, total) => {
          if (aliveRef.current) setProgress({ done, total })
        },
        shouldStop: () => stopRef.current || !aliveRef.current,
      })
      if (aliveRef.current) setJustFinished(true)
    } catch (err) {
      devError('Capsule encryption migration failed:', err)
      if (aliveRef.current) setError(t('secureCapsules.error'))
    } finally {
      if (aliveRef.current) {
        setRunning(false)
        // Rescan rather than trusting a counter: the data is the source of truth.
        scan()
      }
    }
  }

  if (!encryptionKey) return null

  const pending = status?.pending.length ?? 0

  // Nothing to repair, and nothing was repaired this session: stay out of the
  // way rather than advertise a problem this family never had.
  if (!scanning && !running && status && pending === 0 && !justFinished) return null

  return (
    <div className="mt-6 pt-6 border-t border-cream-dark">
      <label className="block text-sm font-medium text-bark mb-1.5">
        <div className="flex items-center gap-1.5">
          {pending > 0 ? (
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-green-600" />
          )}
          {t('secureCapsules.label')}
        </div>
      </label>

      {pending > 0 && !running && (
        <p className="text-xs text-bark-muted mb-3">{t('secureCapsules.description')}</p>
      )}

      {scanning && !running && (
        <p className="text-sm text-bark-muted">{t('secureCapsules.scanning')}</p>
      )}

      {!scanning && !running && pending === 0 && justFinished && (
        <p className="text-sm text-green-700">{t('secureCapsules.allDone')}</p>
      )}

      {!scanning && !running && pending > 0 && (
        <>
          <p className="text-sm text-bark-light mb-3">
            {t('secureCapsules.remaining', { pending })}
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="px-4 py-2 bg-kaydo text-white text-sm font-semibold rounded-xl hover:bg-kaydo-dark transition-colors"
          >
            {t('secureCapsules.start')}
          </button>
          <p className="text-xs text-bark-muted mt-2">{t('secureCapsules.resumeHint')}</p>
        </>
      )}

      {running && (
        <>
          <div className="flex items-center justify-between text-sm text-bark-light mb-2">
            <span>{t('secureCapsules.progress', progress)}</span>
            <button
              type="button"
              onClick={() => { stopRef.current = true }}
              className="text-xs font-medium text-bark-muted hover:text-bark underline"
            >
              {t('secureCapsules.stop')}
            </button>
          </div>
          <div className="h-2 w-full bg-cream-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-kaydo transition-[width] duration-300"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}
