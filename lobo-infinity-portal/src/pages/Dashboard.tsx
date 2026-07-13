import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import Skeleton from '../components/Skeleton'
import {
  type ArmyListCommunitySummary,
  type CommissionerNewsItem,
  type HallOfFameData,
  type LeagueIntelligenceData,
  type LeagueRecordValue,
  type RecentGame,
  type StreamedGame,
} from '../services/api'
import type { DivisionStandings, Standing } from '../types/dashboard'
import {
  formatObjectiveScore,
  formatPlayerName,
} from '../services/formatting'
import { getGameHeadline, isDrawGame } from '../services/gameResults'
import dashboardConcept from '../../docs/design/Dashboard/docs/dashboard-concept-v2.1.png'
import loboCrest from '../assets/lobo-crest.svg'
import {
  DashboardDataProvider,
  useDashboardDataContext,
} from '../contexts/DashboardDataContext'
import '../App.css'
import './Dashboard.css'

function Dashboard() {
  const auth = useAuth()
  const lastUpdated = new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <DashboardDataProvider
      authenticated={auth.authenticated}
      communityCacheKey={auth.user.email || auth.user.leaguePlayer || 'guest'}
    >
      <DashboardContent auth={auth} lastUpdated={lastUpdated} />
    </DashboardDataProvider>
  )
}

function DashboardContent({
  auth,
  lastUpdated,
}: {
  auth: ReturnType<typeof useAuth>
  lastUpdated: string
}) {
  const {
    home,
    homeStatus,
    homeError,
  } = useDashboardDataContext()

  if (homeStatus === 'loading') {
    return (
      <main className="portal-shell">
        <DashboardHeader lastUpdated={lastUpdated} />
        <section className="league-command-hero" aria-label="League command center">
          <div>
            <p className="eyebrow">League Command Center</p>
            <h1>Lobo Infinity Portal 2.0</h1>
            <p>
              Live standings, battle reports, records, meta pressure, and league
              movement from Google Sheets.
            </p>
          </div>
          <QuickNavigation />
        </section>
        <div className="portal-grid">
          <Skeleton label="Dashboard loading" rows={8} />
          <section className="dashboard-state" aria-label="Dashboard loading">
            <Loading />
          </section>
        </div>
      </main>
    )
  }

  if (homeStatus === 'error') {
    return (
      <main className="portal-shell">
        <DashboardHeader lastUpdated={lastUpdated} />
        <section className="dashboard-state" aria-label="Dashboard error">
          <p role="alert">{homeError}</p>
        </section>
      </main>
    )
  }

  const homeData = home!
  const data = homeData.dashboard
  const games = homeData.recentGames
  const news = homeData.news
  const records = homeData.records
  const hallOfFame = homeData.hallOfFame
  const intelligence = homeData.intelligence
  const armyListCommunity = homeData.armyListCommunity
  const featuredGame = games[0]
  const mostPlayedMission =
    intelligence?.records.mostActiveMission &&
    !('winner' in intelligence.records.mostActiveMission)
      ? intelligence.records.mostActiveMission.name
      : ''
  const currentLeader = data.standings[0] ?? null
  const currentPlayerContext = findCurrentPlayerStanding(
    homeData.allStandings,
    auth.user.leaguePlayer,
  )
  const currentPlayerStanding = currentPlayerContext?.standing ?? null
  const currentPlayerDivision = currentPlayerContext?.division ?? null
  const scheduledLeagueGames = getScheduledLeagueGames(homeData.allStandings)
  const completedLeagueGames =
    data.leagueOverview.totalLeagueGames || data.summary.gamesPlayed
  const requiredLeagueGames = Math.max(scheduledLeagueGames, completedLeagueGames)
  const seasonProgress =
    requiredLeagueGames > 0
      ? Math.min(100, Math.round((completedLeagueGames / requiredLeagueGames) * 100))
      : 0
  const hasAuthenticatedPlayer = auth.authenticated && Boolean(auth.user.leaguePlayer)
  const rankMeta = currentPlayerStanding
    ? `${currentPlayerStanding.division || currentPlayerDivision?.divisionLabel || 'Current'} Division`
    : hasAuthenticatedPlayer
      ? 'Rank unavailable'
      : 'Sign in to view your rank'
  const divisionMeta = currentPlayerDivision
    ? `${currentPlayerDivision.summary.players} players`
    : hasAuthenticatedPlayer
      ? 'Division unavailable'
      : 'Sign in for player division'
  const divisionValue =
    currentPlayerStanding?.division || currentPlayerDivision?.divisionLabel || 'N/A'

  return (
    <main className="portal-shell dashboard-facelift">
      <section className="dashboard-command-hero" aria-label="Lobo command network">
        <img
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="lazy"
          src={dashboardConcept}
        />
        <div className="dashboard-command-overlay">
          <img
            alt="Lobo Infinity League"
            className="dashboard-command-logo"
            decoding="async"
            loading="lazy"
            src={loboCrest}
          />
          <p className="eyebrow">Lobo Command Network</p>
          <h1>Lobo Command Network</h1>
          <p>
            {formatSeasonLabel(homeData.settings.currentSeason)} operations synchronized.
            Standings, battle reports, transmissions, and command status are live.
          </p>
          <div className="dashboard-command-status" aria-label="Operational status">
            <span>Operational</span>
            <span>{formatSeasonLabel(homeData.settings.currentSeason)}</span>
            <span>Updated {lastUpdated}</span>
          </div>
        </div>
      </section>

      <section className="dashboard-status-grid" aria-label="Dashboard summary">
        <DashboardStatusTile
          accent="success"
          icon="STA"
          label="Season Status"
          meta={formatSeasonLabel(homeData.settings.currentSeason)}
          value="Operational"
        />
        <DashboardStatusTile
          accent="cyan"
          icon="PRG"
          label="Season Progress"
          meta={`${completedLeagueGames} of ${requiredLeagueGames} games completed`}
          value={`${seasonProgress}%`}
        />
        <DashboardStatusTile
          accent="amber"
          icon="RPT"
          label="Recent Reports"
          meta="Submitted battle reports"
          value={homeData.quickStats.recentGames}
        />
        <DashboardStatusTile
          accent="cyan"
          icon="STR"
          label="Streamed Reports"
          meta={homeData.quickStats.streams > 0 ? 'Archived battle reports' : 'No streamed reports'}
          value={homeData.quickStats.streams}
        />
        <DashboardStatusTile
          accent="red"
          icon="RANK"
          label="Your Rank"
          meta={rankMeta}
          value={currentPlayerStanding ? `#${currentPlayerStanding.rank}` : 'N/A'}
        />
        <DashboardStatusTile
          accent="cyan"
          icon="DIV"
          label="Your Division"
          meta={divisionMeta}
          value={divisionValue}
        />
      </section>

      <section className="dashboard-ops-grid" aria-label="Command operations">
        <LiveTransmissions games={games} news={news} />
        <CommanderOverview intelligence={intelligence} leader={currentLeader} leaderName={data.summary.leagueLeader} />
        <WeeklyOperations
          featuredGame={featuredGame}
          intelligence={intelligence}
          mostPlayedMission={mostPlayedMission || featuredGame?.mission || ''}
        />
        <CommunityIntelligence
          armyListCommunity={armyListCommunity}
          hallOfFame={hallOfFame}
          intelligence={intelligence}
          records={records}
          streams={homeData.streams}
        />
      </section>

      <footer className="dashboard-footer">
        <span>Powered by</span>
        <strong>Lobo Infinity League API</strong>
      </footer>
    </main>
  )
}

