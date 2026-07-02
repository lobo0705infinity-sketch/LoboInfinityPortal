import GlobalSearch from './GlobalSearch'
import NotificationCenter from './NotificationCenter'
import QuickJump from './QuickJump'

function Header() {
  return (
    <header className="portal-header">
      <div className="header-title">
        <p className="header-kicker">Portal 3.0</p>
      </div>

      <div className="header-actions">
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
