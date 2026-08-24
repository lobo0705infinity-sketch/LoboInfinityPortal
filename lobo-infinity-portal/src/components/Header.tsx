import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import GlobalSearch from './GlobalSearch'
import LeagueCrest from './LeagueCrest'
import NotificationCenter from './NotificationCenter'
import PortalIcon from './PortalIcon'
import ProfileMenu from './ProfileMenu'
import QuickJump from './QuickJump'

const kofiSupportUrl = 'https://ko-fi.com/lobo0705'
const kofiSupportLabel = 'Support the Lobo Infinity League on Ko-fi'

function Header() {
  const auth = useAuth()
  const location = useLocation()
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const submitGamePath = `/submit-game?f=${location.pathname}`
  const mobilePanelLayer = typeof document === 'undefined'
    ? null
    : createPortal(
      <>
        {isMobileSearchOpen ? (
          <button
            aria-label="Close mobile panel"
            className="mobile-panel-backdrop"
            onClick={() => setIsMobileSearchOpen(false)}
            type="button"
          />
        ) : null}
      </>,
      document.body,
    )

  return (
    <header
      className={
        auth.authenticated
          ? 'portal-header authenticated'
          : 'portal-header signed-out'
      }
    >
      <div className="mobile-app-bar">
        <Link
          aria-label="Dashboard"
          className="mobile-app-brand"
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
                onMobileClose={() => setIsMobileSearchOpen(false)}
                onMobileOpen={() => setIsMobileSearchOpen(true)}
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
