import { useEffect, useState, type ReactNode } from 'react'
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
  const movementStatus = getMovementStatus(player)
  const displayName = formatPlayerName(player.name, player.displayName)
  const currentTournament = getCurrentTournamentLabel(player)
  const classifications = getProfileClassifications(player, career)

  return (
    <>
      <PlayerProfileStyles />
      <main className="portal-shell">
        <section
          className="player-career-hero profile-hero-focus"
          style={getDivisionStyle(player.division)}
          aria-labelledby="player-title"
        >
        <div className="player-career-avatar" aria-hidden="true">
          {player.profilePicture ? (
            <img alt="" src={player.profilePicture} />
          ) : (
            <span>{displayName.slice(0, 1)}</span>
          )}
        </div>

        <div className="profile-hero-main">
          <p className="eyebrow">Infinity Career</p>
          <h1 id="player-title">{displayName}</h1>
          <div className="profile-badges" aria-label="Player league status">
            <span className="division-badge">
              {formatDivisionLabel(player.division)}
            </span>
            <span>Rank #{player.rank || '--'}</span>
            {movementStatus ? (
              <span className={movementStatus.className}>
                {movementStatus.label}
              </span>
            ) : null}
            {classifications.map((classification) => (
              <span key={classification}>{classification}</span>
            ))}
            <span>{career.totalGames} Lifetime Games</span>
          </div>
          <p>
            {displayName} has played {career.totalGames} recorded games across
            the portal with a {formatPercent(career.winPercentage)} win rate.
          </p>
        </div>

        <div className="player-career-record" aria-label="Lifetime record">
          <span>Lifetime Record</span>
          <strong>{formatRecord(career.records.overall)}</strong>
          <small>{formatPercent(career.winPercentage)} wins</small>
        </div>

        <dl className="profile-hero-score player-career-score" aria-label="Career summary">
          <div>
            <dt>Current League</dt>
            <dd>{formatDivisionLabel(player.division) || 'Not linked'}</dd>
          </div>
          <div>
            <dt>Current Tournament</dt>
            <dd>{currentTournament}</dd>
          </div>
          <div>
            <dt>Current Streak</dt>
            <dd>{career.currentWinStreak} Wins</dd>
          </div>
          <div>
            <dt>Longest Streak</dt>
            <dd>{career.longestWinStreak} Wins</dd>
          </div>
        </dl>
      </section>

      <section className="player-record-grid" aria-label="Record summary">
        <RecordCard label="Overall" record={career.records.overall} />
        <RecordCard label="League" record={career.records.league} />
        <RecordCard label="Tournament" record={career.records.tournament} />
        <RecordCard label="Casual" record={career.records.casual} />
      </section>

      <section className="player-career-grid" aria-label="Army and mission summary">
        <CareerMetricGroup
          showParentFaction
          title="Army Summary"
          metrics={[
            ['Favorite Army', career.armies.favorite],
            ['Best Army', career.armies.best],
            ['Most Recent Army', career.armies.mostRecent],
          ]}
        />
        <CareerMetricGroup
          title="Mission Summary"
          metrics={[
            ['Favorite Mission', career.missions.favorite],
            ['Best Mission', career.missions.best],
            ['Most Recent Mission', career.missions.mostRecent],
          ]}
        />
        <QuickStatsCard career={career} player={player} />
      </section>

      <section className="player-profile-main-grid" aria-label="Career activity">
        <RecentGamesPanel games={recentGames} player={player} />
        <AchievementPreview />
      </section>

      <section className="profile-card-grid" aria-label="Player details">
        <ProfileCard title="Scheduling">
          <Metric
            label="Availability"
            value={player.availability.status || 'No availability added yet.'}
          />
          <Metric label="Preferred Days" value={player.availability.preferredDays} />
          <Metric
            label="Preferred Time Window"
            value={player.availability.preferredTimes}
          />
          <Metric label="Discord" value={player.discordHandle} />
          <Link
            className="profile-action-link"
            to={player.scheduleLink || `/match-finder?opponent=${encodeURIComponent(player.name)}`}
          >
            Schedule Match
          </Link>
        </ProfileCard>

        <ProfileCard title="Turn Profile">
          <Metric label="First Turn Win Rate" value={formatPercent(player.firstTurnWinRate)} />
          <Metric label="Second Turn Win Rate" value={formatPercent(player.secondTurnWinRate)} />
          <Metric label="First Turn Games" value={player.firstTurnGames} />
          <Metric label="Second Turn Games" value={player.secondTurnGames} />
        </ProfileCard>

        <ProfileCard title="Registered Events">
          {player.registeredEvents.length === 0 ? (
            <Metric label="Events" value="No event registrations yet." />
          ) : (
            player.registeredEvents.slice(0, 4).map((event) => (
              <Metric
                key={event.eventId}
                label={event.eventName}
                value={
                  event.preferredTeam || event.team
                    ? `${event.status} - ${event.preferredTeam || event.team}`
                    : event.status
                }
              />
            ))
          )}
        </ProfileCard>
      </section>

      <section className="profile-card-grid" aria-label="Player army lists">
        <ProfileCard title="Submitted Army Lists">
          <Metric label="Lists Submitted" value={player.armyListSummary.submitted} />
          <Metric
            label="Average List Rating"
            value={player.armyListSummary.averageRating}
          />
          <Metric
            label="Favorite Faction"
            value={player.armyListSummary.favoriteFaction || player.favoriteFaction}
          />
        </ProfileCard>
        <ArmyListSummaryCard
          list={player.armyListSummary.highestRated}
          title="Highest Rated List"
        />
        <ArmyListSummaryCard list={player.armyListSummary.newest} title="Newest List" />
      </section>

      {player.armyLists.length > 0 ? (
        <section className="panel faction-report-panel profile-army-list-panel">
          <div className="panel-heading">
            <p className="eyebrow">Community</p>
            <h2>Player Army Lists</h2>
          </div>
          <div className="army-list-mini-grid">
            {player.armyLists.map((list) => (
              <ArmyListMiniCard key={list.id} list={list} />
            ))}
          </div>
        </section>
      ) : null}

        <EntityPreviousNext current={player.name} eventId={eventId} type="player" />
      </main>
    </>
  )
}

