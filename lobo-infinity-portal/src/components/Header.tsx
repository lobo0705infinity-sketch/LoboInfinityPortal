import { useEffect, useState } from 'react'
import GlobalSearch from './GlobalSearch'
import LeagueCrest from './LeagueCrest'
import NotificationCenter from './NotificationCenter'
import PortalIcon from './PortalIcon'
import QuickJump from './QuickJump'
import { apiClient } from '../services/api'

function Header() {
  const [matchSubmissionUrl, setMatchSubmissionUrl] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getSettings({
        signal: controller.signal,
      })
      .then((settings) => {
        setMatchSubmissionUrl(settings.googleFormUrl)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMatchSubmissionUrl('')
        }
      })

    return () => {
      controller.abort()
    }
  }, [])

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
        {matchSubmissionUrl ? (
          <a
            className="submit-match-button"
            href={matchSubmissionUrl}
            rel="noreferrer"
            target="_blank"
          >
            <PortalIcon name="submit" />
            Submit Match
          </a>
        ) : null}
        <GlobalSearch />
        <QuickJump />
        <NotificationCenter />
        <div className="header-status" aria-label="Portal status">
          <span className="status-light" />
          <span>Live</span>
        </div>
      </div>
    </header>
  )
}

export default Header
