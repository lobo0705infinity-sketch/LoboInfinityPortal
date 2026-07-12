import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import { filterCanonicalMissionRecords } from '../config/missions'
import {
  apiClient,
  type FactionSummary,
  type LeagueRecordValue,
  type MissionSummary,
} from '../services/api'
import type { DivisionStandings, Standing } from '../types/dashboard'
import Intelligence from './Intelligence'

type StatisticsState =
  | { status: 'loading' }
  | {
      data: {
        factions: FactionSummary[]
        missions: MissionSummary[]
        players: DivisionStandings[]
        records: Record<string, LeagueRecordValue>
      }
      status: 'success'
    }
  | { error: string; status: 'error' }

const statisticsFilterStorageKey = 'lobo-statistics-game-type-filter'

function Analytics() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isIntelligenceRoute = location.pathname === '/intelligence'
  const eventId = searchParams.get('eventId') || ''
  const gameType = normalizeGameTypeFilter(
    searchParams.get('gameType') ?? readStoredStatisticsFilter(),
  )
  const [state, setState] = useState<StatisticsState>({ status: 'loading' })
  const handleGameTypeChange = (value: GameTypeFilter) => {
    const next = new URLSearchParams(searchParams)
    writeStoredStatisticsFilter(value)
    if (value === 'all') {
      next.delete('gameType')
    } else {
      next.set('gameType', value)
    }
    setSearchParams(next)
  }

  useEffect(() => {
    if (isIntelligenceRoute) {
      return undefined
    }

    const controller = new AbortController()
    const options = { eventId, gameType, signal: controller.signal }

    Promise.all([
      apiClient.getPlayers(options),
      apiClient.getFactions(options),
      apiClient.getMissions(options),
      apiClient.getRecords(options),
    ])
      .then(([players, factions, missions, records]) => {
        if (!controller.signal.aborted) {
          setState({
            data: {
              factions,
              missions: filterCanonicalMissionRecords(missions),
              players,
              records,
            },
            status: 'success',
          })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Statistics could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [eventId, gameType, isIntelligenceRoute])

  if (isIntelligenceRoute) {
    return <Intelligence />
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader
          eventScoped={Boolean(eventId)}
          gameType={gameType}
          onGameTypeChange={handleGameTypeChange}
        />
        <section className="event-overview-status-grid" aria-label="Statistics loading">
          {['Lifetime Analytics', 'Player Analytics', 'Faction Analytics', 'Mission Analytics'].map((label) => (
            <article className="event-overview-status-card neutral" key={label}>
              <span>{label}</span>
              <strong>Loading</strong>
            </article>
          ))}
        </section>
        <section className="intelligence-grid">
          <Skeleton label="Player analytics loading" rows={6} />
          <Skeleton label="Faction analytics loading" rows={6} />
          <Skeleton label="Mission analytics loading" rows={6} />
          <Skeleton label="League records loading" rows={6} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader
          eventScoped={Boolean(eventId)}
          gameType={gameType}
          onGameTypeChange={handleGameTypeChange}
        />
        <section className="dashboard-state" aria-label="Statistics error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <StatisticsDashboard
      data={state.data}
      eventScoped={Boolean(eventId)}
      eventId={eventId}
      gameType={gameType}
      onGameTypeChange={handleGameTypeChange}
    />
  )
}

function StatisticsDashboard({
  data,
  eventScoped,
  eventId,
  gameType,
  onGameTypeChange,
}: {
  data: Extract<StatisticsState, { status: 'success' }>['data']
  eventScoped: boolean
  eventId: string
  gameType: GameTypeFilter
  onGameTypeChange: (value: GameTypeFilter) => void
}) {
  const model = useMemo(() => buildStatisticsModel(data), [data])
  const eventQuery = buildStatisticsQuery(eventId, gameType)

  return (
    <main className="portal-shell">
      <PageHeader
        eventScoped={eventScoped}
        gameType={gameType}
        onGameTypeChange={onGameTypeChange}
      />

      <section className="event-overview-status-grid" aria-label="Statistics summary">
        <SummaryCard label="Games" value={model.totalGames} />
        <SummaryCard label="Players" value={model.totalPlayers} />
        <SummaryCard label="Factions" value={data.factions.length} />
        <SummaryCard label="Missions" value={data.missions.length} />
      </section>

      <section className="intelligence-grid" aria-label="Analytics dashboards">
        <AnalyticsPanel
          actionLabel="View Players"
          actionTo={`/players${eventQuery}`}
          eyebrow="Player Analytics"
          title="Player Performance"
        >
          <MetricList
            items={[
              ['Top Tournament Points', model.topPlayer],
              ['Most Active Player', model.mostActivePlayer],
              ['Best Win Rate', model.bestWinRatePlayer],
              ['Active Divisions', String(data.players.length)],
            ]}
          />
        </AnalyticsPanel>

        <AnalyticsPanel
          actionLabel="View Factions"
          actionTo={`/factions${eventQuery}`}
          eyebrow="Faction Analytics"
          title="Faction Performance"
        >
          <MetricList
            items={[
              ['Top Faction', model.topFaction],
              ['Most Played Faction', model.mostPlayedFaction],
              ['Best Avg OP', model.bestObjectiveFaction],
              ['Faction Count', String(data.factions.length)],
            ]}
          />
        </AnalyticsPanel>

        <AnalyticsPanel
          actionLabel="View Missions"
          actionTo={`/missions${eventQuery}`}
          eyebrow="Mission Analytics"
          title="Mission Meta"
        >
          <MetricList
            items={[
              ['Most Played Mission', model.mostPlayedMission],
              ['Highest First Turn Win Rate', model.highestFirstTurnMission],
              ['Best Avg OP Mission', model.bestObjectiveMission],
              ['Mission Count', String(data.missions.length)],
            ]}
          />
        </AnalyticsPanel>

        <AnalyticsPanel
          actionLabel="View Intelligence"
          actionTo={`/intelligence${eventQuery}`}
          eyebrow="League Analytics"
          title="Records & Trends"
        >
          <MetricList
            items={[
              ['Highest Scoring Game', getRecordLabel(data.records.highestScoringGame)],
              ['Largest OP Margin', getRecordLabel(data.records.largestOPMargin)],
              ['Most Active Faction', getRecordLabel(data.records.mostActiveFaction)],
              ['Most Active Mission', getRecordLabel(data.records.mostActiveMission)],
            ]}
          />
        </AnalyticsPanel>
      </section>
    </main>
  )
}

type GameTypeFilter = 'league' | 'tournament' | 'casual' | 'all'

function PageHeader({
  eventScoped,
  gameType,
  onGameTypeChange,
}: {
  eventScoped: boolean
  gameType: GameTypeFilter
  onGameTypeChange?: (value: GameTypeFilter) => void
}) {
  return (
    <section className="page-header" aria-labelledby="statistics-title">
      <p className="eyebrow">Statistics</p>
      <h1 id="statistics-title">{eventScoped ? 'Event Statistics' : 'Statistics'}</h1>
      <p>Player, faction, mission, and lifetime analytics powered by live event data</p>
      {onGameTypeChange ? (
        <label className="dashboard-filter-control">
          <span>Game Type</span>
          <select
            onChange={(event) => onGameTypeChange(event.target.value as GameTypeFilter)}
            value={gameType}
          >
            <option value="all">All Games</option>
            <option value="league">League</option>
            <option value="tournament">Tournament</option>
            <option value="casual">Casual</option>
          </select>
        </label>
      ) : null}
    </section>
  )
}

function normalizeGameTypeFilter(value: string | null): GameTypeFilter {
  if (value === 'league' || value === 'tournament' || value === 'casual') {
    return value
  }

  return 'all'
}

function readStoredStatisticsFilter() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage.getItem(statisticsFilterStorageKey)
  } catch {
    return null
  }
}

function writeStoredStatisticsFilter(value: GameTypeFilter) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(statisticsFilterStorageKey, value)
  } catch {
    // Filter memory is an enhancement; route state still controls the view.
  }
}

