import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import BarChart from '../components/BarChart'
import EntityPreviousNext from '../components/EntityPreviousNext'
import Skeleton from '../components/Skeleton'
import { getCanonicalMissionName } from '../config/missions'
import {
  apiClient,
  type MissionBestMoment,
  type MissionProfileData,
  type RecentGame,
} from '../services/api'
import { formatObjectiveScore, formatPlayerName } from '../services/formatting'

type MissionProfileState =
  | {
      status: 'idle'
    }
  | {
      error: string
      missionName: string
      status: 'error'
    }
  | {
      mission: MissionProfileData
      missionName: string
      status: 'success'
    }

function MissionProfile() {
  const { missionName } = useParams<{ missionName: string }>()
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') || ''
  const decodedMissionName = decodeMissionName(missionName)
  const canonicalMissionName = getCanonicalMissionName(decodedMissionName)
  const [profileState, setProfileState] = useState<MissionProfileState>({
    status: 'idle',
  })

  useEffect(() => {
    if (!canonicalMissionName) {
      return
    }

    const controller = new AbortController()

    apiClient
      .getMission(canonicalMissionName, {
        eventId,
        signal: controller.signal,
      })
      .then((mission) => {
        setProfileState({
          mission,
          missionName: canonicalMissionName,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setProfileState({
          error:
            error instanceof Error
              ? error.message
              : 'Mission profile could not be loaded.',
          missionName: canonicalMissionName,
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [canonicalMissionName, decodedMissionName, eventId])

  if (!canonicalMissionName) {
    return (
      <main className="portal-shell">
        <MissionHeaderFallback missionName={decodedMissionName} />
        <section className="dashboard-state" aria-label="Mission error">
          <p role="alert">Mission is not in the current mission registry.</p>
        </section>
      </main>
    )
  }

  const isCurrentProfile =
    profileState.status !== 'idle' &&
    profileState.missionName === canonicalMissionName

  if (!isCurrentProfile) {
    return (
      <main className="portal-shell">
        <MissionHeaderFallback missionName={canonicalMissionName} />
        <section className="profile-card-grid" aria-label="Mission loading">
          <Skeleton label="Mission metrics loading" rows={6} />
          <Skeleton label="Mission chart loading" rows={6} />
          <Skeleton label="Mission games loading" rows={6} />
        </section>
      </main>
    )
  }

  if (profileState.status === 'error') {
    return (
      <main className="portal-shell">
        <MissionHeaderFallback missionName={canonicalMissionName} />
        <section className="dashboard-state" aria-label="Mission error">
          <p role="alert">{profileState.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <MissionHero mission={profileState.mission} />

      <section className="profile-card-grid" aria-label="Mission statistics">
        <ProfileCard title="Key Metrics">
          <Metric label="Games Played" value={profileState.mission.games} />
          <Metric
            label="First Turn Win %"
            value={formatPercent(profileState.mission.firstTurnWinRate)}
          />
          <Metric
            label="Average TP"
            value={formatNumber(profileState.mission.averageTP)}
          />
          <Metric
            label="Average OP"
            value={formatNumber(profileState.mission.averageOP)}
          />
          <Metric
            label="Average VP"
            value={formatNumber(profileState.mission.averageVP)}
          />
        </ProfileCard>

        <ProfileCard title="Division Breakdown">
          {profileState.mission.divisionBreakdown.map((division) => (
            <Metric
              key={division.division}
              label={division.division}
              value={`${division.games} games`}
            />
          ))}
          <Metric label="Last Played" value={profileState.mission.lastPlayed} />
        </ProfileCard>

        <ProfileCard title="Intelligence">
          <Metric
            label="Most Successful Faction"
            value={profileState.mission.mostSuccessfulFaction}
          />
          <Metric
            label="Most Played Faction"
            value={profileState.mission.mostPlayedFaction}
          />
        </ProfileCard>
      </section>

      <section className="command-center-grid" aria-label="Mission charts">
        <section className="panel command-card">
          <div className="panel-heading">
            <p className="eyebrow">Mission Charts</p>
            <h2>Difficulty and Tempo</h2>
          </div>
          <div className="intelligence-card-body">
            <BarChart
              points={[
                {
                  label: 'Average TP',
                  value: profileState.mission.averageTP,
                },
                {
                  label: 'Average OP',
                  value: profileState.mission.averageOP,
                },
                {
                  label: 'Average VP',
                  value: profileState.mission.averageVP,
                },
                {
                  label: 'First Turn Win %',
                  value: profileState.mission.firstTurnWinRate,
                },
              ]}
              title="Mission difficulty and tempo"
            />
          </div>
        </section>

        <section className="panel command-card">
          <div className="panel-heading">
            <p className="eyebrow">Pick Rate</p>
            <h2>Division Breakdown</h2>
          </div>
          <div className="intelligence-card-body">
            <BarChart
              points={profileState.mission.divisionBreakdown.map((division) => ({
                label: division.division,
                value: division.games,
              }))}
              title="Mission division breakdown"
            />
          </div>
        </section>
      </section>

      <section className="faction-profile-grid" aria-label="Mission reports">
        <RecentGamesPanel games={profileState.mission.recentGames} />
        <BestMomentsPanel moments={profileState.mission.bestMoments} />
      </section>

      <EntityPreviousNext current={profileState.mission.mission} eventId={eventId} type="mission" />
    </main>
  )
}

function MissionHero({ mission }: { mission: MissionProfileData }) {
  return (
    <section className="player-profile-hero profile-hero-focus faction-profile-hero mission-profile-hero">
      <div className="profile-hero-main">
        <p className="eyebrow">Mission Profile</p>
        <h1>{mission.mission}</h1>
        <div className="profile-badges" aria-label="Mission status">
          <span>{mission.games} Games Played</span>
          <span>{formatPercent(mission.firstTurnWinRate)} First Turn Win</span>
          <span>{mission.lastPlayed || 'No date recorded'}</span>
        </div>
      </div>

      <div className="profile-hero-record" aria-label="First turn win rate">
        <span>First Turn</span>
        <strong>{formatPercent(mission.firstTurnWinRate)}</strong>
      </div>

      <dl className="profile-hero-score" aria-label="Mission key metrics">
        <div>
          <dt>Avg TP</dt>
          <dd>{formatNumber(mission.averageTP)}</dd>
        </div>
        <div>
          <dt>Avg OP</dt>
          <dd>{formatNumber(mission.averageOP)}</dd>
        </div>
        <div>
          <dt>Avg VP</dt>
          <dd>{formatNumber(mission.averageVP)}</dd>
        </div>
      </dl>
    </section>
  )
}

function MissionHeaderFallback({ missionName }: { missionName: string }) {
  return (
    <section className="player-profile-hero" aria-labelledby="mission-title">
      <div>
        <p className="eyebrow">Mission Profile</p>
        <h1 id="mission-title">{missionName || 'Mission'}</h1>
      </div>
    </section>
  )
}

function ProfileCard({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="panel profile-card" aria-labelledby={titleToId(title)}>
      <div className="panel-heading">
        <p className="eyebrow">Mission</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <dl className="profile-metric-list">{children}</dl>
    </section>
  )
}

function RecentGamesPanel({ games }: { games: RecentGame[] }) {
  return (
    <section className="panel faction-report-panel" aria-labelledby="mission-games">
      <div className="panel-heading">
        <p className="eyebrow">Battle Reports</p>
        <h2 id="mission-games">Recent Games</h2>
      </div>
      {games.length === 0 ? (
        <div className="recent-games-empty">
          <strong>No games have been reported yet.</strong>
        </div>
      ) : (
        <div className="faction-match-list">
          {games.map((game) => (
            <Link
              className="faction-match-card"
              key={game.id}
              to={`/games/${game.id}`}
            >
              <div>
                <span>{game.date}</span>
                <h3>
                  {formatPlayerName(game.winner, game.winnerDisplayName)} defeated{' '}
                  {formatPlayerName(game.loser, game.loserDisplayName)}
                </h3>
                <p>
                  {game.winnerFaction} vs {game.loserFaction}
                </p>
              </div>
              <strong>{formatObjectiveScore(game)}</strong>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function BestMomentsPanel({ moments }: { moments: MissionBestMoment[] }) {
  return (
    <section
      className="panel faction-report-panel"
      aria-labelledby="mission-moments"
    >
      <div className="panel-heading">
        <p className="eyebrow">Best Moments</p>
        <h2 id="mission-moments">Best Moments</h2>
      </div>
      {moments.length === 0 ? (
        <div className="recent-games-empty">
          <strong>No memorable moments have been submitted yet.</strong>
        </div>
      ) : (
        <div className="faction-moment-list">
          {moments.map((moment) => (
            <Link
              className="faction-moment-card"
              key={`${moment.gameId}-${moment.moment}`}
              to={`/games/${moment.gameId}`}
            >
              <span>
                {moment.date} / {moment.mission}
              </span>
              <blockquote>"{moment.moment}"</blockquote>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
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
      <dd>{value === '' ? 'Not recorded' : value}</dd>
    </div>
  )
}

function decodeMissionName(missionName: string | undefined) {
  if (!missionName) {
    return ''
  }

  try {
    return decodeURIComponent(missionName)
  } catch {
    return missionName
  }
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function titleToId(title: string) {
  return title.toLowerCase().replaceAll(' ', '-')
}

export default MissionProfile
