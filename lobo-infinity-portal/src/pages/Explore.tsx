import CompactArtwork from '../components/CompactArtwork'
import { Link } from 'react-router-dom'
import PortalIcon from '../components/PortalIcon'
import { communityItems } from '../components/sidebarNavigation'
import './Explore.css'

const featured = [
  {
    title: 'Portal Guide',
    description: 'Watch the four-minute walkthrough or jump to a chapter.',
    icon: 'rules' as const,
    to: '/portal-guide',
  },
  {
    title: 'Army Intelligence',
    description: 'Explore submitted lists, model usage, specialists, and tactical roles.',
    icon: 'army' as const,
    to: '/army-intelligence',
  },
  {
    title: 'Battle Reports',
    description: 'Read the result, submitted highlight, and review of a real game.',
    icon: 'rules' as const,
    to: '/games',
  },
  {
    title: "Lobo's Little Helper",
    description: 'See army list, matchup, and ARO tools you can use in Discord.',
    icon: 'discord' as const,
    to: '/little-helper',
  },
]

const directory = communityItems.filter((item) => !featured.some((feature) => feature.to === item.to))

function Explore() {
  return (
    <main className="portal-shell portal-explore-page">
      <CompactArtwork title="Explore" eyebrow="Public portal" src="/assets/portal-artwork/explore-approved-v1.webp"/>
      <p>Follow a faction, a player, a mission, a TTS table, or the story behind a game.</p>

      <nav className="portal-explore-features" aria-label="Start exploring">
        {featured.map((item) => (
          <Link className="portal-explore-feature" key={item.to} to={item.to}>
            <span className="portal-explore-feature-icon"><PortalIcon name={item.icon} /></span>
            <span><strong>{item.title}</strong><small>{item.description}</small></span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>

      <section className="portal-explore-directory" aria-labelledby="explore-directories-title">
        <h2 id="explore-directories-title">Browse the portal</h2>
        <nav aria-label="Explore directories">
          {directory.map((item) => (
            <Link key={item.to} to={item.to}>
              <PortalIcon name={item.icon} />
              <span>{item.label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  )
}

export default Explore
