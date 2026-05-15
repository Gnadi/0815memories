import { useState, useEffect } from 'react'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAuth } from '../../context/AuthContext'
import bcrypt from 'bcryptjs'
import { Settings, Save, Copy, Check, Link, Image as ImageIcon, HardDrive, Camera } from 'lucide-react'
import { generateSlug, isSlugAvailable } from '../../utils/familySlug'
import UploadWidget from './UploadWidget'
import NasExportButton from './NasExportButton'
import ManageAdminsPanel from './ManageAdminsPanel'

export default function SettingsPanel() {
  const { familyId } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [familySlug, setFamilySlug] = useState('')
  const [loginHeaderImage, setLoginHeaderImage] = useState('')
  const [loginHeaderImagePublicId, setLoginHeaderImagePublicId] = useState('')
  const [memoryCardStyle, setMemoryCardStyle] = useState('modern')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const shareLink = familySlug
    ? `${window.location.origin}/family/${familySlug}`
    : familyId
      ? `${window.location.origin}/?family=${familyId}`
      : ''

  useEffect(() => {
    if (!familyId || !db) return
    async function loadFamily() {
      const familyDoc = await getDoc(doc(db, 'families', familyId))
      if (familyDoc.exists()) {
        const data = familyDoc.data()
        setFamilyName(data.familyName || '')
        setFamilySlug(data.familySlug || '')
        setLoginHeaderImage(data.loginHeaderImage || '')
        setLoginHeaderImagePublicId(data.loginHeaderImagePublicId || '')
        setMemoryCardStyle(data.memoryCardStyle === 'classic' ? 'classic' : 'modern')
      }
    }
    loadFamily()
  }, [familyId])

  const handleSavePassword = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 4) {
      setMessage('Password must be at least 4 characters')
      return
    }
    if (!familyId) {
      setMessage('No family found')
      return
    }

    setSaving(true)
    try {
      const hashed = await bcrypt.hash(newPassword, 10)
      await setDoc(
        doc(db, 'families', familyId),
        { sharedPassword: hashed },
        { merge: true }
      )
      setNewPassword('')
      setMessage('Shared password updated!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage('Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFamilyName = async () => {
    if (!familyName || !familyId) return
    setSaving(true)
    try {
      const newSlug = generateSlug(familyName)
      if (!newSlug) {
        setMessage('Family name produces an invalid URL — please use letters or numbers')
        setSaving(false)
        return
      }

      const available = await isSlugAvailable(newSlug, familyId)
      if (!available) {
        setMessage('This family name is already taken — please choose another')
        setSaving(false)
        return
      }

      await setDoc(
        doc(db, 'families', familyId),
        { familyName, familySlug: newSlug },
        { merge: true }
      )
      setFamilySlug(newSlug)
      setMessage('Family name updated!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage('Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = shareLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSelectCardStyle = async (style) => {
    if (!familyId || saving) return
    if (style !== 'modern' && style !== 'classic') return
    if (style === memoryCardStyle) return
    setSaving(true)
    const previous = memoryCardStyle
    setMemoryCardStyle(style)
    try {
      await setDoc(
        doc(db, 'families', familyId),
        { memoryCardStyle: style },
        { merge: true }
      )
      setMessage(style === 'classic' ? 'Switched to Classic memory cards' : 'Switched to Modern memory cards')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMemoryCardStyle(previous)
      setMessage('Failed to update memory card style')
    } finally {
      setSaving(false)
    }
  }

  const handleLoginImageUpload = async (url, publicId) => {
    if (!familyId) return
    try {
      await setDoc(
        doc(db, 'families', familyId),
        { loginHeaderImage: url, loginHeaderImagePublicId: publicId },
        { merge: true }
      )
      setLoginHeaderImage(url)
      setLoginHeaderImagePublicId(publicId)
      setMessage(url ? 'Login image updated!' : 'Login image removed.')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save image')
    }
  }

  return (
    <div className="bg-warm-white rounded-2xl p-4 lg:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-kaydo" />
        <h2 className="text-lg font-bold text-bark">Admin Settings</h2>
      </div>

      {message && (
        <p className="text-sm text-kaydo bg-cream-dark px-4 py-2 rounded-lg mb-4">
          {message}
        </p>
      )}

      {/* Login page header image */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-bark mb-1.5">
          <div className="flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4" />
            Login Page Image
          </div>
        </label>
        <p className="text-xs text-bark-muted mb-3">
          Upload a family photo to replace the default illustration on your login page. Visitors will see it when they open your family link.
        </p>
        <UploadWidget onUpload={handleLoginImageUpload} currentUrl={loginHeaderImage} unencrypted />
      </div>

      {/* Share link */}
      {shareLink && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-bark mb-1.5">
            <div className="flex items-center gap-1.5">
              <Link className="w-4 h-4" />
              Family Share Link
            </div>
          </label>
          <p className="text-xs text-bark-muted mb-3">
            Share this link with family and friends so they can access your memories.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 min-w-0 px-4 py-2.5 bg-cream-dark rounded-xl text-bark text-base outline-none select-all"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="btn-kaydo flex items-center gap-1.5 text-sm px-4"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Change shared password */}
      <form onSubmit={handleSavePassword} className="mb-6">
        <label className="block text-sm font-medium text-bark mb-1.5">
          Change Shared Password (Private Key)
        </label>
        <p className="text-xs text-bark-muted mb-3">
          This is the password family and friends use to access the site.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New shared password"
            className="flex-1 min-w-0 px-4 py-2.5 bg-cream-dark rounded-xl text-bark text-base placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-kaydo flex items-center gap-1.5 text-sm px-4"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </form>

      {/* Family name */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          Family Name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="e.g., The Millers"
            className="flex-1 min-w-0 px-4 py-2.5 bg-cream-dark rounded-xl text-bark text-base placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
          />
          <button
            type="button"
            onClick={handleSaveFamilyName}
            disabled={saving}
            className="btn-kaydo flex items-center gap-1.5 text-sm px-4"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      {/* Manage Admins */}
      <ManageAdminsPanel />

      {/* Memory card style */}
      <div className="mt-6 pt-6 border-t border-cream-dark">
        <label className="block text-sm font-medium text-bark mb-1.5">
          <div className="flex items-center gap-1.5">
            <Camera className="w-4 h-4" />
            Memory Card Style
          </div>
        </label>
        <p className="text-xs text-bark-muted mb-3">
          Choose how memories look in your family home feed. Everyone in the family sees the same style.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <CardStylePreview
            label="Modern"
            description="Clean and bright."
            selected={memoryCardStyle === 'modern'}
            disabled={saving}
            onSelect={() => handleSelectCardStyle('modern')}
            preview={<ModernPreview />}
          />
          <CardStylePreview
            label="Classic"
            description="Vintage film look."
            selected={memoryCardStyle === 'classic'}
            disabled={saving}
            onSelect={() => handleSelectCardStyle('classic')}
            preview={<ClassicPreview />}
          />
        </div>
      </div>

      {/* NAS Export / Backup */}
      <div className="mt-6 pt-6 border-t border-cream-dark">
        <label className="block text-sm font-medium text-bark mb-1.5">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-4 h-4" />
            Data Export / NAS Backup
          </div>
        </label>
        <p className="text-xs text-bark-muted mb-3">
          Download all your family's data and media as a ZIP file.
          Save it to your NAS, external drive, or cloud storage for safekeeping.
        </p>
        <NasExportButton />
      </div>
    </div>
  )
}

function CardStylePreview({ label, description, selected, disabled, onSelect, preview }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`text-left rounded-2xl border-2 p-3 transition-all ${
        selected
          ? 'border-kaydo bg-cream shadow-sm'
          : 'border-cream-dark bg-warm-white hover:border-kaydo/50'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={selected}
    >
      <div className="h-28 mb-2 rounded-xl overflow-hidden bg-cream-dark/40 flex items-center justify-center">
        {preview}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-bark">{label}</span>
        {selected && <Check className="w-4 h-4 text-kaydo" />}
      </div>
      <p className="text-xs text-bark-muted mt-0.5">{description}</p>
    </button>
  )
}

function ModernPreview() {
  return (
    <div className="bg-warm-white rounded-lg shadow-sm w-20">
      <div className="aspect-square bg-kaydo-light/50 rounded-t-lg" />
      <div className="px-2 py-1.5">
        <div className="h-1 w-10 bg-kaydo rounded-full" />
        <div className="h-1 w-14 bg-bark-muted/50 rounded-full mt-1" />
      </div>
    </div>
  )
}

function ClassicPreview() {
  return (
    <div className="bg-bark rounded-sm shadow-md p-1 w-20" style={{ transform: 'rotate(-1.2deg)' }}>
      <div className="flex items-center justify-between gap-0.5 px-0.5 pt-0.5">
        <span className="block h-0.5 w-1 bg-cream/80 rounded-[1px]" />
        <span className="block h-0.5 w-6 bg-cream/70 rounded-[1px]" />
        <span className="block h-0.5 w-1 bg-cream/80 rounded-[1px]" />
      </div>
      <div className="flex justify-between px-0.5 py-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="block w-1 h-0.5 rounded-[1px] bg-cream/80" />
        ))}
      </div>
      <div className="aspect-square bg-kaydo-light/60 mx-0.5" />
      <div className="flex justify-between px-0.5 py-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="block w-1 h-0.5 rounded-[1px] bg-cream/80" />
        ))}
      </div>
      <div className="flex items-center justify-between gap-0.5 px-0.5 pb-0.5">
        <span className="block h-0.5 w-1 bg-cream/80 rounded-[1px]" />
        <span className="block h-0.5 w-7 bg-cream/60 rounded-[1px]" />
        <span className="block h-0.5 w-1 bg-cream/80 rounded-[1px]" />
      </div>
    </div>
  )
}
