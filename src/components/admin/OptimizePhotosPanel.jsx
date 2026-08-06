import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { scanThumbnailStatus, migrateThumbnails } from '../../utils/thumbnailMigration'
import { devError } from '../../utils/devLog'

/**
 * One-off (but resumable) pass that gives photos uploaded before thumbnails
 * existed the same downscaled copies new uploads get.
 *
 * Deliberately a button rather than something that runs in the background:
 * every photo has to be downloaded at full resolution, decrypted, resized,
 * re-encrypted and uploaded. Doing that while someone is scrolling the feed
 * makes the app slower, not faster — which is exactly what the previous
 * background version did.
 *
 * There is no stored progress. Each run rescans for documents that still lack
 * thumbnails, so stopping, closing the tab or switching devices loses nothing.
 */
export default function OptimizePhotosPanel() {
  const { familyId, encryptionKey } = useAuth()
  const { t } = useTranslation('settings')

  const [status, setStatus] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')

  const stopRef = useRef(false)
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false }, [])

  const scan = useCallback(async () => {
    if (!familyId) return
    setScanning(true)
    setError('')
    try {
      const result = await scanThumbnailStatus(familyId)
      if (aliveRef.current) setStatus(result)
    } catch (err) {
      devError('Thumbnail scan failed:', err)
      if (aliveRef.current) setError(t('optimizePhotos.error'))
    } finally {
      if (aliveRef.current) setScanning(false)
    }
  }, [familyId, t])

  useEffect(() => { scan() }, [scan])

  const handleStart = async () => {
    if (!status?.pending.length || !encryptionKey) return
    stopRef.current = false
    setRunning(true)
    setError('')
    setProgress({ done: 0, total: status.pending.length })

    try {
      await migrateThumbnails(status.pending, encryptionKey, {
        onProgress: (done, total) => {
          if (aliveRef.current) setProgress({ done, total })
        },
        shouldStop: () => stopRef.current || !aliveRef.current,
      })
    } catch (err) {
      devError('Thumbnail migration failed:', err)
      if (aliveRef.current) setError(t('optimizePhotos.error'))
    } finally {
      if (aliveRef.current) {
        setRunning(false)
        // Rescan rather than trusting a counter: the data is the source of truth.
        scan()
      }
    }
  }

  // Nothing to do for families whose media was never encrypted.
  if (!encryptionKey) return null

  const pending = status?.pending.length ?? 0
  const total = status?.total ?? 0

  return (
    <div className="mt-6 pt-6 border-t border-cream-dark">
      <label className="block text-sm font-medium text-bark mb-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          {t('optimizePhotos.label')}
        </div>
      </label>
      <p className="text-xs text-bark-muted mb-3">{t('optimizePhotos.description')}</p>

      {scanning && !running && (
        <p className="text-sm text-bark-muted">{t('optimizePhotos.scanning')}</p>
      )}

      {!scanning && !running && status && pending === 0 && (
        <p className="text-sm text-bark-light">{t('optimizePhotos.allDone', { count: total })}</p>
      )}

      {!scanning && !running && pending > 0 && (
        <>
          <p className="text-sm text-bark-light mb-3">
            {t('optimizePhotos.remaining', { pending, total })}
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="px-4 py-2 bg-kaydo text-white text-sm font-semibold rounded-xl hover:bg-kaydo-dark transition-colors"
          >
            {t('optimizePhotos.start')}
          </button>
          <p className="text-xs text-bark-muted mt-2">{t('optimizePhotos.resumeHint')}</p>
        </>
      )}

      {running && (
        <>
          <div className="flex items-center justify-between text-sm text-bark-light mb-2">
            <span>{t('optimizePhotos.progress', progress)}</span>
            <button
              type="button"
              onClick={() => { stopRef.current = true }}
              className="text-xs font-medium text-bark-muted hover:text-bark underline"
            >
              {t('optimizePhotos.stop')}
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
