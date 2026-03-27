import { NavLink, useNavigate } from 'react-router-dom'
import { HiHome, HiPhotograph, HiMail, HiUser, HiCollection, HiPencil } from 'react-icons/hi'
import { useAuth } from '../../contexts/AuthContext'
import styles from './Sidebar.module.css'

const navItems = [
  { to: '/home', icon: HiHome, label: 'Home' },
  { to: '/album', icon: HiPhotograph, label: 'Discover' },
  { to: '/home', icon: HiMail, label: 'Messages' },
  { to: '/home', icon: HiUser, label: 'Profile' },
  { to: '/album', icon: HiCollection, label: 'Our Memories' }
]

export default function Sidebar() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🏠</span>
        <span className={styles.logoText}>The Living Room</span>
      </div>
      <p className={styles.tagline}>Our Private Space</p>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <item.icon className={styles.navIcon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {isAdmin && (
        <button
          className={styles.postButton}
          onClick={() => navigate('/admin/post')}
        >
          <HiPencil />
          Post a Memory
        </button>
      )}
    </aside>
  )
}
