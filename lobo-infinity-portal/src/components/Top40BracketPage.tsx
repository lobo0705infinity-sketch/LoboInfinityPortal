import { Link } from 'react-router-dom'
import {
  buildCapabilityNavigation,
  getEventNavigationConfig,
} from '../config/eventNavigation'
import {
  TOP_40_PLACEHOLDER_BRACKET,
  type Top40BracketSection,
} from '../content/top40BracketPlaceholder'
import './Top40BracketPage.css'

const TOP_40_EVENT_ID = 'event-lobo-s-american-top-40'

export default function Top40BracketPage({
  bracket = TOP_40_PLACEHOLDER_BRACKET,
}: {
  bracket?: Top40BracketSection[]
}) {
  const config = getEventNavigationConfig(TOP_40_EVENT_ID)
  const eventNavigationItems = config
    ? buildCapabilityNavigation(config).map((item) => ({ href: item.to, label: item.label }))
    : []

  return (
    <main className="portal-shell event-overview-shell top40-bracket-page" data-event-section="bracket">
      <figure className="panel top40-bracket-hero" aria-label="Lobo's American Top 40 Bracket artwork">
        <img
          alt="Lobo's American Top 40 Bracket"
          height="941"
          src="/assets/events/top-40-bracket.png"
          width="1672"
        />
      </figure>

      <nav className="event-home-nav" aria-label="Event navigation">
        {eventNavigationItems.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>{item.label}</Link>
        ))}
      </nav>

      <section className="panel top40-bracket-intro" aria-labelledby="top40-bracket-title">
        <p className="eyebrow">Lobo&apos;s American Top 40</p>
        <h1 id="top40-bracket-title">Tournament Bracket</h1>
        <p>Forty players enter a complete double-elimination bracket. A player is eliminated after their second loss.</p>
      </section>

      <div className="top40-bracket-sections">
        {bracket.map((section) => (
          <BracketSection key={section.id} section={section} />
        ))}
      </div>
    </main>
  )
}

function BracketSection({ section }: { section: Top40BracketSection }) {
  return (
    <section className="panel top40-bracket-panel" aria-labelledby={`top40-${section.id}-title`}>
      <div className="top40-bracket-panel-heading">
        <p className="eyebrow">Double Elimination</p>
        <h2 id={`top40-${section.id}-title`}>{section.title}</h2>
      </div>
      <div className="top40-bracket-scroll" tabIndex={0} aria-label={`${section.title} rounds`}>
        <div className="top40-bracket-rounds">
          {section.rounds.map((round) => (
            <section className="top40-bracket-round" key={round.id} aria-labelledby={`top40-${round.id}-title`}>
              <h3 id={`top40-${round.id}-title`}>{round.title}</h3>
              <div className="top40-bracket-matches">
                {round.matches.map((bracketMatch) => (
                  <article className="top40-bracket-match" key={bracketMatch.id}>
                    <strong>{bracketMatch.id}</strong>
                    {bracketMatch.slots.map((entry, index) => (
                      <span key={`${bracketMatch.id}-${index}`}>{entry.label}</span>
                    ))}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}
