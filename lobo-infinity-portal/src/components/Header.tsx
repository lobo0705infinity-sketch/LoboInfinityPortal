import { useEffect, useState } from 'react'
import GlobalSearch from './GlobalSearch'
import LeagueCrest from './LeagueCrest'
import NotificationCenter from './NotificationCenter'
import PortalIcon from './PortalIcon'
import ProfileMenu from './ProfileMenu'
import QuickJump from './QuickJump'
import type { PortalSettings } from '../services/api'
import { getSettings } from '../services/lightApi'

function Header() {
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

  return (
    <header className="portal-header">
      <div className="header-title">
        <LeagueCrest compact />
        <div>
          <p className="header-kicker">League Command Network</p>
          <strong>Lobo Infinity League</strong>
        </div>
      </div>

      <div className="header-actions">
        {matchSubmissionUrl && submissionsEnabled && buttonVisible ? (
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
    </header>
  )
}

export default Header
