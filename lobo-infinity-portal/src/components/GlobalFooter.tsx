import DiscordCommunityLink from './DiscordCommunityLink'
import LeagueCrest from './LeagueCrest'
import { LOBO_YOUTUBE_CHANNEL_URL } from '../config/promoVideos'

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
        <a className="global-footer-icon-link" href={LOBO_YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer">YouTube ↗</a>
      </nav>
    </footer>
  )
}

export default GlobalFooter