function DashboardStatusTile({
  accent,
  icon,
  label,
  meta,
  value,
}: {
  accent: 'amber' | 'cyan' | 'red' | 'success' | 'violet'
  icon: string
  label: string
  meta: string
  value: number | string
}) {
  return (
    <article className={`dashboard-status-tile ${accent}`}>
      <span aria-hidden="true">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{meta}</small>
      </div>
    </article>
  )
}

function findCurrentPlayerStanding(
  divisions: DivisionStandings[],
  playerIdentity: string,
) {
  const normalizedIdentity = normalizeIdentity(playerIdentity)

  if (!normalizedIdentity) {
    return null
  }

  for (const division of divisions) {
    const standing = division.standings.find((row) => {
      const player = normalizeIdentity(row.player)
      const displayName = normalizeIdentity(row.displayName)

      return player === normalizedIdentity || displayName === normalizedIdentity
    })

    if (standing) {
      return { division, standing }
    }
  }

  return null
}

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase()
}

function getScheduledLeagueGames(divisions: DivisionStandings[]) {
  return divisions.reduce((total, division) => {
    const playerCount = division.summary.players || division.standings.length

    return total + (playerCount * Math.max(0, playerCount - 1)) / 2
  }, 0)
}

function formatSeasonLabel(season: string) {
  return season.trim() || 'Season synchronized'
}

