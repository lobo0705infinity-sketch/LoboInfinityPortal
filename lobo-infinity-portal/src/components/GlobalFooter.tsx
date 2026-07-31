import DiscordCommunityLink from './DiscordCommunityLink'
import LeagueCrest from './LeagueCrest'

function GlobalFooter() {
  return (
    <footer className="global-footer" aria-label="Portal footer">
      <div>
        <LeagueCrest compact />
        <span>Lobo Infinity League</span>
      </div>
      <nav aria-label="Community links">
        <DiscordCommunityLink className="global-footer-icon-link" icon>
          <span>Discord</span>
        </DiscordCommunityLink>
      </nav>
    </footer>
  )
}

export default GlobalFooter
