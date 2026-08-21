import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import DiscordCommunityLink from '../components/DiscordCommunityLink'
import Loading from '../components/Loading'
import PortalIcon from '../components/PortalIcon'
import PrimaryFactionCard from '../components/PrimaryFactionCard'
import Skeleton from '../components/Skeleton'
import {
  type ArmyListCommunitySummary,
  type HallOfFameData,
  type LeagueIntelligenceData,
  type LeagueRecordValue,
  type RecentGame,
  type StreamedGame,
} from '../services/api'
import type { DashboardDeferredKey } from '../contexts/DashboardDataContext'
import type { LeagueOverview, Standing } from '../types/dashboard'
import {
  formatObjectiveScore,
  formatPlayerName,
} from '../services/formatting'
import { getGameHeadline, isDrawGame } from '../services/gameResults'
import { resolvePlayerLeagueModel } from '../services/playerLeagueModel'
import loboCrest from '../assets/lobo-crest.svg'
import {
  DashboardDataProvider,
  useDashboardDataContext,
} from '../contexts/DashboardDataContext'
import { useSettings } from '../contexts/SettingsContext'
import { getDiscordCommunityLink } from '../config/communityLinks'
import '../App.css'
import './Dashboard.css'

const dashboardHero = '/dashboard/dashboard-hero.webp'
const deferredObserverDelayMs = 3200
const deferredObserverRootMargin = '80px 0px'

preloadDashboardHero()

function Dashboard() {
  const auth = useAuth()
  const lastUpdated = new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <DashboardDataProvider
      authenticated={auth.authenticated}
      communityCacheKey={auth.user.email || auth.user.canonicalPlayer || auth.user.leaguePlayer || 'guest'}
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
  const homeData = home
  const data = homeData?.dashboard
  const currentSeason = homeData?.settings.currentSeason || ''

  if (homeStatus === 'loading') {
    return (
      <main className="portal-shell dashboard-facelift">
        <DashboardCommandHero currentSeason={currentSeason} lastUpdated={lastUpdated} />
        <DashboardLoadingContent />
      </main>
    )
  }

  if (homeStatus === 'error') {
    return (
      <main className="portal-shell dashboard-facelift">
        <DashboardCommandHero currentSeason={currentSeason} lastUpdated={lastUpdated} />
        <section className="dashboard-state" aria-label="Dashboard error">
          <p role="alert">{homeError}</p>
        </section>
      </main>
    )
  }

  if (!homeData || !data) {
    return null
  }

  const games = homeData.recentGames
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
  const authenticatedCanonicalPlayer = auth.user.canonicalPlayer || auth.user.leaguePlayer
  const currentPlayerModel = resolvePlayerLeagueModel(
    homeData.allStandings,
    [authenticatedCanonicalPlayer],
  )
  const scheduledLeagueGames = getScheduledLeagueGamesFromOverview(data.leagueOverview)
  const completedLeagueGames =
    data.leagueOverview.totalLeagueGames || data.summary.gamesPlayed
  const requiredLeagueGames = Math.max(scheduledLeagueGames, completedLeagueGames)
  const seasonProgress =
    requiredLeagueGames > 0
      ? Math.min(100, Math.round((completedLeagueGames / requiredLeagueGames) * 100))
      : 0
  const hasAuthenticatedPlayer = auth.authenticated && Boolean(authenticatedCanonicalPlayer)
  const rankMeta = currentPlayerModel
    ? `${currentPlayerModel.division} Division`
    : hasAuthenticatedPlayer
      ? 'Rank unavailable'
      : 'Sign in to view your rank'
  const divisionMeta = currentPlayerModel
    ? `${currentPlayerModel.divisionPopulation} players`
    : hasAuthenticatedPlayer
      ? 'Division unavailable'
      : 'Sign in for player division'
  const divisionValue = currentPlayerModel?.division || 'N/A'

  return (
    <main className="portal-shell dashboard-facelift">
      <DashboardCommandHero currentSeason={currentSeason} lastUpdated={lastUpdated} />

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
          value={currentPlayerModel ? `#${currentPlayerModel.rank}` : 'N/A'}
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
        <LiveTransmissions games={games} />
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
        <DiscordDashboardCard />
      </section>

      <footer className="dashboard-footer">
        <span>Powered by</span>
        <strong>Lobo Infinity League API</strong>
      </footer>
    </main>
  )
}

function DashboardLoadingContent() {
  const placeholders = [
    ['STA', 'Season Status'],
    ['PRG', 'Season Progress'],
    ['RPT', 'Recent Reports'],
    ['STR', 'Streamed Reports'],
    ['RANK', 'Your Rank'],
    ['DIV', 'Your Division'],
  ] as const

  return (
    <div className="dashboard-loading-content" aria-busy="true">
      <section className="dashboard-status-grid" aria-label="Dashboard summary loading">
        {placeholders.map(([icon, label]) => (
          <DashboardStatusTile
            accent="cyan"
            icon={icon}
            key={label}
            label={label}
            meta="Synchronizing"
            value="..."
          />
        ))}
      </section>
      <div className="dashboard-initial-state">
        <Skeleton label="Dashboard loading" rows={4} />
        <section className="dashboard-state" aria-label="Dashboard loading">
          <Loading />
        </section>
      </div>
    </div>
  )
}

