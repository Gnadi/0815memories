import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, getDocs, where } from 'firebase/firestore'
import { db, auth, isConfigured } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout/Layout'
import styles from './AdminDashboard.module.css'

export default function AdminDashboard() {
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ memories: 0, moments: 0, total: 0 })
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchStats() {
      if (!db) return
      try {
        const allDocs = await getDocs(collection(db, 'memories'))
        let memories = 0
        let moments = 0
        allDocs.forEach(doc => {
          const data = doc.data()
          if (data.type === 'moment') moments++
          else memories++
        })
        setStats({ memories, moments, total: memories + moments })
      } catch (err) {
        console.error('Error fetching stats:', err)
      }
    }
    fetchStats()
  }, [])

  async function handleSetPassword(e) {
    e.preventDefault()
    setPasswordMsg('')
    setPasswordError('')
    setSaving(true)

    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPasswordMsg('Shared password updated successfully!')
      setNewPassword('')
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <Layout>
      <div className={styles.page}>
        <h1 className={styles.title}>Admin Dashboard</h1>
        <p className={styles.subtitle}>Manage your family hearth</p>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Overview</h2>
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.total}</div>
              <div className={styles.statLabel}>Total Posts</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.memories}</div>
              <div className={styles.statLabel}>Memories</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.moments}</div>
              <div className={styles.statLabel}>Moments</div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.actions}>
            <button className={styles.button} onClick={() => navigate('/admin/post')}>
              Post a Memory
            </button>
            <button className={styles.button} onClick={() => navigate('/admin/post?type=moment')}>
              Add a Moment
            </button>
            <button className={styles.buttonSecondary} onClick={() => navigate('/home')}>
              View Home
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Shared Password</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '16px' }}>
            Set the password that family and friends use to access the site.
          </p>
          <form onSubmit={handleSetPassword}>
            <label className={styles.fieldLabel}>New Shared Password</label>
            <input
              type="text"
              className={styles.input}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new shared password"
              minLength={4}
              required
            />
            <button type="submit" className={styles.button} disabled={saving}>
              {saving ? 'Saving...' : 'Update Password'}
            </button>
            {passwordMsg && <p className={styles.success}>{passwordMsg}</p>}
            {passwordError && <p className={styles.error}>{passwordError}</p>}
          </form>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Account</h2>
          <button className={styles.buttonSecondary} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>
    </Layout>
  )
}
