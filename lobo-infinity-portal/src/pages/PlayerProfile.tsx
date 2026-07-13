import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import EntityPreviousNext from '../components/EntityPreviousNext'
import Skeleton from '../components/Skeleton'
import { getArmyParentFaction } from '../config/armies'
import { getCanonicalMissionName } from '../config/missions'
import type {
  ArmyList,
  PlayerCareerMetric,
  PlayerCareerSummary,
  PlayerProfileData,
  PlayerRecordSummary,
  RecentGame,
} from '../services/api'
import { request } from '../services/apiCore'
import {
  formatObjectiveScore,
  formatPlayerName,
} from '../services/formatting'
import { isDrawGame } from '../services/gameResults'
import { getProfileClassifications } from '../services/playerClassification'
import {
  formatDivisionLabel,
  getDivisionStyle,
} from '../utils/divisions'

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
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') || ''
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
      getPlayerProfileForCareer(decodedPlayerName, controller.signal),
      getRecentGamesForPlayer(decodedPlayerName, controller.signal),
    ])
      .then(([profile, games]) => {
        setProfileState({
          player: profile,
          playerName: decodedPlayerName,
          status: 'success',
        })
        setRecentGames(filterGamesForPlayer(games, decodedPlayerName, profile))
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
      <>
        <PlayerProfileStyles />
        <main className="portal-shell">
          <ProfileHeaderFallback playerName="" />
          <section className="dashboard-state" aria-label="Player error">
            <p role="alert">Player name is missing.</p>
          </section>
        </main>
      </>
    )
  }

  const isCurrentProfile =
    profileState.status !== 'idle' &&
    profileState.playerName === decodedPlayerName

  if (!isCurrentProfile) {
    return (
      <>
        <PlayerProfileStyles />
        <main className="portal-shell">
          <ProfileHeaderFallback playerName={decodedPlayerName} />
          <section className="profile-card-grid" aria-label="Player loading">
            <Skeleton label="Player identity loading" rows={6} />
            <Skeleton label="Player career loading" rows={6} />
            <Skeleton label="Player recent games loading" rows={6} />
          </section>
        </main>
      </>
    )
  }

  if (profileState.status === 'error') {
    return (
      <>
        <PlayerProfileStyles />
        <main className="portal-shell">
          <ProfileHeaderFallback playerName={decodedPlayerName} />
          <section className="dashboard-state" aria-label="Player error">
            <p role="alert">{profileState.error}</p>
          </section>
        </main>
      </>
    )
  }

  const player = profileState.player
  const career = player.careerSummary ?? buildFallbackCareerSummary(player, recentGames)
  const displayName = formatPlayerName(player.name, player.displayName)
  const classifications = getProfileClassifications(player, career)

  return (
    <>
      <PlayerProfileStyles />
      <main className="portal-shell">
        <PlayerProfileDossier
          career={career}
          classifications={classifications}
          displayName={displayName}
          player={player}
          recentGames={recentGames}
        />
        <EntityPreviousNext current={player.name} eventId={eventId} type="player" />
      </main>
    </>
  )
}

function PlayerProfileStyles() {
  return <style>{playerProfileStyles}</style>
}

function PlayerProfileDossier({
  career,
  classifications,
  displayName,
  player,
  recentGames,
}: {
  career: PlayerCareerSummary
  classifications: ReturnType<typeof getProfileClassifications>
  displayName: string
  player: PlayerProfileData
  recentGames: RecentGame[]
}) {
  const homeLabel = getCompetitiveHomeLabel(player, classifications)
  const level = getCareerLevel(career)
  const leagueLabel = getCurrentLeagueLabel(player)
  const currentTournament = getCurrentTournamentLabel(player)
  const quote = getHeroQuote(recentGames, player)
  const joinedLabel = getJoinedLabel(player)

  return (
    <>
      <section
        className="profile-v21-hero"
        style={getDivisionStyle(player.division)}
        aria-labelledby="player-title"
      >
        <div className="profile-v21-hero-grid">
          <div className="profile-v21-portrait" aria-hidden="true">
            {player.profilePicture ? (
              <img alt="" decoding="async" loading="lazy" src={player.profilePicture} />
            ) : (
              <span>{displayName.slice(0, 1)}</span>
            )}
          </div>
          <div className="profile-v21-identity">
            <p className="eyebrow">Infinity Career Dossier</p>
            <h1 id="player-title">{displayName}</h1>
            <strong>{homeLabel}</strong>
            <div className="profile-v21-meta" aria-label="Player profile details">
              <span>{leagueLabel}</span>
              {player.city ? <span>{player.city}</span> : null}
              {joinedLabel ? <span>{joinedLabel}</span> : null}
              {player.homeStore ? <span>{player.homeStore}</span> : null}
            </div>
            <div className="profile-v21-badges" aria-label="Player classifications">
              {classifications.map((classification) => (
                <span key={classification}>{classification}</span>
              ))}
              {player.rank > 0 ? <span>#{player.rank} Ranked</span> : null}
            </div>
          </div>
          {quote ? (
            <blockquote className="profile-v21-quote">{quote}</blockquote>
          ) : null}
        </div>
      </section>

      <section className="profile-v21-topline" aria-label="Player season status">
        <SeasonSnapshot
          career={career}
          leagueLabel={leagueLabel}
          player={player}
        />
        <CareerLevelCard level={level} />
      </section>

      <section className="profile-v21-shell" aria-label="Player dossier">
        <ProfileSectionNav />
        <div className="profile-v21-main">
          <PerformanceOverview career={career} player={player} />
          <RecentGamesPanel games={recentGames} player={player} />
          <ArmyListsPanel player={player} />
          <NotesMediaPanel currentTournament={currentTournament} player={player} />
        </div>
        <aside className="profile-v21-aside" aria-label="Player analytics">
          <FactionBreakdown career={career} player={player} />
          <AchievementPreview career={career} player={player} />
          <RivalsPanel games={recentGames} player={player} />
          <ActivityFeed
            currentTournament={currentTournament}
            games={recentGames}
            leagueLabel={leagueLabel}
            player={player}
          />
        </aside>
      </section>
    </>
  )
}

function CareerLevelCard({
  level,
}: {
  level: ReturnType<typeof getCareerLevel>
}) {
  return (
    <section className="panel profile-v21-level-card" aria-labelledby="career-level-title">
      <div className="profile-v21-level-mark">
        <span>Level</span>
        <strong>{level.current}</strong>
      </div>
      <div>
        <div className="panel-heading">
          <p className="eyebrow">Career Level</p>
          <h2 id="career-level-title">Battlefield Progress</h2>
        </div>
        <div className="profile-v21-progress" aria-label={level.ariaLabel}>
          <span style={{ width: `${level.progress}%` }} />
        </div>
        <p>
          {level.currentGames} of {level.nextThreshold} official games toward
          Level {level.next}
        </p>
      </div>
    </section>
  )
}

function SeasonSnapshot({
  career,
  leagueLabel,
  player,
}: {
  career: PlayerCareerSummary
  leagueLabel: string
  player: PlayerProfileData
}) {
  const record = career.records.overall

  return (
    <section className="panel profile-v21-season" aria-labelledby="season-snapshot-title">
      <div className="panel-heading">
        <p className="eyebrow">Season Snapshot</p>
        <h2 id="season-snapshot-title">Current Campaign</h2>
      </div>
      <dl>
        <div>
          <dt>Record</dt>
          <dd>{formatRecord(record)}</dd>
        </div>
        <div>
          <dt>Rank</dt>
          <dd>{player.rank > 0 ? `#${player.rank}` : 'Unranked'}</dd>
        </div>
        <div>
          <dt>Division</dt>
          <dd>{formatDivisionLabel(player.division) || leagueLabel}</dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>{leagueLabel}</dd>
        </div>
        <div>
          <dt>Games</dt>
          <dd>{career.totalGames}</dd>
        </div>
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
        <div>
          <dt>Win Rate</dt>
          <dd>{formatPercent(record.winPercentage)}</dd>
        </div>
      </dl>
    </section>
  )
}

function ProfileSectionNav() {
  const sections = [
    ['Overview', '#profile-overview'],
    ['Match History', '#recent-games-title'],
    ['Statistics', '#profile-statistics'],
    ['Factions', '#profile-factions'],
    ['Achievements', '#achievements-title'],
    ['Rivals', '#profile-rivals'],
    ['Activity', '#profile-activity'],
  ]

  return (
    <nav className="profile-v21-nav" aria-label="Player profile sections">
      {sections.map(([label, href]) => (
        <a href={href} key={label}>{label}</a>
      ))}
    </nav>
  )
}

function PerformanceOverview({
  career,
  player,
}: {
  career: PlayerCareerSummary
  player: PlayerProfileData
}) {
  const metrics = getPerformanceMetrics(career, player)
  const points = metrics.map(({ x, y }) => `${x},${y}`).join(' ')

  return (
    <section className="panel profile-v21-performance" id="profile-overview" aria-labelledby="performance-title">
      <div className="panel-heading">
        <p className="eyebrow">Overview</p>
        <h2 id="performance-title">Performance Overview</h2>
      </div>
      <div className="profile-v21-performance-grid">
        <svg viewBox="0 0 200 200" role="img" aria-label="Player performance radar chart">
          <polygon className="profile-v21-radar-grid" points="100,20 176,76 147,166 53,166 24,76" />
          <polygon className="profile-v21-radar-fill" points={points} />
          {metrics.map((metric) => (
            <text key={metric.label} x={metric.labelX} y={metric.labelY}>
              {metric.shortLabel}
            </text>
          ))}
        </svg>
        <dl className="profile-v21-stat-list" id="profile-statistics">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.displayValue}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="profile-v21-analysis">
        <Metric label="Primary Army" value={career.quickStats.mostPlayedArmy || player.favoriteFaction} />
        <Metric label="Top Mission" value={formatMissionMetric(career.quickStats.mostPlayedMission || player.favoriteMission)} />
        <Metric label="Current Streak" value={`${career.currentWinStreak} wins`} />
      </div>
    </section>
  )
}

