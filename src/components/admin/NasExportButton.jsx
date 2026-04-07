import { useState, useEffect, useRef } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAuth } from '../../context/AuthContext'
import { runNasExport } from '../../utils/nasExport'
import { HardDrive, X } from 'lucide-react'

export default function NasExportButton() {
  const { familyId, encryptionKey } = useAuth()
  const [familyName, setFamilyName] = useState('')
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState({ phase: '', current: 0, total: 0, message: '' })
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!familyId || !db) return
    getDoc(doc(db, 'families', familyId)).then((snap) => {
      if (snap.exists()) setFamilyName(snap.data().familyName || '')
    })
  }, [familyId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    setProgress({ phase: 'data', current: 0, total: 1, message: 'Starting export...' })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await runNasExport({
        familyId,
        familyName,
        encryptionKey,
        onProgress: setProgress,
        signal: controller.signal,
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        setProgress({ phase: '', current: 0, total: 0, message: '' })
      } else {
        setError(err.message || 'Export failed')
      }
    } finally {
      setExporting(false)
      abortRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortRef.current) abortRef.current.abort()
  }

  const progressPercent =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  if (exporting) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-bark">{progress.message}</p>
        <div className="w-full h-2.5 bg-cream-dark rounded-full overflow-hidden">
          <div
            className="h-full bg-kaydo rounded-full transition-all duration-300"
            style={{ width: `${progress.phase === 'zip' ? 100 : progressPercent}%` }}
          />
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="flex items-center gap-1.5 text-sm text-bark-muted hover:text-kaydo transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    )
  }

  if (progress.phase === 'done') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-700">Export complete! Check your downloads folder.</p>
        <button
          type="button"
          onClick={() => setProgress({ phase: '', current: 0, total: 0, message: '' })}
          className="btn-kaydo flex items-center gap-1.5 text-sm px-4"
        >
          <HardDrive className="w-4 h-4" />
          Export Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      <button
        type="button"
        onClick={handleExport}
        className="btn-kaydo flex items-center gap-1.5 text-sm px-4"
      >
        <HardDrive className="w-4 h-4" />
        Download Full Backup (ZIP)
      </button>
    </div>
  )
}
