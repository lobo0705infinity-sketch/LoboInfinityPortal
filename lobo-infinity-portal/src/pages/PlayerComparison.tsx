import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BarChart from '../components/BarChart'
import Skeleton from '../components/Skeleton'
import { getCanonicalMissionName } from '../config/missions'
import {
  apiClient,
  type PlayerComparisonData,
} from '../services/api'
import type { DivisionStandings } from '../types/dashboard'

type ComparisonState =
  | {
      status: 'idle'
    }
  | {
      comparison: PlayerComparisonData | null
      divisions: DivisionStandings[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function PlayerComparison() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [comparisonState, setComparisonState] = useState<ComparisonState>({
    status: 'idle',
  })
  const leftParam = searchParams.get('left') ?? ''
  const rightParam = searchParams.get('right') ?? ''
  const eventId = searchParams.get('eventId') ?? ''

  useEffect(() => {
    const controller = new AbortController()

    async function loadComparison() {
      const divisions = await apiClient.getPlayers({
        eventId,
        signal: controller.signal,
      })
      const players = flattenPlayers(divisions)
      const left = leftParam || players[0]?.player || ''
      const right =
        rightParam ||
        players.find((player) => player.player !== left)?.player ||
        ''

      if (!left || !right) {
        setComparisonState({
          comparison: null,
          divisions,
          status: 'success',
        })
        return
      }

      const comparison = await apiClient.getPlayerComparison(left, right, {
        eventId,
        signal: controller.signal,
      })

      if (!controller.signal.aborted) {
        setComparisonState({
          comparison,
          divisions,
          status: 'success',
        })
      }
    }

    void loadComparison().catch((error: unknown) => {
      if (controller.signal.aborted) {
        return
      }

      setComparisonState({
        error:
          error instanceof Error
            ? error.message
            : 'Player comparison could not be loaded.',
        status: 'error',
      })
    })

    return () => {
      controller.abort()
    }
  }, [eventId, leftParam, rightParam])

  if (comparisonState.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <div className="portal-grid">
          <Skeleton label="Player comparison loading" rows={6} />
          <Skeleton label="Comparison controls loading" rows={6} />
        </div>
      </main>
    )
  }

  if (comparisonState.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Comparison error">
          <p role="alert">{comparisonState.error}</p>
        </section>
      </main>
    )
  }

  const players = flattenPlayers(comparisonState.divisions)

  return (
    <main className="portal-shell">
      <PageHeader />

      <section className="comparison-controls" aria-label="Comparison controls">
        <PlayerSelect
          label="Player One"
          onChange={(value) =>
            setSearchParams({
              ...(eventId ? { eventId } : {}),
              left: value,
              right: rightParam || players[1]?.player || '',
            })
          }
          players={players.map((player) => player.player)}
          value={leftParam || players[0]?.player || ''}
        />
        <PlayerSelect
          label="Player Two"
          onChange={(value) =>
            setSearchParams({
              ...(eventId ? { eventId } : {}),
              left: leftParam || players[0]?.player || '',
              right: value,
            })
          }
          players={players.map((player) => player.player)}
          value={rightParam || players[1]?.player || ''}
        />
      </section>

      {comparisonState.comparison ? (
        <ComparisonReport comparison={comparisonState.comparison} />
      ) : (
        <section className="dashboard-state" aria-label="Comparison unavailable">
          <p role="alert">Comparison requires at least two live players.</p>
        </section>
      )}
    </main>
  )
}

function ComparisonReport({
  comparison,
}: {
  comparison: PlayerComparisonData
}) {
  const [left, right] = comparison.players
  const chartPoints = useMemo(
    () => [
      {
        label: `${left.name} TP`,
        value: left.tp,
      },
      {
        label: `${right.name} TP`,
        value: right.tp,
      },
      {
        label: `${left.name} OP`,
        value: left.op,
      },
      {
        label: `${right.name} OP`,
        value: right.op,
      },
      {
        label: `${left.name} VP`,
        value: left.vp,
      },
      {
        label: `${right.name} VP`,
        value: right.vp,
      },
    ],
    [left, right],
  )

  return (
    <>
      <section className="comparison-hero" aria-label="Player comparison">
        <ComparisonPlayer player={left} />
        <div className="comparison-versus">
          <span>Head to Head</span>
          <strong>
            {comparison.headToHead.leftWins}-{comparison.headToHead.rightWins}-{comparison.headToHead.draws}
          </strong>
          <small>{comparison.headToHead.games} games</small>
        </div>
        <ComparisonPlayer player={right} />
      </section>

      <section className="command-center-grid" aria-label="Comparison charts">
        <section className="panel command-card">
          <div className="panel-heading">
            <p className="eyebrow">Player vs Player</p>
            <h2>Score Comparison</h2>
          </div>
          <div className="intelligence-card-body">
            <BarChart points={chartPoints} title="Score comparison" />
          </div>
        </section>

        <section className="panel command-card">
          <div className="panel-heading">
            <p className="eyebrow">Timeline</p>
            <h2>Career Markers</h2>
          </div>
          <dl className="profile-metric-list">
            <Metric label={`${left.name} Record`} value={`${left.wins}-${left.losses}`} />
            <Metric label={`${right.name} Record`} value={`${right.wins}-${right.losses}`} />
            <Metric label={`${left.name} Favorite Mission`} value={formatMissionMetric(left.favoriteMission)} />
            <Metric label={`${right.name} Favorite Mission`} value={formatMissionMetric(right.favoriteMission)} />
            <Metric label={`${left.name} Best Mission`} value={formatMissionMetric(left.bestMission)} />
            <Metric label={`${right.name} Best Mission`} value={formatMissionMetric(right.bestMission)} />
          </dl>
        </section>
      </section>
    </>
  )
}

function ComparisonPlayer({
  player,
}: {
  player: PlayerComparisonData['players'][number]
}) {
  return (
    <Link
      className="comparison-player"
      to={`/players/${encodeURIComponent(player.name)}`}
    >
      <span>{player.division}</span>
      <h2>{player.name}</h2>
      <strong>
        {player.wins}-{player.losses}
      </strong>
      <dl>
        <div>
          <dt>TP</dt>
          <dd>{player.tp}</dd>
        </div>
        <div>
          <dt>OP</dt>
          <dd>{player.op}</dd>
        </div>
        <div>
          <dt>VP</dt>
          <dd>{player.vp}</dd>
        </div>
      </dl>
      <p>{player.favoriteFaction || 'No faction recorded'}</p>
    </Link>
  )
}

function PlayerSelect({
  label,
  onChange,
  players,
  value,
}: {
  label: string
  onChange: (value: string) => void
  players: string[]
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {players.map((player) => (
          <option key={player} value={player}>
            {player}
          </option>
        ))}
      </select>
    </label>
  )
}

function formatMissionMetric(value: string) {
  return getCanonicalMissionName(value) || value
}

function Metric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || 'Not recorded'}</dd>
    </div>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="comparison-title">
      <p className="eyebrow">Player Headquarters</p>
      <h1 id="comparison-title">Player Comparison</h1>
      <p>Live head-to-head profile, score, faction, and mission comparison</p>
    </section>
  )
}

function flattenPlayers(divisions: DivisionStandings[]) {
  return divisions.flatMap((division) =>
    division.standings.map((player) => ({
      ...player,
      division: division.division,
      divisionLabel: division.divisionLabel,
    })),
  )
}

export default PlayerComparison
