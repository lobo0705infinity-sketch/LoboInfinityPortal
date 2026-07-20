import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import { filterCanonicalMissionRecords } from '../config/missions'
import { apiClient, type MissionSummary } from '../services/api'

const currentLeagueEventId = 'event-current-league'
const teamTournamentEventId = 'event-august-2026-team-tournament'

const missionScopes = [
  {
    description: 'Active league event only',
    eventId: currentLeagueEventId,
    gameType: 'league',
    id: 'current-league',
    label: 'Current League',
  },
  {
    description: 'Team Tournament event only',
    eventId: teamTournamentEventId,
    gameType: 'tournament',
    id: 'tournament',
    label: 'Tournament',
  },
  {
    description: 'Standalone casual results',
    eventId: '',
    gameType: 'casual',
    id: 'casual',
    label: 'Casual',
  },
  {
    description: 'League, tournament, and casual results',
    eventId: '',
    gameType: 'all',
    id: 'all',
    label: 'All Games',
  },
] as const

type MissionScopeId = (typeof missionScopes)[number]['id']

type MissionsState =
  | {
      status: 'idle'
    }
  | {
      missions: MissionSummary[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function Missions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeScope = getMissionScope(searchParams)
  const { eventId, gameType } = activeScope
  const [missionsState, setMissionsState] = useState<MissionsState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getMissions({
        eventId,
        gameType,
        signal: controller.signal,
      })
      .then((missions) => {
        setMissionsState({
          missions: filterCanonicalMissionRecords(missions),
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setMissionsState({
          error:
            error instanceof Error
              ? error.message
              : 'Missions could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [eventId, gameType])

  function selectScope(scopeId: MissionScopeId) {
    const nextScope = missionScopes.find((scope) => scope.id === scopeId)

    if (!nextScope) {
      return
    }

    setSearchParams({
      scope: nextScope.id,
    })
  }

  if (missionsState.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader activeScope={activeScope} onScopeChange={selectScope} />
        <section className="faction-grid" aria-label="Missions loading">
          <Skeleton label="Mission cards loading" rows={7} />
          <Skeleton label="Mission cards loading" rows={7} />
          <Skeleton label="Mission cards loading" rows={7} />
        </section>
      </main>
    )
  }

  if (missionsState.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader activeScope={activeScope} onScopeChange={selectScope} />
        <section className="dashboard-state" aria-label="Missions error">
          <p role="alert">{missionsState.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader activeScope={activeScope} onScopeChange={selectScope} />

      {missionsState.missions.length === 0 ? (
        <section className="dashboard-state" aria-label="No missions">
          <p>No missions have reported games in this scope yet.</p>
        </section>
      ) : (
        <section className="faction-grid" aria-label="Mission headquarters">
          {missionsState.missions.map((mission) => (
            <MissionCard
              eventId={eventId}
              gameType={gameType}
              key={mission.mission}
              mission={mission}
              scopeId={activeScope.id}
            />
          ))}
        </section>
      )}
    </main>
  )
}

function MissionCard({
  eventId,
  gameType,
  mission,
  scopeId,
}: {
  eventId: string
  gameType: string
  mission: MissionSummary
  scopeId: MissionScopeId
}) {
  const profileParams = new URLSearchParams()
  if (eventId) {
    profileParams.set('eventId', eventId)
  }
  if (gameType !== 'league') {
    profileParams.set('gameType', gameType)
  }
  if (scopeId) {
    profileParams.set('scope', scopeId)
  }
  const profileQuery = profileParams.toString()
  const profilePath = `/missions/${encodeURIComponent(mission.mission)}${
    profileQuery ? `?${profileQuery}` : ''
  }`

  return (
    <Link className="faction-card mission-card" to={profilePath}>
      <div className="faction-card-main">
        <div>
          <p className="eyebrow">Mission</p>
          <h2>{mission.mission}</h2>
        </div>
        <span className="faction-card-chevron" aria-hidden="true">
          &gt;
        </span>
      </div>

      <div className="faction-card-rate">
        <span>First Turn Win %</span>
        <strong>{formatPercent(mission.firstTurnWinRate)}</strong>
      </div>

      <dl className="faction-card-stats">
        <div>
          <dt>Games</dt>
          <dd>{mission.games}</dd>
        </div>
        <div>
          <dt>Top Faction</dt>
          <dd>{mission.mostSuccessfulFaction || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Avg OP</dt>
          <dd>{formatNumber(mission.averageOP)}</dd>
        </div>
        <div>
          <dt>Avg VP</dt>
          <dd>{formatNumber(mission.averageVP)}</dd>
        </div>
        <div>
          <dt>Last Played</dt>
          <dd>{mission.lastPlayed || 'Not recorded'}</dd>
        </div>
      </dl>
    </Link>
  )
}

function PageHeader({
  activeScope,
  onScopeChange,
}: {
  activeScope: (typeof missionScopes)[number]
  onScopeChange: (scopeId: MissionScopeId) => void
}) {
  return (
    <section className="page-header" aria-labelledby="missions-title">
      <p className="eyebrow">Missions</p>
      <h1 id="missions-title">Mission Headquarters</h1>
      <p>Mission tempo, first-turn pressure, factions, and battle reports</p>
      <div className="mission-scope-control" aria-label="Mission analytics scope">
        {missionScopes.map((scope) => (
          <button
            aria-pressed={scope.id === activeScope.id}
            className={scope.id === activeScope.id ? 'active' : ''}
            key={scope.id}
            onClick={() => onScopeChange(scope.id)}
            type="button"
          >
            <span>{scope.label}</span>
            <small>{scope.description}</small>
          </button>
        ))}
      </div>
      {activeScope.id === 'all' ? (
        <p className="mission-scope-note">
          All Games combines league, tournament, and casual results for mission
          discovery only.
        </p>
      ) : null}
    </section>
  )
}

function getMissionScope(searchParams: URLSearchParams) {
  const requestedScope = searchParams.get('scope')
  const explicitScope = missionScopes.find((scope) => scope.id === requestedScope)

  if (explicitScope) {
    return explicitScope
  }

  const eventId = searchParams.get('eventId') || ''
  const gameType = searchParams.get('gameType') || ''

  if (eventId === teamTournamentEventId) {
    return missionScopes[1]
  }

  if (gameType === 'casual') {
    return missionScopes[2]
  }

  if (gameType === 'all') {
    return missionScopes[3]
  }

  return missionScopes[0]
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export default Missions
