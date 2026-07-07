import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import BarChart from '../components/BarChart'
import EntityPreviousNext from '../components/EntityPreviousNext'
import Loading from '../components/Loading'
import {
  apiClient,
  type ArmyList,
  type PlayerProfileData,
  type RecentGame,
} from '../services/api'
import {
  formatDivisionLabel,
  getDivisionStyle,
} from '../utils/divisions'
import { formatObjectiveScore, formatPlayerName } from '../services/formatting'

type ProfileState =
  | {
      status: 'idle'
    }
  | {
      error: string
      playerName: string
      status: 'error'
    }
  | {
      player: PlayerProfileData
      playerName: string
      status: 'success'
    }

function PlayerProfile() {
  const { playerName } = useParams<{ playerName: string }>()
  const decodedPlayerName = decodePlayerName(playerName)
  const [profileState, setProfileState] = useState<ProfileState>({
    status: 'idle',
  })
  const [recentGames, setRecentGames] = useState<RecentGame[]>([])

  useEffect(() => {
    if (!decodedPlayerName) {
      return
    }

    const controller = new AbortController()

    Promise.all([
      apiClient.getPlayer(decodedPlayerName, {
        signal: controller.signal,
      }),
      apiClient.getRecentGames({
        signal: controller.signal,
      }),
    ])
      .then(([profile, games]) => {
        setProfileState({
          player: profile,
          playerName: decodedPlayerName,
          status: 'success',
        })
        setRecentGames(
          games.filter(
            (game) =>
              game.winner === decodedPlayerName ||
              game.loser === decodedPlayerName,
          ),
        )
      })
      .catch((profileError: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setProfileState({
          error:
            profileError instanceof Error
              ? profileError.message
              : 'Player profile could not be loaded.',
          playerName: decodedPlayerName,
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [decodedPlayerName])

  if (!decodedPlayerName) {
    return (
      <main className="portal-shell">
        <ProfileHeaderFallback playerName="" />
        <section className="dashboard-state" aria-label="Player error">
          <p role="alert">Player name is missing.</p>
        </section>
      </main>
    )
  }

  const isCurrentProfile =
    profileState.status !== 'idle' &&
    profileState.playerName === decodedPlayerName

  if (!isCurrentProfile) {
    return (
      <main className="portal-shell">
        <ProfileHeaderFallback playerName={decodedPlayerName} />
        <section className="dashboard-state" aria-label="Player loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (profileState.status === 'error') {
    return (
      <main className="portal-shell">
        <ProfileHeaderFallback playerName={decodedPlayerName} />
        <section className="dashboard-state" aria-label="Player error">
          <p role="alert">{profileState.error}</p>
        </section>
      </main>
    )
  }

  const movementStatus = getMovementStatus(profileState.player)

  return (
    <main className="portal-shell">
      <section
        className="player-profile-hero profile-hero-focus"
        style={getDivisionStyle(profileState.player.division)}
        aria-labelledby="player-title"
      >
        <div className="profile-hero-main">
          <p className="eyebrow">Player Profile</p>
          <h1 id="player-title">
            {formatPlayerName(profileState.player.name, profileState.player.displayName)}
          </h1>
          <div className="profile-badges" aria-label="Player league status">
            <span className="division-badge">
              {formatDivisionLabel(profileState.player.division)}
            </span>
            <span>Rank #{profileState.player.rank}</span>
            {movementStatus ? (
              <span className={movementStatus.className}>
                {movementStatus.label}
              </span>
            ) : null}
          </div>
        </div>

        <div className="profile-hero-record" aria-label="Current record">
          <span>Record</span>
          <strong>
            {profileState.player.wins}–{profileState.player.losses}
          </strong>
        </div>

        <dl className="profile-hero-score" aria-label="Player score summary">
          <div>
            <dt>TP</dt>
            <dd>{profileState.player.tp}</dd>
          </div>
          <div>
            <dt>OP</dt>
            <dd>{profileState.player.op}</dd>
          </div>
          <div>
            <dt>VP</dt>
            <dd>{profileState.player.vp}</dd>
          </div>
        </dl>
      </section>

      <section className="profile-card-grid" aria-label="Player statistics">
        <ProfileCard title="Season Snapshot">
          <Metric label="Games Played" value={profileState.player.games} />
          <Metric
            label="Tournament Points"
            value={profileState.player.tp}
          />
          <Metric label="Objective Points" value={profileState.player.op} />
          <Metric label="Victory Points" value={profileState.player.vp} />
        </ProfileCard>

        <ProfileCard title="League Intelligence">
          <Metric
            label="Favorite Faction"
            value={profileState.player.favoriteFaction}
          />
          <Metric
            label="Favorite Mission"
            value={profileState.player.favoriteMission}
          />
          <Metric label="Best Faction" value={profileState.player.bestFaction} />
          <Metric label="Rival" value={profileState.player.rival} />
          <Metric label="Nemesis" value={profileState.player.nemesis} />
        </ProfileCard>

        <ProfileCard title="Turn Statistics">
          <Metric
            label="First Turn Win Rate"
            value={formatPercent(profileState.player.firstTurnWinRate)}
          />
          <Metric
            label="Second Turn Win Rate"
            value={formatPercent(profileState.player.secondTurnWinRate)}
          />
          <Metric
            label="First Turn Games"
            value={profileState.player.firstTurnGames}
          />
          <Metric
            label="Second Turn Games"
            value={profileState.player.secondTurnGames}
          />
        </ProfileCard>
      </section>

      <section className="command-center-grid" aria-label="Player charts">
        <section className="panel command-card">
          <div className="panel-heading">
            <p className="eyebrow">Graphs</p>
            <h2>Season Score Profile</h2>
          </div>
          <div className="intelligence-card-body">
            <BarChart
              points={[
                {
                  label: 'TP',
                  value: profileState.player.tp,
                },
                {
                  label: 'OP',
                  value: profileState.player.op,
                },
                {
                  label: 'VP',
                  value: profileState.player.vp,
                },
                {
                  label: 'Wins',
                  value: profileState.player.wins,
                },
              ]}
              title="Player score profile"
            />
          </div>
        </section>

        {recentGames.length > 0 ? (
          <section className="panel command-card">
            <div className="panel-heading">
              <p className="eyebrow">Recent Form</p>
              <h2>Recent Matches</h2>
            </div>
            <div className="faction-match-list">
              {recentGames.slice(0, 5).map((game) => (
                <Link className="faction-match-card" key={game.id} to={`/games/${game.id}`}>
                  <div>
                    <span>{game.date}</span>
                    <h3>
                      {formatPlayerName(game.winner, game.winnerDisplayName)} defeated{' '}
                      {formatPlayerName(game.loser, game.loserDisplayName)}
                    </h3>
                    <p>{game.mission}</p>
                  </div>
                  <strong>{formatObjectiveScore(game)}</strong>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <section className="profile-card-grid" aria-label="Player army lists">
        <ProfileCard title="Submitted Army Lists">
          <Metric
            label="Lists Submitted"
            value={profileState.player.armyListSummary.submitted}
          />
          <Metric
            label="Average List Rating"
            value={profileState.player.armyListSummary.averageRating}
          />
          <Metric
            label="Favorite Faction"
            value={
              profileState.player.armyListSummary.favoriteFaction ||
              profileState.player.favoriteFaction
            }
          />
        </ProfileCard>
        <ArmyListSummaryCard
          list={profileState.player.armyListSummary.highestRated}
          title="Highest Rated List"
        />
        <ArmyListSummaryCard
          list={profileState.player.armyListSummary.newest}
          title="Newest List"
        />
      </section>

      {profileState.player.armyLists.length > 0 ? (
        <section className="panel faction-report-panel profile-army-list-panel">
          <div className="panel-heading">
            <p className="eyebrow">Community</p>
            <h2>Player Army Lists</h2>
          </div>
          <div className="army-list-mini-grid">
            {profileState.player.armyLists.map((list) => (
              <ArmyListMiniCard key={list.id} list={list} />
            ))}
          </div>
        </section>
      ) : null}

      <EntityPreviousNext current={profileState.player.name} type="player" />
    </main>
  )
}

function ArmyListSummaryCard({
  list,
  title,
}: {
  list: ArmyList | null
  title: string
}) {
  return (
    <ProfileCard title={title}>
      {list ? (
        <>
          <Metric label="Army Name" value={list.armyName} />
          <Metric label="Faction" value={list.faction} />
          <Metric label="Mission" value={list.mission} />
          <Metric label="Score" value={list.score} />
        </>
      ) : (
        <Metric label="Army List" value="Not recorded" />
      )}
    </ProfileCard>
  )
}

function ArmyListMiniCard({ list }: { list: ArmyList }) {
  return (
    <article className="army-list-mini-card">
      <span>{list.submissionDate || 'Date not recorded'}</span>
      <h3>{list.armyName}</h3>
      <p>
        {list.faction}
        {list.sectorial ? ` - ${list.sectorial}` : ''}
      </p>
      <strong>Score {list.score}</strong>
      {list.armyLink ? (
        <a href={list.armyLink} rel="noreferrer" target="_blank">
          View in Infinity Army
        </a>
      ) : list.armyCode ? (
        <code>{list.armyCode}</code>
      ) : null}
    </article>
  )
}

function ProfileHeaderFallback({ playerName }: { playerName: string }) {
  return (
    <section className="player-profile-hero" aria-labelledby="player-title">
      <div>
        <p className="eyebrow">Player Profile</p>
        <h1 id="player-title">{playerName || 'Player'}</h1>
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
        <p className="eyebrow">Profile</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <dl className="profile-metric-list">{children}</dl>
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

function getMovementStatus(player: PlayerProfileData) {
  if (player.division !== 'Main Man') {
    return null
  }

  if (player.rank >= 9) {
    return {
      className: 'profile-status-relegation',
      label: 'Relegation',
    }
  }

  return {
    className: 'profile-status-safe',
    label: 'Safe',
  }
}

function decodePlayerName(playerName: string | undefined) {
  if (!playerName) {
    return ''
  }

  try {
    return decodeURIComponent(playerName)
  } catch {
    return playerName
  }
}

function formatPercent(value: number) {
  return `${value}%`
}

function titleToId(title: string) {
  return title.toLowerCase().replaceAll(' ', '-')
}

export default PlayerProfile
