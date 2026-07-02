import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import BarChart from '../components/BarChart'
import EntityPreviousNext from '../components/EntityPreviousNext'
import Loading from '../components/Loading'
import {
  apiClient,
  type ArmyList,
  type FactionBestMoment,
  type FactionMatchup,
  type FactionProfileData,
  type RecentGame,
} from '../services/api'

type FactionProfileState =
  | {
      status: 'idle'
    }
  | {
      error: string
      factionName: string
      status: 'error'
    }
  | {
      faction: FactionProfileData
      factionName: string
      status: 'success'
    }

function FactionProfile() {
  const { name } = useParams<{ name: string }>()
  const decodedFactionName = decodeFactionName(name)
  const [profileState, setProfileState] = useState<FactionProfileState>({
    status: 'idle',
  })

  useEffect(() => {
    if (!decodedFactionName) {
      return
    }

    const controller = new AbortController()

    apiClient
      .getFaction(decodedFactionName, {
        signal: controller.signal,
      })
      .then((faction) => {
        setProfileState({
          faction,
          factionName: decodedFactionName,
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
              : 'Faction profile could not be loaded.',
          factionName: decodedFactionName,
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [decodedFactionName])

  if (!decodedFactionName) {
    return (
      <main className="portal-shell">
        <FactionHeaderFallback factionName="" />
        <section className="dashboard-state" aria-label="Faction error">
          <p role="alert">Faction name is missing.</p>
        </section>
      </main>
    )
  }

  const isCurrentProfile =
    profileState.status !== 'idle' &&
    profileState.factionName === decodedFactionName

  if (!isCurrentProfile) {
    return (
      <main className="portal-shell">
        <FactionHeaderFallback factionName={decodedFactionName} />
        <section className="dashboard-state" aria-label="Faction loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (profileState.status === 'error') {
    return (
      <main className="portal-shell">
        <FactionHeaderFallback factionName={decodedFactionName} />
        <section className="dashboard-state" aria-label="Faction error">
          <p role="alert">{profileState.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <FactionHero faction={profileState.faction} />

      <section className="profile-card-grid" aria-label="Faction statistics">
        <ProfileCard title="Key Metrics">
          <Metric label="Average TP" value={formatNumber(profileState.faction.averageTP)} />
          <Metric label="Average OP" value={formatNumber(profileState.faction.averageOP)} />
          <Metric label="Average VP" value={formatNumber(profileState.faction.averageVP)} />
          <Metric label="Top Player" value={profileState.faction.topPlayer} />
          <Metric
            label="Most Played Mission"
            value={profileState.faction.mostPlayedMission}
          />
        </ProfileCard>

        <ProfileCard title="Division Breakdown">
          {profileState.faction.divisionBreakdown.length > 0 ? (
            profileState.faction.divisionBreakdown.map((division) => (
              <Metric
                key={division.division}
                label={division.division}
                value={`${division.games} games`}
              />
            ))
          ) : (
            <Metric label="Divisions" value="Not recorded" />
          )}
          <Metric label="Last Played" value={profileState.faction.lastPlayed} />
        </ProfileCard>

        <ProfileCard title="Record">
          <Metric label="Games" value={profileState.faction.games} />
          <Metric label="Wins" value={profileState.faction.wins} />
          <Metric label="Losses" value={profileState.faction.losses} />
          <Metric label="Win Rate" value={formatPercent(profileState.faction.winRate)} />
        </ProfileCard>
      </section>

      <section className="command-center-grid" aria-label="Faction charts">
        <section className="panel command-card">
          <div className="panel-heading">
            <p className="eyebrow">Faction Charts</p>
            <h2>Popularity and Win Profile</h2>
          </div>
          <div className="intelligence-card-body">
            <BarChart
              points={[
                {
                  label: 'Games',
                  value: profileState.faction.games,
                },
                {
                  label: 'Wins',
                  value: profileState.faction.wins,
                },
                {
                  label: 'Losses',
                  value: profileState.faction.losses,
                },
                {
                  label: 'Win Rate',
                  value: profileState.faction.winRate,
                },
              ]}
              title="Faction popularity and win profile"
            />
          </div>
        </section>

        <section className="panel command-card">
          <div className="panel-heading">
            <p className="eyebrow">Mission Breakdown</p>
            <h2>Division Activity</h2>
          </div>
          <div className="intelligence-card-body">
            <BarChart
              points={profileState.faction.divisionBreakdown.map((division) => ({
                label: division.division,
                value: division.games,
              }))}
              title="Faction division breakdown"
            />
          </div>
        </section>
      </section>

      <section className="faction-profile-grid" aria-label="Faction reports">
        <RecentGamesPanel games={profileState.faction.recentGames} />
        <BestMomentsPanel moments={profileState.faction.bestMoments} />
      </section>

      <FactionMatchupsPanel
        matchups={profileState.faction.matchups}
        summary={profileState.faction.matchupSummary}
      />

      <FactionArmyListsPanel
        highestRated={profileState.faction.armyLists.highestRated}
        mostPopular={profileState.faction.armyLists.mostPopular}
        newest={profileState.faction.armyLists.newest}
      />

      <EntityPreviousNext current={profileState.faction.name} type="faction" />
    </main>
  )
}

function FactionHero({ faction }: { faction: FactionProfileData }) {
  return (
    <section
      className="player-profile-hero profile-hero-focus faction-profile-hero"
      style={{ '--division-accent': getFactionAccent(faction.name) } as CSSProperties}
    >
      <div className="profile-hero-main">
        <p className="eyebrow">Faction Profile</p>
        <h1>{faction.name}</h1>
        <div className="profile-badges" aria-label="Faction status">
          <span>{formatPercent(faction.winRate)} Win Rate</span>
          <span>{faction.games} Games</span>
          <span>
            {faction.wins}–{faction.losses}
          </span>
        </div>
      </div>

      <div className="profile-hero-record" aria-label="Faction record">
        <span>Record</span>
        <strong>
          {faction.wins}–{faction.losses}
        </strong>
      </div>

      <dl className="profile-hero-score" aria-label="Faction key metrics">
        <div>
          <dt>Avg TP</dt>
          <dd>{formatNumber(faction.averageTP)}</dd>
        </div>
        <div>
          <dt>Avg OP</dt>
          <dd>{formatNumber(faction.averageOP)}</dd>
        </div>
        <div>
          <dt>Avg VP</dt>
          <dd>{formatNumber(faction.averageVP)}</dd>
        </div>
      </dl>
    </section>
  )
}

function FactionHeaderFallback({ factionName }: { factionName: string }) {
  return (
    <section className="player-profile-hero" aria-labelledby="faction-title">
      <div>
        <p className="eyebrow">Faction Profile</p>
        <h1 id="faction-title">{factionName || 'Faction'}</h1>
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
        <p className="eyebrow">Faction</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <dl className="profile-metric-list">{children}</dl>
    </section>
  )
}

function RecentGamesPanel({ games }: { games: RecentGame[] }) {
  return (
    <section className="panel faction-report-panel" aria-labelledby="faction-games">
      <div className="panel-heading">
        <p className="eyebrow">Battle Reports</p>
        <h2 id="faction-games">Recent Games</h2>
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
                  {game.winner} defeated {game.loser}
                </h3>
                <p>{game.mission}</p>
              </div>
              <strong>OP {game.op}</strong>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function BestMomentsPanel({ moments }: { moments: FactionBestMoment[] }) {
  return (
    <section className="panel faction-report-panel" aria-labelledby="faction-moments">
      <div className="panel-heading">
        <p className="eyebrow">Best Moments</p>
        <h2 id="faction-moments">Best Moments</h2>
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
                {moment.date} · {moment.mission}
              </span>
              <blockquote>“{moment.moment}”</blockquote>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function FactionMatchupsPanel({
  matchups,
  summary,
}: {
  matchups: FactionMatchup[]
  summary: FactionProfileData['matchupSummary']
}) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<keyof FactionMatchup>('games')

  const visibleMatchups = matchups
    .filter((matchup) =>
      matchup.opponent.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((left, right) => {
      if (sortKey === 'opponent') {
        return left.opponent.localeCompare(right.opponent)
      }

      return Number(right[sortKey]) - Number(left[sortKey])
    })

  return (
    <section className="panel faction-matchup-panel" aria-labelledby="faction-matchups">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Faction Insights</p>
          <h2 id="faction-matchups">Faction Matchups</h2>
        </div>
      </div>
      <div className="matchup-summary-strip">
        <Metric label="Opponents" value={summary.opponents} />
        <Metric label="Overall Record" value={`${summary.wins}-${summary.losses}`} />
        <Metric label="Win Rate" value={formatPercent(summary.winRate)} />
        <Metric label="Best Opponent" value={summary.bestOpponent} />
      </div>
      <div className="army-list-controls matchup-controls">
        <label>
          <span>Search Opponent</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            value={query}
          />
        </label>
        <label>
          <span>Sort</span>
          <select
            onChange={(event) =>
              setSortKey(event.target.value as keyof FactionMatchup)
            }
            value={sortKey}
          >
            <option value="games">Games</option>
            <option value="wins">Wins</option>
            <option value="losses">Losses</option>
            <option value="winRate">Win %</option>
            <option value="averageTP">Average TP</option>
            <option value="averageOP">Average OP</option>
            <option value="averageVP">Average VP</option>
            <option value="opponent">Opponent</option>
          </select>
        </label>
      </div>
      {visibleMatchups.length === 0 ? (
        <div className="recent-games-empty">
          <strong>No faction matchups have been recorded yet.</strong>
        </div>
      ) : (
        <div className="standings-table faction-matchup-table" role="table">
          <div className="table-row table-head" role="row">
            <span role="columnheader">Opponent</span>
            <span role="columnheader">Games</span>
            <span role="columnheader">Wins</span>
            <span role="columnheader">Losses</span>
            <span role="columnheader">Win %</span>
            <span role="columnheader">Avg TP</span>
            <span role="columnheader">Avg OP</span>
            <span role="columnheader">Avg VP</span>
          </div>
          {visibleMatchups.map((matchup) => (
            <div className="table-row" key={matchup.opponent} role="row">
              <strong role="cell">
                <Link to={`/factions/${encodeURIComponent(matchup.opponent)}`}>
                  {matchup.opponent}
                </Link>
              </strong>
              <span role="cell">{matchup.games}</span>
              <span role="cell">{matchup.wins}</span>
              <span role="cell">{matchup.losses}</span>
              <span role="cell">{formatPercent(matchup.winRate)}</span>
              <span role="cell">{formatNumber(matchup.averageTP)}</span>
              <span role="cell">{formatNumber(matchup.averageOP)}</span>
              <span role="cell">{formatNumber(matchup.averageVP)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function FactionArmyListsPanel({
  highestRated,
  mostPopular,
  newest,
}: {
  highestRated: ArmyList[]
  mostPopular: ArmyList[]
  newest: ArmyList[]
}) {
  return (
    <section className="profile-card-grid" aria-label="Faction army lists">
      <ArmyListStack title="Most Popular Lists" lists={mostPopular} />
      <ArmyListStack title="Highest Rated Lists" lists={highestRated} />
      <ArmyListStack title="Newest Lists" lists={newest} />
    </section>
  )
}

function ArmyListStack({ lists, title }: { lists: ArmyList[]; title: string }) {
  return (
    <section className="panel profile-card">
      <div className="panel-heading">
        <p className="eyebrow">Army List Vault</p>
        <h2>{title}</h2>
      </div>
      {lists.length === 0 ? (
        <div className="recent-games-empty">
          <strong>No approved lists yet.</strong>
        </div>
      ) : (
        <div className="army-list-mini-grid">
          {lists.map((list) => (
            <article className="army-list-mini-card" key={list.id}>
              <span>{list.player}</span>
              <h3>{list.armyName}</h3>
              <p>{list.mission || 'Mission not recorded'}</p>
              <strong>Score {list.score}</strong>
              {list.armyLink ? (
                <a href={list.armyLink} rel="noreferrer" target="_blank">
                  View in Infinity Army
                </a>
              ) : list.armyCode ? (
                <code>{list.armyCode}</code>
              ) : null}
            </article>
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

function decodeFactionName(name: string | undefined) {
  if (!name) {
    return ''
  }

  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function getFactionAccent(factionName: string) {
  const accents = [
    '#C1121F',
    '#4CC9F0',
    '#F0B13E',
    '#2DC653',
    '#8A5CFF',
    '#FF6B35',
    '#00A6A6',
    '#E84855',
  ]
  const index = factionName
    .split('')
    .reduce((total, letter) => total + letter.charCodeAt(0), 0)

  return accents[index % accents.length]
}

function titleToId(title: string) {
  return title.toLowerCase().replaceAll(' ', '-')
}

export default FactionProfile
