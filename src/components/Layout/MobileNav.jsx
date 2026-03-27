import { NavLink, useNavigate } from 'react-router-dom'
import { HiHome, HiPhotograph, HiUser, HiCollection, HiPencil, HiBell } from 'react-icons/hi'
import { useAuth } from '../../contexts/AuthContext'
import styles from './MobileNav.module.css'

const bottomItems = [
  { to: '/home', icon: HiHome, label: 'Home' },
  { to: '/album', icon: HiPhotograph, label: 'Discover' },
  { to: '/album', icon: HiCollection, label: 'Memories' },
  { to: '/home', icon: HiUser, label: 'Profile' }
]

export default function MobileNav() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🏠</span>
          <span className={styles.logoText}>Our Hearth</span>
        </div>
        <button className={styles.bellButton} aria-label="Notifications">
          <HiBell />
        </button>
      </header>

      <nav className={styles.bottomNav}>
        {bottomItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              `${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ''}`
            }
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {isAdmin && (
        <button
          className={styles.fab}
          onClick={() => navigate('/admin/post')}
          aria-label="Post a Memory"
        >
          <HiPencil />
        </button>
      )}
    </>
  )
}