function LiveTransmissions({
  games,
  news,
}: {
  games: RecentGame[]
  news: CommissionerNewsItem[]
}) {
  const transmissions = [
    ...games.slice(0, 4).map((game) => {
      const isDraw = isDrawGame(game)

      return {
        action: 'View Report',
        detail: `${formatMissionLabel(game.mission)} - ${isDraw ? 'draw' : 'defeated'} - ${formatObjectiveScore(game)}`,
        label: 'Combat Report Received',
        time: game.date,
        title: getGameHeadline(game),
        to: `/games/${game.id}`,
        tone: 'red',
      }
    }),
    ...news.slice(0, 2).map((item) => ({
      action: 'View Details',
      detail: item.body,
      label: 'Mission Rotation Updated',
      time: item.date || 'Live',
      title: item.title,
      to: item.link || '/news',
      tone: 'cyan',
    })),
  ].slice(0, 5)

  return (
    <section className="panel dashboard-transmissions" aria-labelledby="transmissions-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Live Transmissions</p>
          <h2 id="transmissions-title">Live Transmissions</h2>
        </div>
        <Link to="/timeline">View All</Link>
      </div>
      <div className="dashboard-transmission-list">
        {transmissions.map((item) => (
          <Link
            className={`dashboard-transmission ${item.tone}`}
            key={`${item.label}-${item.title}`}
            to={item.to}
          >
            <span aria-hidden="true">SIGNAL</span>
            <div>
              <small>{item.label}</small>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            <time>{item.time}</time>
            <b>{item.action}</b>
          </Link>
        ))}
      </div>
    </section>
  )
}

function WeeklyOperations({
  featuredGame,
  intelligence,
  mostPlayedMission,
}: {
  featuredGame?: RecentGame
  intelligence: LeagueIntelligenceData | null
  mostPlayedMission: string
}) {
  const missionTrend = intelligence?.missionTrends[0]
  const secondTrend = intelligence?.missionTrends[1]

  return (
    <section className="panel dashboard-weekly-ops" aria-labelledby="weekly-ops-title">
      <div className="panel-heading">
        <p className="eyebrow">This Week's Operations</p>
        <h2 id="weekly-ops-title">This Week's Operations</h2>
      </div>
      <div className="dashboard-operation-list">
        <DashboardOperation
          label="Mission Alpha"
          mission={missionTrend?.mission || featuredGame?.mission || mostPlayedMission}
          notes={missionTrend?.story || 'Mission briefing pending from current dashboard activity.'}
          to={missionTrend?.mission ? `/missions/${encodeURIComponent(missionTrend.mission)}` : '/missions'}
        />
        <DashboardOperation
          label="Mission Bravo"
          mission={secondTrend?.mission || mostPlayedMission}
          notes={secondTrend?.story || 'Secondary mission signal pending from current dashboard activity.'}
          to={secondTrend?.mission ? `/missions/${encodeURIComponent(secondTrend.mission)}` : '/missions'}
        />
      </div>
      <Link className="dashboard-operation-action" to="/missions">View All Missions</Link>
    </section>
  )
}

function DashboardOperation({
  label,
  mission,
  notes,
  to,
}: {
  label: string
  mission: string
  notes: string
  to: string
}) {
  return (
    <Link className="dashboard-operation" to={to}>
      <span>{label}</span>
      <strong>{formatMissionLabel(mission)}</strong>
      <p>{notes}</p>
    </Link>
  )
}

function CommanderOverview({
  intelligence,
  leader,
  leaderName,
}: {
  intelligence: LeagueIntelligenceData | null
  leader: Standing | null
  leaderName: string
}) {
  const name = leader ? formatPlayerName(leader.player, leader.displayName) : leaderName
  const profilePath = leader ? `/players/${encodeURIComponent(leader.player)}` : '/standings'
  const leaderStreak = leader
    ? intelligence?.winStreaks.find((streak) => streak.player === leader.player)
    : null

  return (
    <section className="panel dashboard-commander" aria-labelledby="commander-title">
      <div className="panel-heading">
        <p className="eyebrow">Commander Overview</p>
        <h2 id="commander-title">Commander Overview</h2>
      </div>
      <div className="dashboard-commander-body">
        <img alt="" aria-hidden="true" decoding="async" loading="lazy" src={loboCrest} />
        <div>
          <span>Current Leader</span>
          <strong>{name}</strong>
          <small>Main Man Division</small>
        </div>
        <dl>
          <div>
            <dt>W - L - D</dt>
            <dd>{leader ? `${leader.wins} - ${leader.losses} - ${leader.draws}` : 'N/A'}</dd>
          </div>
          <div>
            <dt>Tournament Points</dt>
            <dd>{leader ? `${leader.tp} TP` : 'N/A'}</dd>
          </div>
          <div>
            <dt>Objective Points</dt>
            <dd>{leader ? `${leader.op} OP` : 'N/A'}</dd>
          </div>
          <div>
            <dt>Win Streak</dt>
            <dd>{leaderStreak ? `${leaderStreak.games} wins` : `${leader?.currentWinStreak ?? 0} wins`}</dd>
          </div>
          <div>
            <dt>Favorite Army</dt>
            <dd>{leader?.faction || leader?.favoriteArmy || 'Faction pending'}</dd>
          </div>
        </dl>
        <Link to={profilePath}>View Profile</Link>
      </div>
    </section>
  )
}

