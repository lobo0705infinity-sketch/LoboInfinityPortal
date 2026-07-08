import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import GlobalSearch from './GlobalSearch'
import LeagueCrest from './LeagueCrest'
import NotificationCenter from './NotificationCenter'
import PortalIcon from './PortalIcon'
import ProfileMenu from './ProfileMenu'
import QuickJump from './QuickJump'
import type { PortalSettings } from '../services/api'
import { getSettings } from '../services/lightApi'
import { preloadRoute } from '../services/routePreload'

function Header() {
  const auth = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [settings, setSettings] = useState<PortalSettings | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    getSettings({
      signal: controller.signal,
    })
      .then((settings) => {
        setSettings(settings)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSettings(null)
        }
      })

    return () => {
      controller.abort()
    }
  }, [])

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

  const mobileMenuItems = [
    { label: 'Dashboard', to: '/' },
    { label: 'Match Finder', to: '/match-finder' },
    { label: 'Standings', to: '/standings' },
    { label: 'Notifications', to: '/notifications' },
    ...(auth.authenticated
      ? [
          { label: 'My Profile', to: '/profile' },
          { label: 'Army Lists', to: '/army-lists' },
          { label: 'Timeline', to: '/timeline' },
        ]
      : []),
    { label: 'Players', to: '/players' },
    { label: 'Factions', to: '/factions' },
    { label: 'Missions', to: '/missions' },
    { label: 'Hall of Fame', to: '/hall-of-fame' },
    ...(auth.isAtLeastRole('Assistant Commissioner')
      ? [
          { label: 'Commissioner', to: '/commissioner' },
          { label: 'Event Manager', to: '/commissioner/event-manager' },
          { label: 'Automation', to: '/automation' },
          { label: 'Integrity', to: '/integrity' },
        ]
      : []),
    ...(auth.isAtLeastRole('Commissioner')
      ? [{ label: 'Diagnostics', to: '/diagnostics' }]
      : []),
  ]

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
        <div
          aria-label="Mobile navigation"
          aria-modal="true"
          className="mobile-menu-sheet"
          id="mobile-navigation-menu"
          role="dialog"
        >
          <div className="mobile-menu-heading">
            <strong>Menu</strong>
            <button
              aria-label="Close navigation menu"
              onClick={() => setIsMobileMenuOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <nav aria-label="Mobile portal sections">
            {mobileMenuItems.map((item) => (
              <Link
                key={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                onFocus={() => preloadRoute(item.to)}
                onMouseEnter={() => preloadRoute(item.to)}
                onTouchStart={() => preloadRoute(item.to)}
                to={item.to}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <ProfileMenu mobile />
        </div>
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