function PlayerProfileStyles() {
  return <style>{playerProfileStyles}</style>
}

function RecordCard({
  label,
  record,
}: {
  label: string
  record: PlayerRecordSummary
}) {
  return (
    <article className="panel player-record-card">
      <span>{label}</span>
      <strong>{formatRecord(record)}</strong>
      <small>
        {record.games} games / {formatPercent(record.winPercentage)}
      </small>
    </article>
  )
}

function CareerMetricGroup({
  metrics,
  showParentFaction = false,
  title,
}: {
  metrics: Array<[string, PlayerCareerMetric]>
  showParentFaction?: boolean
  title: string
}) {
  return (
    <section className="panel player-career-panel" aria-labelledby={titleToId(title)}>
      <div className="panel-heading">
        <p className="eyebrow">Career</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <div className="player-career-metric-list">
        {metrics.map(([label, metric]) => (
          <CareerMetricCard
            key={label}
            label={label}
            metric={metric}
            showParentFaction={showParentFaction}
          />
        ))}
      </div>
    </section>
  )
}

function CareerMetricCard({
  label,
  metric,
  showParentFaction,
}: {
  label: string
  metric: PlayerCareerMetric
  showParentFaction: boolean
}) {
  const value = metric.insufficientGames
    ? 'Requires 3 games'
    : formatMissionMetric(metric.label) || 'Not recorded'
  const parentFaction =
    showParentFaction && value !== 'Not recorded' && !metric.insufficientGames
      ? metric.parentFaction || getArmyParentFaction(metric.label)
      : ''

  return (
    <article className="player-career-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {parentFaction && parentFaction !== metric.label ? (
        <small>Parent Faction: {parentFaction}</small>
      ) : null}
      <small>
        {metric.insufficientGames
          ? 'Minimum sample not reached'
          : `${formatRecord(metric)} / ${formatPercent(metric.winPercentage)}`}
      </small>
    </article>
  )
}

function QuickStatsCard({
  career,
  player,
}: {
  career: PlayerCareerSummary
  player: PlayerProfileData
}) {
  return (
    <ProfileCard title="Quick Statistics">
      <Metric
        label="Most Played Army"
        value={career.quickStats.mostPlayedArmy || player.favoriteFaction}
      />
      <Metric
        label="Most Played Parent Faction"
        value={
          career.quickStats.mostPlayedArmyParentFaction ||
          getArmyParentFaction(career.quickStats.mostPlayedArmy || player.favoriteFaction)
        }
      />
      <Metric
        label="Most Played Mission"
        value={formatMissionMetric(career.quickStats.mostPlayedMission)}
      />
      <Metric label="Highest VP Game" value={career.quickStats.highestVpGame} />
      <Metric label="Biggest Victory" value={`${career.quickStats.biggestVictory} VP`} />
      <Metric label="Longest Win Streak" value={career.longestWinStreak} />
      <Metric label="Games This Month" value={career.gamesThisMonth} />
    </ProfileCard>
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

function AchievementPreview() {
  return (
    <section className="panel player-achievement-panel" aria-labelledby="achievements-title">
      <div className="panel-heading">
        <p className="eyebrow">Achievements</p>
        <h2 id="achievements-title">Achievement Preview</h2>
      </div>
      <div className="player-achievement-placeholder">
        <strong>Achievements coming soon.</strong>
        <p>Recent badges and next-progress goals will appear here when public achievements are available for player profiles.</p>
      </div>
    </section>
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
          <Metric label="Mission" value={getCanonicalMissionName(list.mission)} />
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

function titleToId(title: string) {
  return title.toLowerCase().replaceAll(' ', '-')
}

const playerProfileStyles = `
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