function CommunityIntelligence({
  armyListCommunity,
  hallOfFame,
  intelligence,
  records,
  streams,
}: {
  armyListCommunity: ArmyListCommunitySummary
  hallOfFame: HallOfFameData | null
  intelligence: LeagueIntelligenceData | null
  records: Record<string, LeagueRecordValue>
  streams: StreamedGame[]
}) {
  const activePlayer = records.mostActivePlayer
  const activePlayerName =
    activePlayer && !('winner' in activePlayer)
      ? activePlayer.displayName || activePlayer.name || ''
      : ''
  const mostPlayedMission = intelligence?.missionTrends[0]
  const featuredStream = streams.find((stream) => stream.active || stream.featured) ?? streams[0]
  const latestAchievement =
    hallOfFame?.leagueHistory.find((item) =>
      item.type.toLowerCase().includes('achievement'),
    ) ?? hallOfFame?.leagueHistory[0]

  const items = [
    {
      detail:
        activePlayer && !('winner' in activePlayer)
          ? `${activePlayer.games} games played`
          : 'Live data pending',
      label: 'Most Active Player',
      title: activePlayerName || 'Live data pending',
      to:
        activePlayer && !('winner' in activePlayer) && activePlayer.name
          ? `/players/${encodeURIComponent(activePlayer.name)}`
          : '/standings',
      tone: 'success',
    },
    {
      detail: armyListCommunity.mostPopularFaction
        ? 'Army list community signal'
        : 'Live data pending',
      label: 'Most Played Army',
      title: armyListCommunity.mostPopularFaction || 'Live data pending',
      to: armyListCommunity.mostPopularFaction
        ? `/factions/${encodeURIComponent(armyListCommunity.mostPopularFaction)}`
        : '/factions',
      tone: 'cyan',
    },
    {
      detail: mostPlayedMission ? `${mostPlayedMission.games} games tracked` : 'Live data pending',
      label: 'Most Played Mission',
      title: mostPlayedMission?.mission || 'Live data pending',
      to: mostPlayedMission?.mission
        ? `/missions/${encodeURIComponent(mostPlayedMission.mission)}`
        : '/missions',
      tone: 'amber',
    },
    {
      detail: featuredStream
        ? featuredStream.active
          ? 'Streamed report'
          : featuredStream.platform || 'Stream archive'
        : 'No streamed reports',
      label: 'Featured Stream',
      title: featuredStream?.streamer || featuredStream?.title || 'No Streamed Reports',
      to: featuredStream?.youtubeUrl || '/streams',
      tone: 'violet',
    },
    {
      detail: latestAchievement?.relatedPlayer || latestAchievement?.timestamp || 'Live data pending',
      label: 'Latest Achievement',
      title: latestAchievement?.title || 'Live data pending',
      to: latestAchievement?.relatedPlayer
        ? `/players/${encodeURIComponent(latestAchievement.relatedPlayer)}`
        : '/hall-of-fame',
      tone: 'amber',
    },
  ]

  return (
    <section className="panel dashboard-community-intel" aria-labelledby="community-intel-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Community Intelligence</p>
          <h2 id="community-intel-title">Community Intelligence</h2>
        </div>
        <Link to="/community">View Hub</Link>
      </div>
      <div className="dashboard-community-intel-list">
        {items.map((item) => (
          <Link className={`dashboard-community-intel-item ${item.tone}`} key={item.label} to={item.to}>
            <span aria-hidden="true">{item.label.slice(0, 3)}</span>
            <div>
              <small>{item.label}</small>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function QuickNavigation() {
  const links = [
    ['Standings', '/standings'],
    ['Match Finder', '/match-finder'],
    ['Rivalries', '/rivalries'],
    ['Players', '/players'],
    ['Factions', '/factions'],
    ['Missions', '/missions'],
    ['Intelligence', '/intelligence'],
    ['Hall of Fame', '/hall-of-fame'],
    ['Compare', '/compare'],
  ] as const

  return (
    <nav className="quick-nav" aria-label="Dashboard quick navigation">
      {links.map(([label, to]) => (
        <Link key={to} to={to}>
          {label}
        </Link>
      ))}
    </nav>
  )
}

function DashboardHeader({ lastUpdated }: { lastUpdated: string }) {
  return (
    <section className="dashboard-header" aria-labelledby="dashboard-title">
      <div>
        <p className="eyebrow">Dashboard</p>
        <h1 id="dashboard-title">Live League Status</h1>
      </div>
      <p>Last Updated: {lastUpdated}</p>
    </section>
  )
}

function formatMissionLabel(mission: string) {
  return mission || 'Mission not recorded'
}

export default Dashboard
