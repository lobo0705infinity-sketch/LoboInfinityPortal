import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function ProfileMenu({ mobile = false }: { mobile?: boolean }) {
  const auth = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signingIn, setSigningIn] = useState(false)
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
    signInWithPassword,
    signOut,
    user,
  } = auth

  async function handleNativeSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSigningIn(true)

    try {
      const signedIn = await signInWithPassword(email, password)
      if (signedIn) {
        setPassword('')
      }
    } finally {
      setSigningIn(false)
    }
  }

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
        <form className="native-signin-form" onSubmit={handleNativeSignIn}>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button disabled={signingIn} type="submit">
            {signingIn ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
        {oauthConfigured ? (
          <div className="google-signin-fallback-group">
            <small>Use Google Sign-In</small>
            <div aria-label="Use Google Sign-In" className="google-signin-shell">
              <span aria-hidden="true" className="google-signin-fallback">Use Google Sign-In</span>
              <div ref={buttonRef} className="google-signin-slot" />
            </div>
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
