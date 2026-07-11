import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import GlobalSearch from './GlobalSearch'
import LeagueCrest from './LeagueCrest'
import NotificationCenter from './NotificationCenter'
import PortalIcon from './PortalIcon'
import ProfileMenu from './ProfileMenu'
import QuickJump from './QuickJump'

const MobileNavigationDrawer = lazy(() => import('./MobileNavigationDrawer'))

function Header() {
  const auth = useAuth()
  const { settings } = useSettings()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const matchSubmissionUrl = settings?.googleFormUrl ?? ''
  const submissionsEnabled = settings?.submissionEnabled !== 'false'
  const buttonVisible = settings?.submissionButtonVisible !== 'false'
  const buttonText = settings?.submissionButtonText || 'Submit Match'
  const submitEnabled = Boolean(matchSubmissionUrl && submissionsEnabled && buttonVisible)

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
    <header className="portal-header">
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
          <GlobalSearch mode="mobile" />
          <NotificationCenter compact />
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
        {submitEnabled ? (
          <a
            className="submit-match-button"
            href={matchSubmissionUrl}
            rel="noreferrer"
            target="_blank"
          >
            <PortalIcon name="submit" />
            {buttonText}
          </a>
        ) : null}
        <GlobalSearch />
        <QuickJump />
        <NotificationCenter />
        <ProfileMenu />
        <div className="header-status" aria-label="Portal status">
          <span className="status-light" />
          <span>Live</span>
        </div>
      </div>
      {submitEnabled ? (
        <a
          aria-label={buttonText}
          className="mobile-submit-fab"
          href={matchSubmissionUrl}
          rel="noreferrer"
          target="_blank"
        >
          <PortalIcon name="submit" />
        </a>
      ) : null}
    </header>
  )
}

export default Header
