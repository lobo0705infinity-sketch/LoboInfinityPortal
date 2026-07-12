import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function ProfileMenu({ mobile = false }: { mobile?: boolean }) {
  const auth = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement | null>(null)
  const renderedButtonRef = useRef<HTMLElement | null>(null)
  const panelId = mobile ? 'mobile-profile-menu-panel' : 'profile-menu-panel'
  const {
    authenticated,
    error,
    googleReady,
    isAtLeastRole,
    oauthConfigured,
    renderSignInButton,
    signOut,
    user,
  } = auth

  useEffect(() => {
    if (
      authenticated ||
      !googleReady ||
      !oauthConfigured ||
      !buttonRef.current
    ) {
      return
    }

    if (renderedButtonRef.current === buttonRef.current) {
      return
    }

    renderSignInButton(buttonRef.current, mobile ? { width: 132 } : undefined)
    renderedButtonRef.current = buttonRef.current
  }, [authenticated, googleReady, mobile, oauthConfigured, renderSignInButton])

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

  if (!authenticated) {
    return (
      <div className={mobile ? 'profile-menu signed-out mobile-profile-menu' : 'profile-menu signed-out'}>
        {oauthConfigured ? (
          <div aria-label="Sign In" className="google-signin-shell">
            <span aria-hidden="true" className="google-signin-fallback">Sign In</span>
            <div ref={buttonRef} className="google-signin-slot" />
          </div>
        ) : (
          <div className="oauth-pending" title="Add Google OAuth Client ID in Settings">
            <span>Guest</span>
            <small>OAuth pending</small>
          </div>
        )}
        {error ? <small className="auth-inline-error">{error}</small> : null}
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
        {user.avatarUrl ? (
          <img alt="" src={user.avatarUrl} />
        ) : (
          <span>{user.displayName.slice(0, 1).toUpperCase()}</span>
        )}
        <strong>{mobile ? 'Account' : user.displayName}</strong>
      </button>

      {isOpen ? (
        <div
          aria-label="Profile menu"
          className="profile-menu-panel"
          id={panelId}
          role="dialog"
        >
          <div className="profile-menu-card">
            {user.avatarUrl ? <img alt="" src={user.avatarUrl} /> : null}
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
            <span>{user.role}</span>
          </div>
          <Link onClick={() => setIsOpen(false)} to="/profile">
            My Profile
          </Link>
          {isAtLeastRole('Assistant Commissioner') ? (
            <Link onClick={() => setIsOpen(false)} to="/commissioner">
              Commissioner Dashboard
            </Link>
          ) : null}
          <button
            onClick={() => {
              signOut()
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
