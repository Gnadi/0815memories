import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import bcrypt from 'bcryptjs'
import { Settings, Save } from 'lucide-react'

export default function SettingsPanel() {
  const [newPassword, setNewPassword] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleSavePassword = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 4) {
      setMessage('Password must be at least 4 characters')
      return
    }

    setSaving(true)
    try {
      const hashed = await bcrypt.hash(newPassword, 10)
      await setDoc(
        doc(db, 'settings', 'access'),
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
    if (!familyName) return
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'settings', 'access'),
        { familyName },
        { merge: true }
      )
      setMessage('Family name updated!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage('Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-warm-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-hearth" />
        <h2 className="text-lg font-bold text-bark">Admin Settings</h2>
      </div>

      {message && (
        <p className="text-sm text-hearth bg-cream-dark px-4 py-2 rounded-lg mb-4">
          {message}
        </p>
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
            className="flex-1 px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
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
            className="flex-1 px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
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
    </div>
  )
}
