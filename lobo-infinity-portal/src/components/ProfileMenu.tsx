import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function ProfileMenu({ mobile = false }: { mobile?: boolean }) {
  const auth = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const panelId = mobile ? 'mobile-profile-menu-panel' : 'profile-menu-panel'

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!auth.authenticated) return null

  return (
    <div className={mobile ? 'profile-menu mobile-profile-menu' : 'profile-menu'}>
      <button aria-controls={panelId} aria-expanded={isOpen} aria-haspopup="dialog" aria-label="Open Commissioner menu" className="profile-trigger" onClick={() => setIsOpen((open) => !open)} type="button">
        <span>{auth.user.displayName.slice(0, 1).toUpperCase()}</span>
        <strong>{mobile ? 'Commissioner' : auth.user.displayName}</strong>
      </button>
      {isOpen ? (
        <div aria-label="Commissioner menu" className="profile-menu-panel" id={panelId} role="dialog">
          <div className="profile-menu-card"><strong>{auth.user.displayName}</strong><span>Commissioner</span></div>
          <Link onClick={() => setIsOpen(false)} to="/commissioner">Commissioner Dashboard</Link>
          <button onClick={() => { void auth.signOut(); setIsOpen(false) }} type="button">Sign Out</button>
        </div>
      ) : null}
    </div>
  )
}

export default ProfileMenu
