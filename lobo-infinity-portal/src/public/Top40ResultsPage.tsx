import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildCapabilityNavigation, getEventNavigationConfig } from '../config/eventNavigation'
import type { PublicEvent, PublicGame } from './snapshotTypes'
import { useSnapshotData } from './useSnapshotData'
import {
  buildTop40ResultRows,
  filterTop40ResultRows,
  getTop40ResultsSummary,
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
      <figure className="panel top40-results-hero" aria-label="Lobo's American Top 40 Results artwork">
        <img
          alt="Lobo's American Top 40 Results"
          height="941"
          src="/assets/events/top-40-results.png?v=6a394557"
          width="1672"
        />
      </figure>

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
            <h1 id="top40-latest-results-title">Latest Results</h1>
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
            <p>Completed Top 40 matches will appear here in the next hourly public snapshot.</p>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="top40-results-empty">
            <h2>No matching results</h2>
            <p>Try changing the bracket, round, or player filters.</p>
          </div>
        ) : (
          <div className="top40-results-list">
            {visibleRows.map(({ bracket, game, round }) => (
              <article className="top40-result-card" key={game.id}>
                <header>
                  <div><span>{bracket}</span><strong>{round}</strong></div>
                  <Link to={`/games/${game.id}`}>View Match</Link>
                </header>
                <div className="top40-result-matchup">
                  <PlayerResult name={game.player1DisplayName || game.player1} faction={game.player1Faction} />
                  <span className="top40-result-versus">VS</span>
                  <PlayerResult name={game.player2DisplayName || game.player2} faction={game.player2Faction} />
                </div>
                <dl className="top40-result-details">
                  <div><dt>TP</dt><dd>{game.tp || '—'}</dd></div>
                  <div><dt>OP</dt><dd>{game.op || '—'}</dd></div>
                  <div><dt>VP</dt><dd>{game.vp || '—'}</dd></div>
                  <div><dt>Winner</dt><dd>{game.winnerDisplayName || game.winner || '—'}</dd></div>
                </dl>
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

function PlayerResult({ faction, name }: { faction: string; name: string }) {
  return <div><strong>{name || 'Player unavailable'}</strong><span>{faction || 'Faction unavailable'}</span></div>
}
