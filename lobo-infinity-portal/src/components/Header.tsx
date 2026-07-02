import { useEffect, useState } from 'react'
import GlobalSearch from './GlobalSearch'
import NotificationCenter from './NotificationCenter'
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
        <p className="header-kicker">Portal 3.0</p>
      </div>

      <div className="header-actions">
        {matchSubmissionUrl ? (
          <a
            className="submit-match-button"
            href={matchSubmissionUrl}
            rel="noreferrer"
            target="_blank"
          >
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