function FactionBreakdown({
  career,
  player,
}: {
  career: PlayerCareerSummary
  player: PlayerProfileData
}) {
  const factions = getFactionBreakdown(career, player)
  const first = factions[0]

  return (
    <section className="panel profile-v21-factions" id="profile-factions" aria-labelledby="faction-breakdown-title">
      <div className="panel-heading">
        <p className="eyebrow">Factions</p>
        <h2 id="faction-breakdown-title">Faction Breakdown</h2>
      </div>
      {first ? (
        <>
          <div
            className="profile-v21-faction-ring"
            style={
              { '--faction-share': `${first.share}%` } as CSSProperties &
                Record<'--faction-share', string>
            }
            aria-label={`${first.label} ${first.share}% usage`}
          >
            <strong>{first.share}%</strong>
            <span>{first.label}</span>
          </div>
          <div className="profile-v21-faction-list">
            {factions.map((faction) => (
              <div key={faction.label}>
                <span>{faction.label}</span>
                <strong>{faction.games} games</strong>
                <small>{formatPercent(faction.winPercentage)}</small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="player-profile-empty">No faction records available.</p>
      )}
    </section>
  )
}

function AchievementPreview({
  career,
  player,
}: {
  career: PlayerCareerSummary
  player: PlayerProfileData
}) {
  const achievements = getAchievementItems(career, player)

  return (
    <section className="panel player-achievement-panel" aria-labelledby="achievements-title">
      <div className="panel-heading">
        <p className="eyebrow">Achievements</p>
        <h2 id="achievements-title">Achievements</h2>
      </div>
      <div className="profile-v21-achievements">
        {achievements.map((achievement) => (
          <article
            className={achievement.unlocked ? 'is-unlocked' : ''}
            key={achievement.title}
          >
            <i aria-hidden="true" />
            <span>{achievement.tier}</span>
            <strong>{achievement.title}</strong>
            <small>{achievement.detail}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

function RivalsPanel({
  games,
  player,
}: {
  games: RecentGame[]
  player: PlayerProfileData
}) {
  const rivals = getRivalItems(games, player)

  return (
    <section className="panel profile-v21-rivals" id="profile-rivals" aria-labelledby="rivals-title">
      <div className="panel-heading">
        <p className="eyebrow">Rivals</p>
        <h2 id="rivals-title">Rivals</h2>
      </div>
      {rivals.length > 0 ? (
        <div className="profile-v21-rival-list">
          {rivals.map((rival) => (
            <div key={rival.name}>
              <span>{rival.label}</span>
              <strong>{rival.name}</strong>
              <small>{rival.detail}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="player-profile-empty">No rival records available.</p>
      )}
    </section>
  )
}

function ActivityFeed({
  currentTournament,
  games,
  leagueLabel,
  player,
}: {
  currentTournament: string
  games: RecentGame[]
  leagueLabel: string
  player: PlayerProfileData
}) {
  const activity = getActivityItems(games, player, leagueLabel, currentTournament)

  return (
    <section className="panel profile-v21-activity" id="profile-activity" aria-labelledby="activity-title">
      <div className="panel-heading">
        <p className="eyebrow">Activity Feed</p>
        <h2 id="activity-title">Latest Signals</h2>
      </div>
      <div className="profile-v21-activity-list">
        {activity.map((item) => (
          <div key={`${item.date}-${item.label}`}>
            <span>{item.date}</span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function ArmyListsPanel({ player }: { player: PlayerProfileData }) {
  return (
    <section className="panel profile-v21-army-lists" id="profile-army-lists" aria-labelledby="army-lists-title">
      <div className="panel-heading">
        <p className="eyebrow">Army Lists</p>
        <h2 id="army-lists-title">Submitted Army Lists</h2>
      </div>
      <dl className="profile-v21-army-summary">
        <Metric label="Lists Submitted" value={player.armyListSummary.submitted} />
        <Metric label="Average List Rating" value={player.armyListSummary.averageRating} />
        <Metric label="Favorite Faction" value={player.armyListSummary.favoriteFaction || player.favoriteFaction} />
      </dl>
      {player.armyLists.length > 0 ? (
        <div className="army-list-mini-grid">
          {player.armyLists.slice(0, 4).map((list) => (
            <ArmyListMiniCard key={list.id} list={list} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function NotesMediaPanel({
  currentTournament,
  player,
}: {
  currentTournament: string
  player: PlayerProfileData
}) {
  return (
    <section className="panel profile-v21-notes" id="profile-notes" aria-labelledby="notes-title">
      <div className="panel-heading">
        <p className="eyebrow">Notes & Media</p>
        <h2 id="notes-title">Operations Profile</h2>
      </div>
      <dl className="profile-metric-list">
        <Metric label="Availability" value={player.availability.status} />
        <Metric label="Preferred Days" value={player.availability.preferredDays} />
        <Metric label="Preferred Time" value={player.availability.preferredTimes} />
        <Metric label="Discord" value={player.discordHandle} />
        <Metric label="Current Tournament" value={currentTournament} />
      </dl>
      <Link
        className="profile-action-link"
        to={player.scheduleLink || `/match-finder?opponent=${encodeURIComponent(player.name)}`}
      >
        Schedule Match
      </Link>
    </section>
  )
}

function RecentGamesPanel({
  games,
  player,
}: {
  games: RecentGame[]
  player: PlayerProfileData
}) {
  return (
    <section className="panel player-recent-games-panel" aria-labelledby="recent-games-title">
      <div className="panel-heading">
        <p className="eyebrow">Recent Activity</p>
        <h2 id="recent-games-title">Recent Games</h2>
      </div>

      {games.length === 0 ? (
        <p className="player-profile-empty">No recorded games yet.</p>
      ) : (
        <div className="player-recent-game-list">
          {games.slice(0, 10).map((game) => {
            const result = getPlayerResult(game, player)
            return (
              <Link className="player-recent-game-row" key={game.id} to={`/games/${game.id}`}>
                <span className={`player-result-chip ${result.toLowerCase()}`}>
                  {result}
                </span>
                <div>
                  <strong>{getOpponentLabel(game, player)}</strong>
                  <small>
                    {formatGameType(game.gameType || 'league')} / {getCanonicalMissionName(game.mission) || 'Mission not recorded'}
                  </small>
                </div>
                <div>
                  <span>{getPlayerArmy(game, player) || 'Army not recorded'}</span>
                  <small>{game.date || 'Date not recorded'}</small>
                </div>
                <strong>{formatObjectiveScore(game)}</strong>
              </Link>
            )
          })}
        </div>
      )}
    </section>
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

async function getPlayerProfileForCareer(
  playerName: string,
  signal: AbortSignal,
): Promise<PlayerProfileData> {
  const payload = await request(
    'player',
    { signal },
    { name: playerName },
  )

  return normalizePlayerProfilePayload(payload)
}

function normalizePlayerProfilePayload(payload: unknown): PlayerProfileData {
  const record = isRecord(payload) ? payload : {}

  if (record.success === false) {
    throw new Error(getLocalString(record, 'error') || 'Player could not be loaded.')
  }

  const player = isRecord(record.player) ? record.player : {}
  const name = getLocalString(player, 'name')

  if (!name) {
    throw new Error('Player profile could not be loaded.')
  }

  return {
    armyListSummary: normalizePlayerArmyListSummary(player.armyListSummary),
    armyLists: getLocalArray(player, 'armyLists').map(normalizePlayerArmyList),
    availability: normalizePlayerAvailability(player.availability),
    bestFaction: getLocalString(player, 'bestFaction'),
    bestMission: getLocalString(player, 'bestMission'),
    careerSummary: normalizePlayerCareerSummary(player.careerSummary),
    city: getLocalString(player, 'city'),
    discordHandle: getLocalString(player, 'discordHandle'),
    displayName: getLocalString(player, 'displayName') || name,
    division: getLocalString(player, 'division'),
    favoriteFaction: getLocalString(player, 'favoriteFaction'),
    favoriteMission: getLocalString(player, 'favoriteMission'),
    firstTurnGames: getLocalNumber(player, 'firstTurnGames'),
    firstTurnWinRate: getLocalNumber(player, 'firstTurnWinRate'),
    games: getLocalNumber(player, 'games'),
    homeStore: getLocalString(player, 'homeStore'),
    losses: getLocalNumber(player, 'losses'),
    draws: getLocalNumber(player, 'draws'),
    name,
    nemesis: getLocalString(player, 'nemesis'),
    op: getLocalNumber(player, 'op'),
    preferredLocations: getLocalString(player, 'preferredLocations'),
    profilePicture: getLocalString(player, 'profilePicture'),
    rank: getLocalNumber(player, 'rank'),
    registeredEvents: getLocalArray(player, 'registeredEvents').map((item) => {
      const event = isRecord(item) ? item : {}

      return {
        eventId: getLocalString(event, 'eventId'),
        eventName: getLocalString(event, 'eventName'),
        eventType: getLocalString(event, 'eventType'),
        preferredTeam: getLocalString(event, 'preferredTeam'),
        registeredAt: getLocalString(event, 'registeredAt'),
        status: getLocalString(event, 'status'),
        team: getLocalString(event, 'team'),
        updatedAt: getLocalString(event, 'updatedAt'),
      }
    }),
    rival: getLocalString(player, 'rival'),
    scheduleLink: getLocalString(player, 'scheduleLink'),
    secondTurnGames: getLocalNumber(player, 'secondTurnGames'),
    secondTurnWinRate: getLocalNumber(player, 'secondTurnWinRate'),
    tp: getLocalNumber(player, 'tp'),
    vp: getLocalNumber(player, 'vp'),
    wins: getLocalNumber(player, 'wins'),
  }
}

function normalizePlayerAvailability(value: unknown) {
  const record = isRecord(value) ? value : {}

  return {
    city: getLocalString(record, 'city'),
    discordHandle: getLocalString(record, 'discordHandle'),
    friday: getLocalString(record, 'friday'),
    homeStore: getLocalString(record, 'homeStore'),
    maxTravelDistance: getLocalString(record, 'maxTravelDistance'),
    monday: getLocalString(record, 'monday'),
    notes: getLocalString(record, 'notes'),
    player: getLocalString(record, 'player'),
    preferredDays: getLocalString(record, 'preferredDays'),
    preferredLocations: getLocalString(record, 'preferredLocations'),
    preferredTimes: getLocalString(record, 'preferredTimes'),
    saturday: getLocalString(record, 'saturday'),
    status: getLocalString(record, 'status'),
    sunday: getLocalString(record, 'sunday'),
    thursday: getLocalString(record, 'thursday'),
    tuesday: getLocalString(record, 'tuesday'),
    updatedAt: getLocalString(record, 'updatedAt'),
    wednesday: getLocalString(record, 'wednesday'),
  }
}

function normalizePlayerArmyList(item: unknown): ArmyList {
  const record = isRecord(item) ? item : {}

  return {
    approved: getLocalBoolean(record, 'approved'),
    armyCode: getLocalString(record, 'armyCode'),
    armyLink: getLocalString(record, 'armyLink'),
    armyName: getLocalString(record, 'armyName'),
    description: getLocalString(record, 'description'),
    downvotes: getLocalNumber(record, 'downvotes'),
    event: getLocalString(record, 'event'),
    faction: getLocalString(record, 'faction'),
    id: getLocalNumber(record, 'id'),
    mission: getLocalString(record, 'mission'),
    player: getLocalString(record, 'player'),
    playerDisplayName:
      getLocalString(record, 'playerDisplayName') || getLocalString(record, 'player'),
    score: getLocalNumber(record, 'score'),
    sectorial: getLocalString(record, 'sectorial'),
    submissionDate: getLocalString(record, 'submissionDate'),
    submitterEmail: getLocalString(record, 'submitterEmail'),
    upvotes: getLocalNumber(record, 'upvotes'),
  }
}

function normalizePlayerArmyListSummary(value: unknown) {
  const record = isRecord(value) ? value : {}

  return {
    averageRating: getLocalNumber(record, 'averageRating'),
    favoriteFaction: getLocalString(record, 'favoriteFaction'),
    highestRated: isRecord(record.highestRated)
      ? normalizePlayerArmyList(record.highestRated)
      : null,
    newest: isRecord(record.newest)
      ? normalizePlayerArmyList(record.newest)
      : null,
    submitted: getLocalNumber(record, 'submitted'),
  }
}

function normalizePlayerCareerSummary(value: unknown): PlayerCareerSummary | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const records = isRecord(value.records) ? value.records : {}
  const armies = isRecord(value.armies) ? value.armies : {}
  const missions = isRecord(value.missions) ? value.missions : {}
  const quickStats = isRecord(value.quickStats) ? value.quickStats : {}

  return {
    armies: {
      best: normalizePlayerCareerMetric(armies.best),
      favorite: normalizePlayerCareerMetric(armies.favorite),
      mostRecent: normalizePlayerCareerMetric(armies.mostRecent),
    },
    currentWinStreak: getLocalNumber(value, 'currentWinStreak'),
    gamesThisMonth: getLocalNumber(value, 'gamesThisMonth'),
    longestWinStreak: getLocalNumber(value, 'longestWinStreak'),
    losses: getLocalNumber(value, 'losses'),
    missions: {
      best: normalizePlayerCareerMetric(missions.best),
      favorite: normalizePlayerCareerMetric(missions.favorite),
      mostRecent: normalizePlayerCareerMetric(missions.mostRecent),
    },
    quickStats: {
      biggestVictory: getLocalNumber(quickStats, 'biggestVictory'),
      highestVpGame: getLocalNumber(quickStats, 'highestVpGame'),
      mostPlayedArmy: getLocalString(quickStats, 'mostPlayedArmy'),
      mostPlayedArmyParentFaction: getLocalString(
        quickStats,
        'mostPlayedArmyParentFaction',
      ),
      mostPlayedMission: getLocalString(quickStats, 'mostPlayedMission'),
    },
    records: {
      casual: normalizePlayerRecordSummary(records.casual),
      league: normalizePlayerRecordSummary(records.league),
      overall: normalizePlayerRecordSummary(records.overall),
      tournament: normalizePlayerRecordSummary(records.tournament),
    },
    totalGames: getLocalNumber(value, 'totalGames'),
    winPercentage: getLocalNumber(value, 'winPercentage'),
    wins: getLocalNumber(value, 'wins'),
  }
}

function normalizePlayerCareerMetric(value: unknown): PlayerCareerMetric {
  const record = isRecord(value) ? value : {}

  return {
    ...normalizePlayerRecordSummary(record),
    insufficientGames: getLocalBoolean(record, 'insufficientGames'),
    label: getLocalString(record, 'label'),
    lastPlayed: getLocalString(record, 'lastPlayed'),
    parentFaction: getLocalString(record, 'parentFaction'),
  }
}

function normalizePlayerRecordSummary(value: unknown): PlayerRecordSummary {
  const record = isRecord(value) ? value : {}

  return {
    draws: getLocalNumber(record, 'draws'),
    games: getLocalNumber(record, 'games'),
    losses: getLocalNumber(record, 'losses'),
    winPercentage: getLocalNumber(record, 'winPercentage'),
    wins: getLocalNumber(record, 'wins'),
  }
}

async function getRecentGamesForPlayer(
  playerName: string,
  signal: AbortSignal,
): Promise<RecentGame[]> {
  const payload = await request(
    'recentGames',
    { signal },
    { playerName },
  )
  const record = isRecord(payload) ? payload : {}
  const games = Array.isArray(record.games) ? record.games : []

  return games.map(normalizePlayerRecentGame)
}

function normalizePlayerRecentGame(item: unknown): RecentGame {
  const record = isRecord(item) ? item : {}

  return {
    bestMoment: getLocalString(record, 'bestMoment'),
    date: getLocalString(record, 'date'),
    division: getLocalString(record, 'division'),
    eventId: getLocalString(record, 'eventId'),
    firstTurn: getLocalString(record, 'firstTurn'),
    gameResult: getLocalString(record, 'gameResult') || undefined,
    gameType: getLocalString(record, 'gameType') || 'league',
    id: getLocalNumber(record, 'id'),
    loser: getLocalString(record, 'loser'),
    loserDisplayName: getLocalString(record, 'loserDisplayName'),
    loserFaction: getLocalString(record, 'loserFaction'),
    mission: getLocalString(record, 'mission'),
    op: getLocalString(record, 'op'),
    tp: getLocalString(record, 'tp'),
    vp: getLocalString(record, 'vp'),
    winner: getLocalString(record, 'winner'),
    winnerDisplayName: getLocalString(record, 'winnerDisplayName'),
    winnerFaction: getLocalString(record, 'winnerFaction'),
  }
}

function buildFallbackCareerSummary(
  player: PlayerProfileData,
  games: RecentGame[],
): PlayerCareerSummary {
  const overall = {
    draws: 0,
    games: player.games,
    losses: player.losses,
    winPercentage: player.games > 0
      ? Math.round((player.wins / player.games) * 100)
      : 0,
    wins: player.wins,
  }
  const zero = emptyRecord()
  const favoriteArmy = buildMetric(player.favoriteFaction, overall, true)
  const bestArmy = buildMetric(player.bestFaction, overall, true)
  const recentArmy = buildMetric(getPlayerArmy(games[0], player), overall, true)
  const favoriteMission = buildMetric(formatMissionMetric(player.favoriteMission), overall)
  const bestMission = player.bestMission
    ? buildMetric(formatMissionMetric(player.bestMission), overall)
    : {
        ...buildMetric('', zero),
        insufficientGames: true,
      }
  const recentMission = buildMetric(
    games[0] ? formatMissionMetric(games[0].mission) : '',
    zero,
  )

  return {
    armies: {
      best: bestArmy,
      favorite: favoriteArmy,
      mostRecent: recentArmy,
    },
    currentWinStreak: 0,
    gamesThisMonth: games.filter(isGameThisMonth).length,
    longestWinStreak: 0,
    losses: player.losses,
    missions: {
      best: bestMission,
      favorite: favoriteMission,
      mostRecent: recentMission,
    },
    quickStats: {
      biggestVictory: 0,
      highestVpGame: getHighestVp(games, player),
      mostPlayedArmy: player.favoriteFaction,
      mostPlayedArmyParentFaction: getArmyParentFaction(player.favoriteFaction),
      mostPlayedMission: formatMissionMetric(player.favoriteMission),
    },
    records: {
      casual: zero,
      league: overall,
      overall,
      tournament: zero,
    },
    totalGames: player.games,
    winPercentage: overall.winPercentage,
    wins: player.wins,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function getLocalString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function getLocalNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getLocalBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'boolean' ? value : false
}

function getLocalArray(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return Array.isArray(value) ? value : []
}

function emptyRecord(): PlayerRecordSummary {
  return {
    draws: 0,
    games: 0,
    losses: 0,
    winPercentage: 0,
    wins: 0,
  }
}

function buildMetric(
  label: string,
  record: PlayerRecordSummary,
  includeParentFaction = false,
): PlayerCareerMetric {
  return {
    ...record,
    label,
    lastPlayed: '',
    parentFaction: includeParentFaction ? getArmyParentFaction(label) : undefined,
  }
}

function getCompetitiveHomeLabel(
  player: PlayerProfileData,
  classifications: ReturnType<typeof getProfileClassifications>,
) {
  const division = formatDivisionLabel(player.division)

  if (division) {
    return division
  }

  if (classifications.includes('Tournament Player')) {
    return 'Tournament Player'
  }

  return 'Casual Player'
}

function getCareerLevel(career: PlayerCareerSummary) {
  const officialGames = career.records.league.games + career.records.tournament.games
  const current = Math.max(1, Math.floor(officialGames / 5) + 1)
  const next = current + 1
  const previousThreshold = (current - 1) * 5
  const nextThreshold = current * 5
  const progress =
    nextThreshold > previousThreshold
      ? Math.min(
          100,
          Math.round(
            ((officialGames - previousThreshold) /
              (nextThreshold - previousThreshold)) *
              100,
          ),
        )
      : 0

  return {
    ariaLabel: `${officialGames} official games, ${progress}% to Level ${next}`,
    current,
    currentGames: officialGames,
    next,
    nextThreshold,
    progress,
  }
}

function getJoinedLabel(player: PlayerProfileData) {
  const registrations = player.registeredEvents
    .map((event) => event.registeredAt)
    .filter(Boolean)
    .sort()
  const firstRegistration = registrations[0]

  if (!firstRegistration) {
    return ''
  }

  const date = new Date(firstRegistration)

  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  return `Joined ${date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })}`
}

function getHeroQuote(games: RecentGame[], player: PlayerProfileData) {
  const quotedGame = games.find((game) => game.bestMoment.trim())

  if (quotedGame) {
    return `"${quotedGame.bestMoment.trim()}"`
  }

  if (player.availability.notes) {
    return `"${player.availability.notes}"`
  }

  return ''
}

function getCurrentLeagueLabel(player: PlayerProfileData) {
  const league = player.registeredEvents.find((event) =>
    isActiveProfileEvent(event.eventType, event.eventName, event.status, 'league'),
  )

  if (!league) {
    return formatDivisionLabel(player.division) || 'No active league'
  }

  return league.eventName || league.eventId || formatDivisionLabel(player.division)
}

function getPerformanceMetrics(
  career: PlayerCareerSummary,
  player: PlayerProfileData,
) {
  const average = (value: number, games: number) =>
    games > 0 ? Math.round(value / games) : 0
  const record = career.records.overall
  const values = [
    {
      displayValue: formatPercent(record.winPercentage),
      label: 'Win Rate',
      shortLabel: 'WIN',
      value: record.winPercentage,
    },
    {
      displayValue: String(average(player.tp, Math.max(record.games, 1))),
      label: 'Average TP',
      shortLabel: 'TP',
      value: Math.min(100, average(player.tp, Math.max(record.games, 1)) * 25),
    },
    {
      displayValue: String(average(player.op, Math.max(record.games, 1))),
      label: 'Average OP',
      shortLabel: 'OP',
      value: Math.min(100, average(player.op, Math.max(record.games, 1)) * 10),
    },
    {
      displayValue: String(average(player.vp, Math.max(record.games, 1))),
      label: 'Average VP',
      shortLabel: 'VP',
      value: Math.min(100, average(player.vp, Math.max(record.games, 1))),
    },
    {
      displayValue: String(career.longestWinStreak),
      label: 'Longest Streak',
      shortLabel: 'STR',
      value: Math.min(100, career.longestWinStreak * 20),
    },
  ]
  const anchors = [
    { x: 100, y: 20, labelX: 88, labelY: 14 },
    { x: 176, y: 76, labelX: 178, labelY: 76 },
    { x: 147, y: 166, labelX: 148, labelY: 186 },
    { x: 53, y: 166, labelX: 22, labelY: 186 },
    { x: 24, y: 76, labelX: 0, labelY: 76 },
  ]

  return values.map((metric, index) => {
    const anchor = anchors[index]
    const ratio = Math.max(0.12, Math.min(1, metric.value / 100))

    return {
      ...metric,
      labelX: anchor.labelX,
      labelY: anchor.labelY,
      x: 100 + (anchor.x - 100) * ratio,
      y: 100 + (anchor.y - 100) * ratio,
    }
  })
}

function getFactionBreakdown(
  career: PlayerCareerSummary,
  player: PlayerProfileData,
) {
  const metrics = [
    career.armies.favorite,
    career.armies.best,
    career.armies.mostRecent,
  ]
  const map = new Map<string, PlayerRecordSummary>()

  metrics.forEach((metric) => {
    const label = metric.label || player.favoriteFaction

    if (!label) {
      return
    }

    const existing = map.get(label)
    map.set(label, {
      draws: (existing?.draws ?? 0) + metric.draws,
      games: (existing?.games ?? 0) + metric.games,
      losses: (existing?.losses ?? 0) + metric.losses,
      winPercentage: metric.winPercentage || existing?.winPercentage || 0,
      wins: (existing?.wins ?? 0) + metric.wins,
    })
  })

  const totalGames = Array.from(map.values()).reduce(
    (sum, record) => sum + record.games,
    0,
  )

  return Array.from(map.entries())
    .map(([label, record]) => ({
      games: record.games,
      label,
      share: totalGames > 0 ? Math.round((record.games / totalGames) * 100) : 0,
      winPercentage: record.winPercentage,
    }))
    .sort((a, b) => b.games - a.games)
}

function getAchievementItems(
  career: PlayerCareerSummary,
  player: PlayerProfileData,
) {
  const officialGames = career.records.league.games + career.records.tournament.games
  const achievements = [
    {
      detail: `${Math.min(officialGames, 1)} / 1 official games`,
      tier: officialGames >= 1 ? 'Earned' : 'Progress',
      title: 'First Official Game',
      unlocked: officialGames >= 1,
    },
    {
      detail: `${Math.min(career.totalGames, 10)} / 10 recorded games`,
      tier: career.totalGames >= 10 ? 'Earned' : 'Progress',
      title: 'Campaign Regular',
      unlocked: career.totalGames >= 10,
    },
    {
      detail: `${Math.min(officialGames, 50)} / 50 official games`,
      tier: officialGames >= 50 ? 'Earned' : 'Progress',
      title: 'Veteran',
      unlocked: officialGames >= 50,
    },
    {
      detail: player.rank > 0 ? `Rank #${player.rank}` : 'Unranked',
      tier: player.rank > 0 ? 'Earned' : 'Progress',
      title: 'Ranked Combatant',
      unlocked: player.rank > 0,
    },
    {
      detail: `${player.armyListSummary.submitted} submitted`,
      tier: player.armyListSummary.submitted > 0 ? 'Earned' : 'Progress',
      title: 'List Architect',
      unlocked: player.armyListSummary.submitted > 0,
    },
  ]

  return achievements
}

function getRivalItems(games: RecentGame[], player: PlayerProfileData) {
  const rivalMap = new Map<string, { draws: number; games: number; losses: number; wins: number }>()

  games.forEach((game) => {
    const opponent = getOpponentLabel(game, player)
    const existing = rivalMap.get(opponent) ?? {
      draws: 0,
      games: 0,
      losses: 0,
      wins: 0,
    }
    const result = getPlayerResult(game, player)

    rivalMap.set(opponent, {
      draws: existing.draws + (result === 'Draw' ? 1 : 0),
      games: existing.games + 1,
      losses: existing.losses + (result === 'Loss' ? 1 : 0),
      wins: existing.wins + (result === 'Win' ? 1 : 0),
    })
  })

  const derived = Array.from(rivalMap.entries())
    .sort(([, a], [, b]) => b.games - a.games)
    .slice(0, 3)
    .map(([name, record], index) => ({
      detail: `${record.wins}-${record.losses}${record.draws ? `-${record.draws}` : ''}`,
      label: index === 0 ? 'Most Played' : 'Head to Head',
      name,
    }))

  const namedRivals = [
    player.rival
      ? {
          detail: 'Profile rival',
          label: 'Rival',
          name: player.rival,
        }
      : null,
    player.nemesis
      ? {
          detail: 'Profile nemesis',
          label: 'Nemesis',
          name: player.nemesis,
        }
      : null,
  ].filter((item): item is { detail: string; label: string; name: string } =>
    Boolean(item),
  )

  return [...namedRivals, ...derived].filter(
    (item, index, items) =>
      items.findIndex((candidate) => candidate.name === item.name) === index,
  )
}

function getActivityItems(
  games: RecentGame[],
  player: PlayerProfileData,
  leagueLabel: string,
  currentTournament: string,
) {
  const gameItems = games.slice(0, 4).map((game) => ({
    date: game.date || 'Recent',
    detail: `${getPlayerResult(game, player)} vs ${getOpponentLabel(game, player)}`,
    label: formatGameType(game.gameType || 'league'),
  }))
  const registrationItems = player.registeredEvents.slice(0, 3).map((event) => ({
    date: event.updatedAt || event.registeredAt || 'Registered',
    detail: event.status || event.team || event.preferredTeam,
    label: event.eventName || event.eventId,
  }))
  const fallbackItems = [
    {
      date: 'Current',
      detail: formatDivisionLabel(player.division) || leagueLabel,
      label: 'League Status',
    },
    {
      date: 'Current',
      detail: currentTournament,
      label: 'Tournament Status',
    },
  ]

  return [...gameItems, ...registrationItems, ...fallbackItems].slice(0, 6)
}

function isActiveProfileEvent(
  eventType: string,
  eventName: string,
  status: string,
  target: 'league' | 'tournament',
) {
  const normalizedStatus = status.trim().toLowerCase()

  if (
    ['deleted', 'removed', 'withdrawn', 'disabled', 'archived', 'completed'].includes(
      normalizedStatus,
    )
  ) {
    return false
  }

  const eventIdentity = `${eventType} ${eventName}`.toLowerCase()

  return target === 'league'
    ? eventIdentity.includes('league')
    : eventIdentity.includes('tournament')
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

function filterGamesForPlayer(
  games: RecentGame[],
  requestedName: string,
  player: PlayerProfileData,
) {
  const keys = [
    requestedName,
    player.name,
    player.displayName,
  ].map((value) => value.toLowerCase())

  return games.filter((game) =>
    keys.includes(game.winner.toLowerCase()) ||
    keys.includes(game.loser.toLowerCase()) ||
    keys.includes(game.winnerDisplayName.toLowerCase()) ||
    keys.includes(game.loserDisplayName.toLowerCase()),
  )
}

function getCurrentTournamentLabel(player: PlayerProfileData) {
  const tournament = player.registeredEvents.find((event) =>
    `${event.eventType} ${event.eventName}`.toLowerCase().includes('tournament'),
  )

  if (!tournament) {
    return 'Not registered'
  }

  const status = tournament.status.trim().toLowerCase()

  if (['deleted', 'removed', 'withdrawn'].includes(status)) {
    return 'Not registered'
  }

  return tournament.eventName || tournament.team || tournament.eventId || 'Registered'
}

function getPlayerResult(game: RecentGame, player: PlayerProfileData) {
  if (isDrawGame(game)) {
    return 'Draw'
  }

  return isPlayerWinner(game, player) ? 'Win' : 'Loss'
}

function getOpponentLabel(game: RecentGame, player: PlayerProfileData) {
  if (isPlayerWinner(game, player)) {
    return formatPlayerName(game.loser, game.loserDisplayName)
  }

  return formatPlayerName(game.winner, game.winnerDisplayName)
}

function getPlayerArmy(game: RecentGame | undefined, player: PlayerProfileData) {
  if (!game) {
    return ''
  }

  return isPlayerWinner(game, player)
    ? game.winnerFaction
    : game.loserFaction
}

function isPlayerWinner(game: RecentGame, player: PlayerProfileData) {
  return [
    game.winner,
    game.winnerDisplayName,
  ].some((value) => isSamePlayer(value, player))
}

function isSamePlayer(value: string, player: PlayerProfileData) {
  const key = value.toLowerCase()
  return key === player.name.toLowerCase() ||
    key === player.displayName.toLowerCase()
}

function formatGameType(value: string) {
  if (value === 'tournament') {
    return 'Tournament'
  }

  if (value === 'casual') {
    return 'Casual'
  }

  return 'League'
}

function isGameThisMonth(game: RecentGame) {
  const date = new Date(game.date)
  const now = new Date()

  return Number.isFinite(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
}

function getHighestVp(games: RecentGame[], player: PlayerProfileData) {
  return games.reduce((highest, game) => {
    const value = getPlayerVp(game, player)
    return Math.max(highest, value)
  }, 0)
}

function getPlayerVp(game: RecentGame, player: PlayerProfileData) {
  const scores = game.vp.split('-').map((value) => Number(value.trim()) || 0)

  if (scores.length < 2) {
    return 0
  }

  return isPlayerWinner(game, player) ? scores[0] : scores[1]
}

function formatPercent(value: number) {
  return `${value}%`
}

function formatRecord(record: PlayerRecordSummary) {
  return record.draws > 0
    ? `${record.wins}-${record.losses}-${record.draws}`
    : `${record.wins}-${record.losses}`
}

function formatMissionMetric(value: string) {
  return getCanonicalMissionName(value) || value
}

const playerProfileStyles = `
.profile-v21-hero {
  position: relative;
  min-height: clamp(520px, 56vw, 720px);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--division-accent, #4cc9f0) 58%, #2a3b49);
  background:
    radial-gradient(circle at 23% 52%, rgba(76, 201, 240, 0.24), transparent 26%),
    radial-gradient(circle at 80% 44%, rgba(178, 18, 42, 0.28), transparent 31%),
    linear-gradient(115deg, rgba(5, 6, 8, 0.98) 0%, rgba(10, 16, 24, 0.94) 44%, rgba(178, 18, 42, 0.22) 100%),
    #050608;
  box-shadow: 0 30px 96px rgba(0, 0, 0, 0.46);
}

.profile-v21-hero::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background:
    linear-gradient(90deg, rgba(76, 201, 240, 0.16) 1px, transparent 1px),
    linear-gradient(0deg, rgba(76, 201, 240, 0.1) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: linear-gradient(90deg, black, transparent 82%);
}

.profile-v21-hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(0, 1fr) minmax(320px, 430px);
  gap: clamp(28px, 5vw, 72px);
  align-items: center;
  min-height: inherit;
  padding: clamp(36px, 6vw, 88px);
}

.profile-v21-portrait {
  display: grid;
  width: clamp(260px, 28vw, 360px);
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 3px solid #4cc9f0;
  border-radius: 999px;
  background:
    radial-gradient(circle at 36% 25%, rgba(76, 201, 240, 0.32), transparent 48%),
    #121a24;
  box-shadow:
    0 0 0 16px rgba(76, 201, 240, 0.08),
    0 0 0 28px rgba(76, 201, 240, 0.035),
    0 32px 92px rgba(0, 0, 0, 0.62);
}

.profile-v21-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-v21-portrait span {
  color: #f4f6f8;
  font-family: 'Bebas Neue', 'Rajdhani', sans-serif;
  font-size: clamp(7rem, 16vw, 12rem);
  line-height: 1;
}

.profile-v21-identity {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.profile-v21-identity h1 {
  margin: 0;
  color: #f4f6f8;
  font-family: 'Bebas Neue', 'Rajdhani', sans-serif;
  font-size: clamp(6.4rem, 14vw, 12rem);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 0.78;
  text-transform: uppercase;
}

.profile-v21-identity > strong {
  color: #f2b632;
  font-family: 'Rajdhani', sans-serif;
  font-size: clamp(2rem, 4vw, 3.6rem);
  font-weight: 900;
  line-height: 0.95;
  text-transform: uppercase;
}

.profile-v21-meta,
.profile-v21-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.profile-v21-meta span,
.profile-v21-badges span {
  border: 1px solid rgba(76, 201, 240, 0.34);
  background: rgba(18, 26, 36, 0.74);
  color: #f4f6f8;
  font-size: clamp(0.78rem, 0.9vw, 0.92rem);
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1;
  padding: 11px 13px;
  text-transform: uppercase;
}

.profile-v21-badges span:first-child {
  border-color: rgba(242, 182, 50, 0.7);
  color: #f2b632;
}

.profile-v21-quote {
  margin: 0;
  border-left: 4px solid #b2122a;
  color: #dce7ef;
  font-family: 'Rajdhani', sans-serif;
  font-size: clamp(1.4rem, 2.4vw, 2.05rem);
  font-weight: 800;
  line-height: 1.25;
  padding: 22px 0 22px 22px;
}

.profile-v21-topline {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.45fr);
  gap: 18px;
  margin-top: 20px;
}

.profile-v21-level-card,
.profile-v21-season,
.profile-v21-performance,
.profile-v21-factions,
.player-achievement-panel,
.profile-v21-rivals,
.profile-v21-activity,
.profile-v21-army-lists,
.profile-v21-notes {
  border-color: rgba(76, 201, 240, 0.24);
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(18, 26, 36, 0.94), rgba(7, 10, 14, 0.96)),
    #121a24;
}

.profile-v21-season {
  border-color: rgba(76, 201, 240, 0.38);
  box-shadow: inset 0 1px 0 rgba(76, 201, 240, 0.16);
}

.profile-v21-level-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.profile-v21-level-mark {
  display: grid;
  width: 116px;
  aspect-ratio: 1;
  place-items: center;
  clip-path: polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%);
  background: linear-gradient(180deg, rgba(76, 201, 240, 0.28), rgba(178, 18, 42, 0.24));
  color: #f4f6f8;
}

.profile-v21-level-mark span,
.profile-v21-season dt,
.profile-v21-stat-list dt,
.profile-v21-faction-list span,
.profile-v21-achievements span,
.profile-v21-rival-list span,
.profile-v21-activity-list span {
  color: #aab7c2;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.profile-v21-level-mark strong {
  display: block;
  font-size: 3.4rem;
  line-height: 0.8;
}

.profile-v21-progress {
  height: 10px;
  overflow: hidden;
  border: 1px solid rgba(76, 201, 240, 0.28);
  background: rgba(5, 6, 8, 0.72);
}

.profile-v21-progress span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #4cc9f0, #f2b632);
}

.profile-v21-level-card p {
  margin: 10px 0 0;
  color: #aab7c2;
  font-size: 0.88rem;
}

.profile-v21-season dl {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  border: 1px solid rgba(42, 59, 73, 0.9);
  background: rgba(42, 59, 73, 0.9);
}

.profile-v21-season div,
.profile-v21-stat-list div,
.profile-v21-analysis div,
.profile-v21-army-summary div,
.profile-metric-list div {
  border: 1px solid rgba(42, 59, 73, 0.82);
  background: rgba(5, 6, 8, 0.34);
  padding: 12px;
}

.profile-v21-season div {
  border: 0;
  background:
    linear-gradient(180deg, rgba(18, 26, 36, 0.82), rgba(5, 6, 8, 0.7));
  min-height: 88px;
  padding: 16px 14px;
}

.profile-v21-season dd,
.profile-v21-stat-list dd,
.profile-v21-analysis dd,
.profile-v21-army-summary dd,
.profile-metric-list dd {
  margin: 4px 0 0;
  color: #f4f6f8;
  font-weight: 900;
}

.profile-v21-season dd {
  font-family: 'Rajdhani', sans-serif;
  font-size: clamp(1.15rem, 1.45vw, 1.55rem);
  line-height: 1.08;
}

.profile-v21-shell {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr) minmax(300px, 380px);
  gap: 24px;
  align-items: start;
  margin-top: 28px;
}

.profile-v21-nav {
  position: sticky;
  top: 84px;
  display: grid;
  gap: 8px;
  border-left: 3px solid #4cc9f0;
  padding-left: 14px;
}

.profile-v21-nav a {
  color: #aab7c2;
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 11px 10px;
  text-decoration: none;
  text-transform: uppercase;
}

.profile-v21-nav a:hover,
.profile-v21-nav a:focus-visible {
  background: rgba(76, 201, 240, 0.12);
  color: #f4f6f8;
}

.profile-v21-main,
.profile-v21-aside {
  display: grid;
  gap: 24px;
}

.profile-v21-performance-grid {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.profile-v21-performance svg {
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1;
}

.profile-v21-radar-grid {
  fill: rgba(76, 201, 240, 0.04);
  stroke: rgba(76, 201, 240, 0.34);
  stroke-width: 1;
}

.profile-v21-radar-fill {
  fill: rgba(76, 201, 240, 0.28);
  stroke: #4cc9f0;
  stroke-width: 2;
}

.profile-v21-performance text {
  fill: #aab7c2;
  font-size: 10px;
  font-weight: 900;
}

.profile-v21-stat-list,
.profile-v21-analysis,
.profile-v21-army-summary,
.profile-metric-list {
  display: grid;
  gap: 10px;
  margin: 0;
}

.profile-v21-stat-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.profile-v21-analysis,
.profile-v21-army-summary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 14px;
}

.profile-v21-faction-ring {
  display: grid;
  width: min(210px, 100%);
  aspect-ratio: 1;
  place-items: center;
  margin: 4px auto 18px;
  border-radius: 999px;
  background:
    radial-gradient(circle, #121a24 0 53%, transparent 54%),
    conic-gradient(#4cc9f0 0 var(--faction-share), rgba(76, 201, 240, 0.12) var(--faction-share) 100%);
}

.profile-v21-faction-ring strong {
  color: #f4f6f8;
  font-size: 2.2rem;
  line-height: 1;
}

.profile-v21-faction-ring span {
  max-width: 130px;
  color: #aab7c2;
  font-size: 0.72rem;
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
}

.profile-v21-faction-list,
.profile-v21-achievements,
.profile-v21-rival-list,
.profile-v21-activity-list {
  display: grid;
  gap: 12px;
}

.profile-v21-faction-list div,
.profile-v21-achievements article,
.profile-v21-rival-list div,
.profile-v21-activity-list div {
  border: 1px solid rgba(42, 59, 73, 0.82);
  background: rgba(5, 6, 8, 0.36);
  padding: 12px;
}

.profile-v21-achievements {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.profile-v21-achievements article {
  position: relative;
  min-height: 148px;
  overflow: hidden;
  padding: 18px 14px 16px;
  background:
    linear-gradient(145deg, rgba(18, 26, 36, 0.92), rgba(5, 6, 8, 0.86)),
    #121a24;
}

.profile-v21-achievements article::after {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 34px;
  height: 54px;
  clip-path: polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%);
  content: '';
  background: linear-gradient(180deg, rgba(242, 182, 50, 0.82), rgba(178, 18, 42, 0.48));
  opacity: 0.28;
}

.profile-v21-achievements i {
  display: grid;
  width: 54px;
  aspect-ratio: 1;
  place-items: center;
  margin-bottom: 14px;
  clip-path: polygon(50% 0, 63% 28%, 94% 28%, 69% 47%, 79% 78%, 50% 60%, 21% 78%, 31% 47%, 6% 28%, 37% 28%);
  background: linear-gradient(180deg, rgba(242, 182, 50, 0.95), rgba(178, 18, 42, 0.68));
  box-shadow: 0 0 28px rgba(242, 182, 50, 0.16);
}

.profile-v21-faction-list strong,
.profile-v21-achievements strong,
.profile-v21-rival-list strong,
.profile-v21-activity-list strong {
  display: block;
  color: #f4f6f8;
  font-weight: 900;
}

.profile-v21-achievements strong {
  font-family: 'Rajdhani', sans-serif;
  font-size: 1.05rem;
  line-height: 1.1;
  text-transform: uppercase;
}

.profile-v21-faction-list small,
.profile-v21-achievements small,
.profile-v21-rival-list small,
.profile-v21-activity-list small {
  color: #aab7c2;
}

.profile-v21-achievements article.is-unlocked {
  border-color: rgba(242, 182, 50, 0.54);
}

.profile-v21-achievements article.is-unlocked span {
  color: #f2b632;
}

.profile-v21-army-lists .army-list-mini-grid {
  margin-top: 14px;
}

.profile-v21-notes .profile-action-link {
  margin-top: 14px;
}

@media (max-width: 1180px) {
  .profile-v21-hero-grid {
    grid-template-columns: minmax(220px, auto) minmax(0, 1fr);
  }

  .profile-v21-quote {
    grid-column: 1 / -1;
  }

  .profile-v21-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .profile-v21-nav {
    position: static;
    display: flex;
    overflow-x: auto;
    border-left: 0;
    border-bottom: 1px solid rgba(76, 201, 240, 0.24);
    padding: 0 0 10px;
  }

  .profile-v21-nav a {
    flex: 0 0 auto;
  }
}

@media (max-width: 840px) {
  .profile-v21-hero-grid,
  .profile-v21-topline,
  .profile-v21-performance-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .profile-v21-portrait {
    width: min(54vw, 260px);
  }

  .profile-v21-season dl,
  .profile-v21-stat-list,
  .profile-v21-analysis,
  .profile-v21-army-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .profile-v21-achievements {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 540px) {
  .profile-v21-hero {
    min-height: 0;
  }

  .profile-v21-hero-grid {
    gap: 22px;
    padding: 26px 22px 34px;
  }

  .profile-v21-identity h1 {
    font-size: clamp(4.6rem, 20vw, 6.2rem);
  }

  .profile-v21-identity > strong {
    font-size: clamp(1.5rem, 8vw, 2.4rem);
  }

  .profile-v21-quote {
    font-size: 1.3rem;
  }

  .profile-v21-season dl,
  .profile-v21-stat-list,
  .profile-v21-analysis,
  .profile-v21-army-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .profile-v21-level-card {
    grid-template-columns: minmax(0, 1fr);
  }
}

.player-career-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(180px, auto) minmax(220px, auto);
  gap: 22px;
  align-items: center;
}

.player-career-avatar {
  display: grid;
  width: clamp(76px, 9vw, 116px);
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--division-accent) 42%, var(--border));
  border-radius: 16px;
  background:
    radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--division-accent) 22%, transparent), transparent 48%),
    var(--panel-muted);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
}

.player-career-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-career-avatar span {
  color: var(--text);
  font-size: clamp(2rem, 5vw, 3.4rem);
  font-weight: 950;
}

.player-career-record {
  display: grid;
  gap: 6px;
  min-width: 170px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--division-accent) 36%, var(--border));
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.player-career-record span,
.player-career-record small,
.player-record-card span,
.player-record-card small,
.player-career-metric span,
.player-career-metric small {
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.player-career-record strong {
  color: var(--text);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
}

.player-career-score {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 260px;
}

.player-record-grid,
.player-career-grid,
.player-profile-main-grid {
  display: grid;
  gap: 18px;
  padding: 0 clamp(18px, 4vw, 46px) 18px;
}

.player-record-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.player-career-grid {
  grid-template-columns: 1.1fr 1.1fr 0.9fr;
}

.player-profile-main-grid {
  grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.55fr);
}

.player-record-card {
  display: grid;
  gap: 8px;
  padding: 18px;
}

.player-record-card strong {
  color: var(--text);
  font-size: clamp(1.55rem, 3vw, 2.35rem);
  line-height: 1;
}

.player-career-panel {
  display: grid;
  gap: 18px;
}

.player-career-metric-list {
  display: grid;
  gap: 12px;
}

.player-career-metric {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel-muted);
}

.player-career-metric strong {
  color: var(--text);
  font-size: 1.05rem;
}

.player-recent-games-panel,
.player-achievement-panel {
  display: grid;
  gap: 16px;
}

.player-recent-game-list {
  display: grid;
  gap: 10px;
}

.player-recent-game-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1.1fr) minmax(0, 0.9fr) auto;
  gap: 14px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  text-decoration: none;
  background: rgba(255, 255, 255, 0.035);
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    background 160ms ease;
}

.player-recent-game-row:hover,
.player-recent-game-row:focus-visible {
  border-color: color-mix(in srgb, var(--division-accent) 55%, var(--border));
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}

.player-recent-game-row div,
.player-recent-game-row strong {
  min-width: 0;
}

.player-recent-game-row small,
.player-recent-game-row span {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.player-result-chip {
  display: inline-flex;
  min-width: 52px;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.player-result-chip.win {
  background: rgba(45, 198, 83, 0.16);
  color: #79e996;
}

.player-result-chip.loss {
  background: rgba(255, 180, 67, 0.14);
  color: #ffd18a;
}

.player-achievement-placeholder,
.player-profile-empty {
  margin: 0;
  padding: 16px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  background: var(--panel-muted);
  color: var(--text-muted);
  font-weight: 800;
}

.player-achievement-placeholder {
  display: grid;
  gap: 8px;
}

.player-achievement-placeholder strong {
  color: var(--text);
}

.player-achievement-placeholder p {
  margin: 0;
}

@media (max-width: 1280px) {
  .player-career-hero {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .player-career-record,
  .player-career-score {
    min-width: 0;
  }

  .player-career-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .player-career-grid .profile-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .player-record-grid,
  .player-career-grid,
  .player-profile-main-grid {
    grid-template-columns: 1fr;
  }

  .player-recent-game-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .player-recent-game-row > strong {
    justify-self: start;
  }
}

@media (max-width: 640px) {
  .player-career-hero {
    grid-template-columns: 1fr;
  }

  .player-career-avatar {
    width: 82px;
  }

  .player-career-score {
    grid-template-columns: 1fr;
  }

  .player-record-grid,
  .player-career-grid,
  .player-profile-main-grid {
    padding-left: 14px;
    padding-right: 14px;
  }
}
`

export default PlayerProfile