function buildStatisticsQuery(eventId: string, gameType: GameTypeFilter) {
  const params = new URLSearchParams()

  if (eventId) {
    params.set('eventId', eventId)
  }

  if (gameType !== 'all') {
    params.set('gameType', gameType)
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="event-overview-status-card neutral">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function AnalyticsPanel({
  actionLabel,
  actionTo,
  children,
  eyebrow,
  title,
}: {
  actionLabel: string
  actionTo: string
  children: ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <section className="panel intelligence-card" aria-labelledby={titleToId(title)}>
      <div className="panel-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <div className="intelligence-card-body">
        {children}
        <Link className="event-home-primary-action" to={actionTo}>
          {actionLabel}
        </Link>
      </div>
    </section>
  )
}

function MetricList({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="event-overview-metrics">
      {items.map(([label, value]) => (
        <div className="event-home-metric" key={label}>
          <span>{label}</span>
          <strong>{value || 'Not established'}</strong>
        </div>
      ))}
    </div>
  )
}

function buildStatisticsModel(data: Extract<StatisticsState, { status: 'success' }>['data']) {
  const players = data.players.flatMap((division) =>
    division.standings.map((player) => ({
      ...player,
      division: division.divisionLabel,
    })),
  )
  const totalGames = Math.max(
    sum(data.factions.map((faction) => faction.games)),
    sum(data.missions.map((mission) => mission.games)),
    Math.round(sum(players.map((player) => player.games)) / 2),
  )
  const topPlayer = maxBy(players, (player) => player.tp)
  const mostActivePlayer = maxBy(players, (player) => player.games)
  const bestWinRatePlayer = maxBy(
    players.filter((player) => player.games > 0),
    (player) => player.wins / Math.max(1, player.games),
  )
  const topFaction = maxBy(data.factions, (faction) => faction.winRate)
  const mostPlayedFaction = maxBy(data.factions, (faction) => faction.games)
  const bestObjectiveFaction = maxBy(data.factions, (faction) => faction.averageOP)
  const mostPlayedMission = maxBy(data.missions, (mission) => mission.games)
  const highestFirstTurnMission = maxBy(data.missions, (mission) => mission.firstTurnWinRate)
  const bestObjectiveMission = maxBy(data.missions, (mission) => mission.averageOP)

  return {
    bestObjectiveFaction: formatFaction(bestObjectiveFaction, 'averageOP'),
    bestObjectiveMission: formatMission(bestObjectiveMission, 'averageOP'),
    bestWinRatePlayer: formatPlayer(bestWinRatePlayer, 'winRate'),
    highestFirstTurnMission: formatMission(highestFirstTurnMission, 'firstTurnWinRate'),
    mostActivePlayer: formatPlayer(mostActivePlayer, 'games'),
    mostPlayedFaction: formatFaction(mostPlayedFaction, 'games'),
    mostPlayedMission: formatMission(mostPlayedMission, 'games'),
    topFaction: formatFaction(topFaction, 'winRate'),
    topPlayer: formatPlayer(topPlayer, 'tp'),
    totalGames,
    totalPlayers: players.length,
  }
}

function maxBy<T>(items: T[], score: (item: T) => number) {
  return items.reduce<T | null>((best, item) => {
    if (!best) {
      return item
    }

    return score(item) > score(best) ? item : best
  }, null)
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function formatPlayer(
  player: Standing | null,
  metric: 'games' | 'tp' | 'winRate',
) {
  if (!player) {
    return ''
  }

  const name = player.displayName || player.player
  if (metric === 'winRate') {
    return `${name} / ${formatNumber((player.wins / Math.max(1, player.games)) * 100)}%`
  }

  return `${name} / ${metric === 'tp' ? player.tp : player.games}`
}

function formatFaction(
  faction: FactionSummary | null,
  metric: 'averageOP' | 'games' | 'winRate',
) {
  if (!faction) {
    return ''
  }

  if (metric === 'winRate') {
    return `${faction.name} / ${formatNumber(faction.winRate)}%`
  }

  if (metric === 'averageOP') {
    return `${faction.name} / ${formatNumber(faction.averageOP)} avg OP`
  }

  return `${faction.name} / ${faction.games}`
}

function formatMission(
  mission: MissionSummary | null,
  metric: 'averageOP' | 'firstTurnWinRate' | 'games',
) {
  if (!mission) {
    return ''
  }

  if (metric === 'firstTurnWinRate') {
    return `${mission.mission} / ${formatNumber(mission.firstTurnWinRate)}%`
  }

  if (metric === 'averageOP') {
    return `${mission.mission} / ${formatNumber(mission.averageOP)} avg OP`
  }

  return `${mission.mission} / ${mission.games}`
}

function getRecordLabel(record: LeagueRecordValue | undefined) {
  if (!record) {
    return ''
  }

  if ('winner' in record) {
    return `${record.winnerDisplayName || record.winner} vs ${record.loserDisplayName || record.loser}`
  }

  return record.displayName || record.name || record.faction || record.type || ''
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function titleToId(title: string) {
  return title.toLowerCase().replaceAll(' ', '-')
}

export default Analytics
