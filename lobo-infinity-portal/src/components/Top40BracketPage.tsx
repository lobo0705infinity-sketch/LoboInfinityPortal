import CompactArtwork from './CompactArtwork'
import { Link } from 'react-router-dom'
import { buildCapabilityNavigation, getEventNavigationConfig } from '../config/eventNavigation'
import type { PublicEvent } from '../public/snapshotTypes'
import { useSnapshotData } from '../public/useSnapshotData'
import { buildTop40BracketSections, top40BracketSlot } from '../public/top40BracketModel'
import { preparationDate, TOP40_EVENT_ID } from '../public/top40PreparationModel'
import './Top40BracketPage.css'

export default function Top40BracketPage() {
  const events = useSnapshotData<PublicEvent[]>('events')
  const event = events.data?.find((item) => item.id === TOP40_EVENT_ID)
  const sections = event ? buildTop40BracketSections(event) : []
  const released = event?.bracket?.some((match) => Boolean(match.activatedAt))
  const config = getEventNavigationConfig(TOP40_EVENT_ID)
  const navigation = config ? buildCapabilityNavigation(config) : []
  return <main className="portal-shell event-overview-shell top40-bracket-page" data-event-section="bracket">
    <CompactArtwork title="Tournament Bracket" eyebrow="Lobo’s Top 40" src="/assets/events/top-40-bracket.png"/>
    <nav className="event-home-nav" aria-label="Event navigation">{navigation.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav>
    <section className="panel top40-bracket-intro" aria-labelledby="top40-bracket-title">
      <p className="eyebrow">Lobo&apos;s Top 40</p><h2 id="top40-bracket-title">Tournament Bracket</h2>
      <p>{event?.registeredCount || event?.participants?.length || 'The registered'} players enter a double-elimination bracket. A player is eliminated after their second loss.</p>
      <p>The Grand Final resets if the Losers Bracket finalist wins the first final.</p>
      {sections.length ? <p role="status">{released ? 'Matches released · see individual deadlines below.' : 'Bracket prepared · opening matches have not been released. Deadlines are paused.'}</p> : null}
      {events.error ? <div role="alert"><p>The bracket is temporarily unavailable.</p><button onClick={events.retry} type="button">Try again</button></div> : !events.data ? <p role="status">Loading bracket…</p> : !sections.length ? <p>The bracket has not been prepared yet.</p> : null}
    </section>
    <div className="top40-bracket-sections">{sections.map((section) => <section className="panel top40-bracket-panel" key={section.id} aria-labelledby={`top40-${section.id}-title`}>
      <div className="top40-bracket-panel-heading"><p className="eyebrow">Double Elimination</p><h2 id={`top40-${section.id}-title`}>{section.title}</h2></div>
      <div className="top40-bracket-scroll" tabIndex={0} aria-label={`${section.title} rounds`}><div className="top40-bracket-rounds">{section.rounds.map((round) => <section className="top40-bracket-round" key={round.id} aria-label={round.title}>
        <h3>{round.title}</h3><div className="top40-bracket-matches">{round.matches.map((match) => <article className="top40-bracket-match" key={String(match.matchId)}>
          <strong>{String(match.matchId)}</strong><span>{top40BracketSlot(match, 'A')}</span><span>{top40BracketSlot(match, 'B')}</span>
          <small>{String(match.status || 'Pending')}</small>
          {match.winner ? <small>{match.status === 'Bye Advanced' ? 'Advanced' : 'Winner'}: {String(match.winner)}</small> : null}
          {match.deadline ? <small>Deadline: {preparationDate(String(match.deadline))}</small> : null}
        </article>)}</div>
      </section>)}</div></div>
    </section>)}</div>
  </main>
}
