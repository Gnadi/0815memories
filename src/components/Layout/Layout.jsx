import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import styles from './Layout.module.css'

export default function Layout({ children }) {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <MobileNav />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
