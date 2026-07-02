import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function ProfileMenu() {
  const auth = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement | null>(null)

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

  if (!auth.authenticated) {
    return (
      <div className="profile-menu signed-out">
        {auth.oauthConfigured ? (
          <div ref={buttonRef} className="google-signin-slot" />
        ) : (
          <div className="oauth-pending" title="Add Google OAuth Client ID in Settings">
            <span>Guest</span>
            <small>OAuth pending</small>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="profile-menu">
      <button
        aria-expanded={isOpen}
        className="profile-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {auth.user.avatarUrl ? (
          <img alt="" src={auth.user.avatarUrl} />
        ) : (
          <span>{auth.user.displayName.slice(0, 1).toUpperCase()}</span>
        )}
        <strong>{auth.user.displayName}</strong>
      </button>

      {isOpen ? (
        <div className="profile-menu-panel" role="dialog" aria-label="Profile menu">
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
