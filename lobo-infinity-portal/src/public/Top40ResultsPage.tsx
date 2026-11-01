import CompactArtwork from '../components/CompactArtwork'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildCapabilityNavigation, getEventNavigationConfig } from '../config/eventNavigation'
import type { PublicEvent, PublicGame } from './snapshotTypes'
import { useSnapshotData } from './useSnapshotData'
import {
  buildTop40ResultRows,
  filterTop40ResultRows,
  getTop40ResultsSummary,
  type Top40ResultSide,
} from './top40ResultsModel'
import './Top40ResultsPage.css'

const TOP_40_EVENT_ID = 'event-lobo-s-american-top-40'

export default function Top40ResultsPage() {
  const events = useSnapshotData<PublicEvent[]>('events')
  const games = useSnapshotData<PublicGame[]>('games')
  const event = events.data?.find((candidate) => candidate.id === TOP_40_EVENT_ID)
  const eventGames = games.data?.filter((game) => game.eventId === TOP_40_EVENT_ID) ?? []
  const rows = useMemo(() => event ? buildTop40ResultRows(event, eventGames) : [], [event, eventGames])
  const summary = event ? getTop40ResultsSummary(event, rows) : null
  const [bracketFilter, setBracketFilter] = useState('')
  const [roundFilter, setRoundFilter] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
  const visibleRows = filterTop40ResultRows(rows, bracketFilter, roundFilter, playerSearch)
  const bracketOptions = [...new Set(rows.map((row) => row.bracket))]
  const roundOptions = [...new Set(rows.map((row) => row.round))]
  const config = getEventNavigationConfig(TOP_40_EVENT_ID)
  const navigation = config ? buildCapabilityNavigation(config) : []

  return (
    <main className="portal-shell snapshot-public-page top40-results-page" data-event-section="results">
      <CompactArtwork title="Results" eyebrow="Lobo’s Top 40" src="/assets/events/top-40-results.png"/>

      <nav className="snapshot-tabs" aria-label="Event sections">
        {navigation.map((item) => (
          <Link
            aria-current={item.capability === 'results' ? 'page' : undefined}
            className={item.capability === 'results' ? 'active' : undefined}
            key={item.to}
            to={item.to}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="top40-results-summary" aria-label="Tournament results summary">
        <SummaryMetric label="Players" value={summary?.players ?? 0} />
        <SummaryMetric label="Matches Complete" value={summary?.matchesComplete ?? 0} />
        <SummaryMetric label="Active Matches" value={summary?.activeMatches ?? 0} />
        <SummaryMetric label="Eliminated" value={summary?.eliminated ?? 0} />
      </section>

      <section className="panel top40-results-panel" aria-labelledby="top40-latest-results-title">
        <div className="top40-results-heading">
          <div>
            <p className="eyebrow">Tournament Record</p>
            <h2 id="top40-latest-results-title">Latest Results</h2>
          </div>
          <div className="top40-results-filters" aria-label="Result filters">
            <label>
              <span>Bracket</span>
              <select value={bracketFilter} onChange={(event) => setBracketFilter(event.target.value)}>
                <option value="">All brackets</option>
                {bracketOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Round</span>
              <select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value)}>
                <option value="">All rounds</option>
                {roundOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Player</span>
              <input
                onChange={(event) => setPlayerSearch(event.target.value)}
                placeholder="Search player"
                type="search"
                value={playerSearch}
              />
            </label>
          </div>
        </div>

        {!event || rows.length === 0 ? (
          <div className="top40-results-empty">
            <h2>No results yet</h2>
            <p>Completed Top 40 matches will appear here after event publication; background refreshes run throughout the day.</p>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="top40-results-empty">
            <h2>No matching results</h2>
            <p>Try changing the bracket, round, or player filters.</p>
          </div>
        ) : (
          <div className="top40-results-list">
            {visibleRows.map(({ bracket, game, round, sides }) => (
              <article className="top40-result-card" key={game.id}>
                <header>
                  <div><span>{bracket}</span><strong>{round}</strong></div>
                  <Link to={`/games/${game.id}`}>View Match</Link>
                </header>
                <div className="top40-result-matchup">
                  <PlayerResult side={sides[0]} />
                  <span className="top40-result-versus">VS</span>
                  <PlayerResult side={sides[1]} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <article className="panel"><span>{label}</span><strong>{value}</strong></article>
}

function PlayerResult({ side }: { side: Top40ResultSide }) {
  return <div className={`top40-result-player${side.result === 'Winner' ? ' top40-result-player-winner' : ''}`}>
    <span className="top40-result-outcome">{side.result}</span>
    <strong>{side.name || 'Player unavailable'}</strong>
    <span>{side.faction || 'Faction unavailable'}</span>
    <dl className="top40-result-player-scores" aria-label={`${side.name} scores`}>
      <div><dt>TP</dt><dd>{side.tp}</dd></div>
      <div><dt>OP</dt><dd>{side.op}</dd></div>
      <div><dt>VP</dt><dd>{side.vp}</dd></div>
    </dl>
  </div>
}
