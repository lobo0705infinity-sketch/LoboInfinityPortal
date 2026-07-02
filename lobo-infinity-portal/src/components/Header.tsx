import GlobalSearch from './GlobalSearch'

function Header() {
  return (
    <header className="portal-header">
      <div className="header-title">
        <p className="header-kicker">Portal 3.0</p>
      </div>

      <div className="header-actions">
        <GlobalSearch />
        <div className="header-status" aria-label="Portal status">
          <span className="status-light" />
          <span>Live</span>
        </div>
      </div>
    </header>
  )
}

export default Header
