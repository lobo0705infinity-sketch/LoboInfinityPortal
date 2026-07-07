import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function ProfileMenu({ mobile = false }: { mobile?: boolean }) {
  const auth = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement | null>(null)
  const panelId = mobile ? 'mobile-profile-menu-panel' : 'profile-menu-panel'

  useEffect(() => {
    if (
      auth.authenticated ||
      !auth.googleReady ||
      !auth.oauthConfigured ||
      !buttonRef.current
    ) {
      return
    }

    auth.renderSignInButton(buttonRef.current)
  }, [auth])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!auth.authenticated) {
    return (
      <div className={mobile ? 'profile-menu signed-out mobile-profile-menu' : 'profile-menu signed-out'}>
        {auth.oauthConfigured ? (
          <div ref={buttonRef} className="google-signin-slot" />
        ) : (
          <div className="oauth-pending" title="Add Google OAuth Client ID in Settings">
            <span>Guest</span>
            <small>OAuth pending</small>
          </div>
        )}
        {auth.error ? <small className="auth-inline-error">{auth.error}</small> : null}
      </div>
    )
  }

  return (
    <div className={mobile ? 'profile-menu mobile-profile-menu' : 'profile-menu'}>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Open profile menu"
        className="profile-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {auth.user.avatarUrl ? (
          <img alt="" src={auth.user.avatarUrl} />
        ) : (
          <span>{auth.user.displayName.slice(0, 1).toUpperCase()}</span>
        )}
        <strong>{mobile ? 'Account' : auth.user.displayName}</strong>
      </button>

      {isOpen ? (
        <div
          aria-label="Profile menu"
          className="profile-menu-panel"
          id={panelId}
          role="dialog"
        >
          <div className="profile-menu-card">
            {auth.user.avatarUrl ? <img alt="" src={auth.user.avatarUrl} /> : null}
            <strong>{auth.user.displayName}</strong>
            <small>{auth.user.email}</small>
            <span>{auth.user.role}</span>
          </div>
          <Link onClick={() => setIsOpen(false)} to="/profile">
            My Profile
          </Link>
          {auth.isAtLeastRole('Assistant Commissioner') ? (
            <Link onClick={() => setIsOpen(false)} to="/commissioner">
              Commissioner Dashboard
            </Link>
          ) : null}
          <button
            onClick={() => {
              auth.signOut()
              setIsOpen(false)
            }}
            type="button"
          >
            Sign Out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default ProfileMenu
