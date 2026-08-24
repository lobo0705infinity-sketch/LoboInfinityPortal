import { lazy, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import GlobalSearch from './GlobalSearch'
import LeagueCrest from './LeagueCrest'
import NotificationCenter from './NotificationCenter'
import PortalIcon from './PortalIcon'
import ProfileMenu from './ProfileMenu'
import QuickJump from './QuickJump'

const MobileNavigationDrawer = lazy(() => import('./MobileNavigationDrawer'))
type ActiveMobilePanel = 'menu' | 'search' | null
const kofiSupportUrl = 'https://ko-fi.com/lobo0705'
const kofiSupportLabel = 'Support the Lobo Infinity League on Ko-fi'

function Header() {
  const auth = useAuth()
  const location = useLocation()
  const [activeMobilePanel, setActiveMobilePanel] = useState<ActiveMobilePanel>(null)
  const submitGamePath = `/submit-game?f=${location.pathname}`
  const isMobileMenuOpen = activeMobilePanel === 'menu'
  const isMobileSearchOpen = activeMobilePanel === 'search'
  const mobilePanelLayer = typeof document === 'undefined'
    ? null
    : createPortal(
      <>
        {activeMobilePanel ? (
          <button
            aria-label="Close mobile panel"
            className="mobile-panel-backdrop"
            onClick={() => setActiveMobilePanel(null)}
            type="button"
          />
        ) : null}

        {isMobileMenuOpen ? (
          <Suspense fallback={null}>
            <MobileNavigationDrawer
              authenticated={auth.authenticated}
              commissioner={auth.isAtLeastRole('Commissioner')}
              onClose={() => setActiveMobilePanel(null)}
            />
          </Suspense>
        ) : null}
      </>,
      document.body,
    )

  useEffect(() => {
    if (!activeMobilePanel) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveMobilePanel(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeMobilePanel])

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return
    }

    const body = document.body
    const root = document.documentElement
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const previousBodyStyles = {
      left: body.style.left,
      overflow: body.style.overflow,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
      width: body.style.width,
    }
    const previousRootOverflow = root.style.overflow
    const previousScrollBehavior = root.style.scrollBehavior

    root.style.overflow = 'hidden'
    body.style.left = '0'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.right = '0'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      root.style.overflow = previousRootOverflow
      body.style.left = previousBodyStyles.left
      body.style.overflow = previousBodyStyles.overflow
      body.style.position = previousBodyStyles.position
      body.style.right = previousBodyStyles.right
      body.style.top = previousBodyStyles.top
      body.style.width = previousBodyStyles.width
      root.style.scrollBehavior = 'auto'
      window.scrollTo(scrollX, scrollY)
      root.style.scrollBehavior = previousScrollBehavior
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    setActiveMobilePanel(null)
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    const mobileShell = window.matchMedia('(max-width: 920px)')

    function handleShellChange(event: MediaQueryListEvent) {
      if (!event.matches) {
        setActiveMobilePanel(null)
      }
    }

    mobileShell.addEventListener('change', handleShellChange)

    return () => {
      mobileShell.removeEventListener('change', handleShellChange)
    }
  }, [])

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
          onClick={() => setActiveMobilePanel((panel) => panel === 'menu' ? null : 'menu')}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <Link
          aria-label="Dashboard"
          className="mobile-app-brand"
          onClick={() => setActiveMobilePanel(null)}
          to="/"
        >
          <LeagueCrest compact />
          <span>Lobo</span>
        </Link>
        <div className="mobile-app-actions">
          <Link
            aria-label="Submit Game"
            className="mobile-header-action mobile-submit-action"
            onClick={() => setActiveMobilePanel(null)}
            to={submitGamePath}
          >
            <PortalIcon name="submit" />
          </Link>
          <a
            aria-label={kofiSupportLabel}
            className="mobile-header-action mobile-support-action"
            href={kofiSupportUrl}
            rel="noopener noreferrer"
            target="_blank"
            title={kofiSupportLabel}
          >
            <PortalIcon name="support" />
          </a>
          {auth.authenticated ? (
            <>
              <GlobalSearch
                isMobileOpen={isMobileSearchOpen}
                mode="mobile"
                onMobileClose={() => setActiveMobilePanel(null)}
                onMobileOpen={() => setActiveMobilePanel('search')}
              />
              <NotificationCenter compact />
            </>
          ) : null}
          {auth.authenticated ? <ProfileMenu mobile /> : null}
        </div>
      </div>

      {mobilePanelLayer}

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
        <a
          aria-label={kofiSupportLabel}
          className="header-support-button"
          href={kofiSupportUrl}
          rel="noopener noreferrer"
          target="_blank"
          title={kofiSupportLabel}
        >
          <PortalIcon name="support" />
          <span>Support Us</span>
        </a>
        <GlobalSearch />
        <QuickJump />
        <NotificationCenter />
        {auth.authenticated ? <ProfileMenu /> : null}
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
