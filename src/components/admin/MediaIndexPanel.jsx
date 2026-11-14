import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getMediaIndexedAt, indexFamilyMedia } from '../../services/mediaIndex'
import { devError } from '../../utils/devLog'

/**
 * Notes on the family's older posts which stored files they use
 * (services/mediaIndex.js), so the server can tell them from files nobody
 * needs. Light work — text is decrypted, no media is downloaded — but still a
 * button, like the other backfills, so it runs when someone chose to.
 *
 * Shows when it last got through everything; running it again is harmless.
 */
export default function MediaIndexPanel() {
  const { familyId, encryptionKey, user } = useAuth()
  const { t, i18n } = useTranslation('settings')

  const [indexedAt, setIndexedAt] = useState(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const stopRef = useRef(false)
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false }, [])

  const load = useCallback(async () => {
    try {
      const at = await getMediaIndexedAt(familyId)
      if (aliveRef.current) setIndexedAt(at)
    } catch (err) {
      devError('Media index status failed:', err)
    }
  }, [familyId])

  useEffect(() => { load() }, [load])

  const handleStart = async () => {
    if (!familyId || !encryptionKey || !user?.uid) return
    stopRef.current = false
    setRunning(true)
    setError('')
    setResult(null)
    setProgress({ done: 0, total: 0 })
    try {
      const stats = await indexFamilyMedia(familyId, user.uid, encryptionKey, {
        onProgress: (done, total) => {
          if (aliveRef.current) setProgress({ done, total })
        },
        shouldStop: () => stopRef.current || !aliveRef.current,
      })
      if (aliveRef.current) setResult(stats)
    } catch (err) {
      devError('Media index failed:', err)
      if (aliveRef.current) setError(t('mediaIndex.error'))
    } finally {
      if (aliveRef.current) {
        setRunning(false)
        load()
      }
    }
  }

  // The demo and families without a key have nothing stored to index.
  if (!encryptionKey) return null

  const date = typeof indexedAt?.toDate === 'function'
    ? indexedAt.toDate().toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="mt-6 pt-6 border-t border-cream-dark">
      <label className="block text-sm font-medium text-bark mb-1.5">
        <div className="flex items-center gap-1.5">
          <ListChecks className="w-4 h-4" />
          {t('mediaIndex.label')}
        </div>
      </label>
      <p className="text-xs text-bark-muted mb-3">{t('mediaIndex.description')}</p>

      {!running && (
        <>
          <p className="text-sm text-bark-light mb-3">
            {date ? t('mediaIndex.lastRun', { date }) : t('mediaIndex.never')}
          </p>
          {result && !result.stopped && result.failed === 0 && (
            <p className="text-sm text-bark-light mb-3">{t('mediaIndex.done', { updated: result.updated })}</p>
          )}
          {result?.stopped && (
            <p className="text-sm text-bark-light mb-3">{t('mediaIndex.stopped', result)}</p>
          )}
          {result?.failed > 0 && (
            <p className="text-sm text-red-600 mb-3">{t('mediaIndex.partial', { failed: result.failed })}</p>
          )}
          <button
            type="button"
            onClick={handleStart}
            className="px-4 py-2 bg-kaydo text-white text-sm font-semibold rounded-xl hover:bg-kaydo-dark transition-colors"
          >
            {t('mediaIndex.start')}
          </button>
          <p className="text-xs text-bark-muted mt-2">{t('mediaIndex.resumeHint')}</p>
        </>
      )}

      {running && (
        <>
          <div className="flex items-center justify-between text-sm text-bark-light mb-2">
            <span>{t('mediaIndex.progress', progress)}</span>
            <button
              type="button"
              onClick={() => { stopRef.current = true }}
              className="text-xs font-medium text-bark-muted hover:text-bark underline"
            >
              {t('mediaIndex.stop')}
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