function DashboardCommandHero({
  currentSeason,
  lastUpdated,
}: {
  currentSeason: string
  lastUpdated: string
}) {
  const seasonLabel = formatSeasonLabel(currentSeason)

  return (
    <section className="dashboard-command-hero" aria-label="Lobo command network">
      <img
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
        height={1024}
        src={dashboardHero}
        width={1536}
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
          {seasonLabel} operations synchronized.
          Standings, battle reports, transmissions, and command status are live.
        </p>
        <div className="dashboard-command-status" aria-label="Operational status">
          <span>Operational</span>
          <span>{seasonLabel}</span>
          <span>Updated {lastUpdated}</span>
        </div>
      </div>
    </section>
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

function DiscordDashboardCard() {
  const { settings } = useSettings()
  const discord = getDiscordCommunityLink(settings)

  if (!discord) {
    return null
  }

  const communityBenefits = [
    'Find league, casual, and Team Tournament opponents.',
    'Coordinate games and schedules.',
    'Receive league news and event announcements.',
    'Share army lists, tactics, and painting projects.',
    'Ask rules questions and discuss Infinity strategy.',
    'Meet new players and grow the community.',
  ]

  return (
    <section className="panel dashboard-community-card" aria-labelledby="dashboard-discord-title">
      <div className="dashboard-community-card-header">
        <div className="dashboard-discord-icon" aria-hidden="true">
          <PortalIcon name="discord" />
        </div>
        <div>
          <p className="eyebrow">Community Headquarters</p>
          <h2 id="dashboard-discord-title">Join the Lobo Infinity League Discord</h2>
          <p>Your headquarters for everything happening in the league.</p>
        </div>
      </div>
      <div className="dashboard-community-card-body">
        <p>Join the community to:</p>
        <ul>
          {communityBenefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </div>
      <DiscordCommunityLink className="dashboard-discord-action">
        Join the Discord
      </DiscordCommunityLink>
    </section>
  )
}

function formatSeasonLabel(season: string) {
  return season.trim() || 'Season synchronized'
}

function LiveTransmissions({
  games,
}: {
  games: RecentGame[]
}) {
  const ref = useDashboardDeferredOnDemand(['recentGames'])
  const transmissions = [
    ...games.slice(0, 4).map((game) => {
      const isDraw = isDrawGame(game)

      return {
        action: 'View Report',
        detail: `${formatMissionLabel(game.mission)} - ${isDraw ? 'draw' : 'defeated'} - ${formatObjectiveScore(game)}`,
        label: `${formatTransmissionGameType(game.gameType)} · Combat Report Received`,
        time: game.date,
        title: getGameHeadline(game),
        to: `/games/${game.id}`,
        tone: 'red',
      }
    }),
  ].slice(0, 5)

  return (
    <section ref={ref} className="panel dashboard-transmissions" aria-labelledby="transmissions-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Live Transmissions</p>
          <h2 id="transmissions-title">Live Transmissions</h2>
        </div>
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

function formatTransmissionGameType(gameType?: string) {
  switch ((gameType || 'league').trim().toLowerCase()) {
    case 'casual':
      return 'Casual'
    case 'tournament':
    case 'team tournament':
    case 'team-tournament':
      return 'Team Tournament'
    default:
      return 'League'
  }
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
  const ref = useDashboardDeferredOnDemand(['recentGames', 'intelligence'])
  const missionTrend = intelligence?.missionTrends[0]
  const secondTrend = intelligence?.missionTrends[1]

  return (
    <section ref={ref} className="panel dashboard-weekly-ops" aria-labelledby="weekly-ops-title">
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
  const ref = useDashboardDeferredOnDemand(['intelligence'])
  const name = leader ? formatPlayerName(leader.player, leader.displayName) : leaderName
  const profilePath = leader ? `/players/${encodeURIComponent(leader.player)}` : '/standings'
  const leaderStreak = leader
    ? intelligence?.winStreaks.find((streak) => streak.player === leader.player)
    : null

  return (
    <section ref={ref} className="panel dashboard-commander" aria-labelledby="commander-title">
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
          <PrimaryFactionCard faction={leader?.faction || leader?.favoriteArmy} />
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
  const ref = useDashboardDeferredOnDemand([
    'armyLists',
    'hallOfFame',
    'intelligence',
    'records',
    'streams',
  ])
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
    <section ref={ref} className="panel dashboard-community-intel" aria-labelledby="community-intel-title">
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

function getScheduledLeagueGamesFromOverview(overview: LeagueOverview) {
  return overview.divisions.reduce((total, division) => {
    const playerCount = division.players || 0

    return total + (playerCount * Math.max(0, playerCount - 1)) / 2
  }, 0)
}

function useDashboardDeferredOnDemand(
  sections: DashboardDeferredKey[],
  enabled = true,
) {
  const ref = useRef<HTMLElement | null>(null)
  const requested = useRef(false)
  const { loadDeferredSections } = useDashboardDataContext()

  useEffect(() => {
    if (!enabled || requested.current || sections.length === 0) {
      return
    }

    const element = ref.current

    if (!element) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      requested.current = true
      loadDeferredSections(sections)
      return
    }

    let observer: IntersectionObserver | null = null
    const timeout = window.setTimeout(() => {
      if (requested.current) {
        return
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting || requested.current) {
            return
          }

          requested.current = true
          loadDeferredSections(sections)
          observer?.disconnect()
        },
        { rootMargin: deferredObserverRootMargin },
      )

      observer.observe(element)
    }, deferredObserverDelayMs)

    return () => {
      window.clearTimeout(timeout)
      observer?.disconnect()
    }
  }, [enabled, loadDeferredSections, sections])

  return ref
}

function preloadDashboardHero() {
  if (typeof document === 'undefined') {
    return
  }

  if (document.querySelector(`link[rel="preload"][href="${dashboardHero}"]`)) {
    return
  }

  const link = document.createElement('link')
  link.as = 'image'
  link.href = dashboardHero
  link.rel = 'preload'
  link.type = 'image/webp'
  document.head.appendChild(link)
}

function formatMissionLabel(mission: string) {
  return mission || 'Mission not recorded'
}

export default Dashboard
