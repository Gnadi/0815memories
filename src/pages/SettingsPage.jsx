import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import SettingsPanel from '../components/admin/SettingsPanel'

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAdmin) navigate('/home', { replace: true })
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-cream flex overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />
        <main className="flex-1 px-4 lg:px-8 py-6 max-w-3xl mx-auto w-full">
          <h1 className="text-2xl font-bold text-bark mb-6">Settings</h1>
          <SettingsPanel />
        </main>
      </div>
    </div>
  )
}
