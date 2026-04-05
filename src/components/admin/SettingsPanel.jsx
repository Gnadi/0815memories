import { useState, useEffect } from 'react'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAuth } from '../../context/AuthContext'
import bcrypt from 'bcryptjs'
import { Settings, Save, Copy, Check, Link, Image as ImageIcon, HardDrive } from 'lucide-react'
import { generateSlug, isSlugAvailable } from '../../utils/familySlug'
import UploadWidget from './UploadWidget'
import NasExportButton from './NasExportButton'

export default function SettingsPanel() {
  const { familyId } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [familySlug, setFamilySlug] = useState('')
  const [loginHeaderImage, setLoginHeaderImage] = useState('')
  const [loginHeaderImagePublicId, setLoginHeaderImagePublicId] = useState('')
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
        <Settings className="w-5 h-5 text-hearth" />
        <h2 className="text-lg font-bold text-bark">Admin Settings</h2>
      </div>

      {message && (
        <p className="text-sm text-hearth bg-cream-dark px-4 py-2 rounded-lg mb-4">
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
              className="btn-hearth flex items-center gap-1.5 text-sm px-4"
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
            className="flex-1 min-w-0 px-4 py-2.5 bg-cream-dark rounded-xl text-bark text-base placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-hearth flex items-center gap-1.5 text-sm px-4"
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
            className="flex-1 min-w-0 px-4 py-2.5 bg-cream-dark rounded-xl text-bark text-base placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
          />
          <button
            type="button"
            onClick={handleSaveFamilyName}
            disabled={saving}
            className="btn-hearth flex items-center gap-1.5 text-sm px-4"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
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
