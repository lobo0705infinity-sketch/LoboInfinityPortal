import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import GlobalSearch from './GlobalSearch'
import LeagueCrest from './LeagueCrest'
import NotificationCenter from './NotificationCenter'
import PortalIcon from './PortalIcon'
import ProfileMenu from './ProfileMenu'
import QuickJump from './QuickJump'

const MobileNavigationDrawer = lazy(() => import('./MobileNavigationDrawer'))

function Header() {
  const auth = useAuth()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const submitGamePath = `/submit-game?f=${location.pathname}`

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen])

  return (
    <header
      className={
        auth.authenticated
          ? 'portal-header authenticated'
          : 'portal-header signed-out'
      }
    >
      <div className="mobile-app-bar">
        <button
          aria-expanded={isMobileMenuOpen}
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-controls="mobile-navigation-menu"
          className="mobile-menu-button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <Link
          aria-label="Dashboard"
          className="mobile-app-brand"
          onClick={() => setIsMobileMenuOpen(false)}
          to="/"
        >
          <LeagueCrest compact />
          <span>Lobo</span>
        </Link>
        <div className="mobile-app-actions">
          <Link
            aria-label="Submit Game"
            className="mobile-header-action mobile-submit-action"
            onClick={() => setIsMobileMenuOpen(false)}
            to={submitGamePath}
          >
            <PortalIcon name="submit" />
          </Link>
          {auth.authenticated ? (
            <>
              <GlobalSearch mode="mobile" />
              <NotificationCenter compact />
            </>
          ) : null}
          <ProfileMenu mobile />
        </div>
      </div>

      {isMobileMenuOpen ? (
        <Suspense fallback={null}>
          <MobileNavigationDrawer
            authenticated={auth.authenticated}
            commissioner={auth.isAtLeastRole('Commissioner')}
            onClose={() => setIsMobileMenuOpen(false)}
          />
        </Suspense>
      ) : null}

      <div className="header-title">
        <LeagueCrest compact />
        <div>
          <p className="header-kicker">League Command Network</p>
          <strong>Lobo Infinity League</strong>
        </div>
      </div>

      <div className="header-actions">
        <Link
          className="submit-match-button"
          to={submitGamePath}
        >
          <PortalIcon name="submit" />
          Submit Game
        </Link>
        <GlobalSearch />
        <QuickJump />
        <NotificationCenter />
        <ProfileMenu />
        <div className="header-status" aria-label="Portal status">
          <span className="status-light" />
          <span>Live</span>
        </div>
      </div>
      <Link
        aria-label="Submit Game"
        className="mobile-submit-fab"
        to={submitGamePath}
      >
        <PortalIcon name="submit" />
      </Link>
    </header>
  )
}

export default Header
