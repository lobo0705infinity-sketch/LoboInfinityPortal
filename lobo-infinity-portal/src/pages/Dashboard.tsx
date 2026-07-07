import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import BarChart from '../components/BarChart'
import Loading from '../components/Loading'
import RecentGames from '../components/RecentGames'
import Skeleton from '../components/Skeleton'
import StatCard from '../components/StatCard'
import {
  apiClient,
  type ArmyListCommunitySummary,
  type CommissionerNewsItem,
  type HallOfFameData,
  type IntelligenceGame,
  type LeagueIntelligenceData,
  type LeagueRecordValue,
  type PortalSettings,
  type RecentGame,
  type StandingsBattle,
} from '../services/api'
import type { DashboardData, LeagueOverview } from '../types/dashboard'
import {
  getDivisionIdentity,
  getDivisionStyle,
} from '../utils/divisions'
import { formatObjectiveScore, formatPlayerName } from '../services/formatting'
import '../App.css'

type HomeState =
  | {
      status: 'loading'
    }
  | {
      data: DashboardPageData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

type DashboardPageData = {
  armyListCommunity: ArmyListCommunitySummary
  dashboard: DashboardData
  hallOfFame: HallOfFameData | null
  intelligence: LeagueIntelligenceData | null
  news: CommissionerNewsItem[]
  records: Record<string, LeagueRecordValue>
  recentGames: RecentGame[]
  settings: PortalSettings
}

const defaultArmyListCommunity: ArmyListCommunitySummary = {
  highestRatedDesigner: null,
  mostListsSubmitted: [],
  mostPopularFaction: '',
  topContributors: [],
  trendingLists: [],
}

const defaultPortalSettings: PortalSettings = {
  bannerImage: '',
  commissionerContact: '',
  commissionerEmails: '',
  currentSeason: '',
  deploymentUrl: '',
  discordInvite: '',
  gitCommit: '',
  googleFormUrl: '',
  googleOAuthClientId: '',
  leagueLogo: '',
  leagueName: 'Lobo Infinity League',
  leagueWebsite: '',
  portalVersion: '',
  registrationOpen: '',
  seasonEndDate: '',
  seasonStartDate: '',
  submissionButtonText: 'Submit Match',
  submissionButtonVisible: 'true',
  submissionEnabled: 'true',
  themeAccentColor: '',
}

function buildDashboardPageData(dashboard: DashboardData): DashboardPageData {
  return {
    armyListCommunity: defaultArmyListCommunity,
    dashboard,
    hallOfFame: null,
    intelligence: null,
    news: [],
    records: {},
    recentGames: [],
    settings: defaultPortalSettings,
  }
}

async function hydrateDashboardSecondaryData(
  initialData: DashboardPageData,
  signal: AbortSignal,
  setHomeState: (state: HomeState) => void,
) {
  const [recentGames, news, intelligence, settings, armyLists] =
    await Promise.allSettled([
      apiClient.getRecentGames({ signal }),
      apiClient.getNews({ signal }),
      apiClient.getAnalytics({ signal }),
      apiClient.getSettings({ signal }),
      apiClient.getArmyLists({ signal }),
    ])

  if (signal.aborted) {
    return
  }

  const nextData: DashboardPageData = {
    ...initialData,
    armyListCommunity:
      armyLists.status === 'fulfilled'
        ? armyLists.value.community
        : initialData.armyListCommunity,
    intelligence:
      intelligence.status === 'fulfilled'
        ? intelligence.value
        : initialData.intelligence,
    news:
      news.status === 'fulfilled'
        ? news.value
        : initialData.news,
    records:
      intelligence.status === 'fulfilled'
        ? intelligence.value.records
        : initialData.records,
    recentGames:
      recentGames.status === 'fulfilled'
        ? recentGames.value
        : initialData.recentGames,
    settings:
      settings.status === 'fulfilled'
        ? settings.value
        : initialData.settings,
  }

  setHomeState({
    data: nextData,
    status: 'success',
  })
}

function Dashboard() {
  const [homeState, setHomeState] = useState<HomeState>({
    status: 'loading',
  })
  const lastUpdated = new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadCommandCenter() {
      try {
        const dashboard = await apiClient.getDashboard({
          signal: controller.signal,
        })

        const initialData = buildDashboardPageData(dashboard)

        setHomeState({
          data: initialData,
          status: 'success',
        })

        void hydrateDashboardSecondaryData(initialData, controller.signal, setHomeState)
      } catch (error) {
        if (!controller.signal.aborted) {
          setHomeState({
            error:
              error instanceof Error
                ? error.message
                : 'Dashboard data could not be loaded.',
            status: 'error',
          })
        }
      }
    }

    void loadCommandCenter()

    return () => {
      controller.abort()
    }
  }, [])

  if (homeState.status === 'loading') {
    return (
      <main className="portal-shell">
        <DashboardHeader lastUpdated={lastUpdated} />
        <div className="portal-grid">
          <Skeleton label="Dashboard loading" rows={8} />
          <section className="dashboard-state" aria-label="Dashboard loading">
            <Loading />
          </section>
        </div>
      </main>
    )
  }

  if (homeState.status === 'error') {
    return (
      <main className="portal-shell">
        <DashboardHeader lastUpdated={lastUpdated} />
        <section className="dashboard-state" aria-label="Dashboard error">
          <p role="alert">{homeState.error}</p>
        </section>
      </main>
    )
  }

  const data = homeState.data.dashboard
  const games = homeState.data.recentGames
  const news = homeState.data.news
  const records = homeState.data.records
  const hallOfFame = homeState.data.hallOfFame
  const intelligence = homeState.data.intelligence
  const armyListCommunity = homeState.data.armyListCommunity
  const featuredGame = games[0]
  const hottestPlayer = intelligence?.winStreaks[0]
  const strongestFaction =
    intelligence?.records.bestFirstTurnFaction &&
    !('winner' in intelligence.records.bestFirstTurnFaction)
      ? intelligence.records.bestFirstTurnFaction.faction ||
        intelligence.records.bestFirstTurnFaction.name ||
        data.summary.topFaction
      : data.summary.topFaction
  const mostPlayedMission =
    intelligence?.records.mostActiveMission &&
    !('winner' in intelligence.records.mostActiveMission)
      ? intelligence.records.mostActiveMission.name || ''
      : ''

  return (
    <main className="portal-shell">
      <DashboardHeader lastUpdated={lastUpdated} />
      <MemberWelcomeBanner
        googleFormUrl={homeState.data.settings.googleFormUrl}
        submissionsEnabled={
          homeState.data.settings.submissionEnabled !== 'false' &&
          homeState.data.settings.submissionButtonVisible !== 'false'
        }
      />

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

      <section className="league-stats" aria-label="Dashboard summary">
        <StatCard
          icon="L"
          label="Current Leader"
          subtitle="Main Man leader"
          value={data.summary.leagueLeader}
        />
        <StatCard
          icon="H"
          label="Hottest Player"
          subtitle={hottestPlayer ? `${hottestPlayer.games} game streak` : 'Live streaks'}
          value={
            hottestPlayer
              ? formatPlayerName(hottestPlayer.player, hottestPlayer.displayName)
              : data.summary.leagueLeader
          }
        />
        <StatCard
          icon="F"
          label="Strongest Faction"
          subtitle="Live meta signal"
          value={strongestFaction}
        />
        <StatCard
          icon="M"
          label="Most Played Mission"
          subtitle="League activity"
          value={mostPlayedMission || data.summary.topFaction}
        />
      </section>

      <LeagueOverviewStrip overview={data.leagueOverview} />

      <section className="command-center-grid" aria-label="Command charts">
        <CommandPanel eyebrow="Division Activity" title="Games by Division">
          <BarChart
            points={data.leagueOverview.divisions.map((division) => ({
              label: getDivisionIdentity(division.division).shortLabel,
              meta: `${division.players} players`,
              to: '/standings',
              value: division.gamesPlayed,
            }))}
            title="Games by Division"
          />
        </CommandPanel>
        <CommandPanel eyebrow="Games per Week" title="Recent Game Tempo">
          <BarChart points={getGamesPerWeek(games)} title="Games per week" />
        </CommandPanel>
        <CommandPanel eyebrow="Quick Scan" title="League Headlines">
          <HeadlineStack
            intelligence={intelligence}
            news={news}
            strongestFaction={strongestFaction}
          />
        </CommandPanel>
      </section>

      <DashboardHighlights
        games={games}
        armyListCommunity={armyListCommunity}
        hallOfFame={hallOfFame}
        intelligence={intelligence}
        news={news}
        overview={data.leagueOverview}
        records={records}
      />

      <section className="dashboard-experience-grid" aria-label="League reports">
        {featuredGame ? <FeaturedMatchHero game={featuredGame} /> : null}
        <div className="dashboard-experience-side">
          <WatchCard
            eyebrow="Promotion Watch"
            items={intelligence?.promotionBattle ?? []}
            title="Promotion Watch"
          />
          <WatchCard
            eyebrow="Relegation Watch"
            items={intelligence?.relegationBattle ?? []}
            title="Relegation Watch"
          />
        </div>
      </section>

      <section className="dashboard-grid">
        <section
          className="panel standings-panel"
          aria-labelledby="standings-title"
        >
          <div className="panel-heading standings-panel-heading">
            <div>
              <p className="eyebrow">Main Man Standings</p>
              <h2 id="standings-title">
                {getDivisionIdentity('main').icon} Current Table
              </h2>
            </div>
          </div>

          <div
            className="standings-table"
            role="table"
            aria-label="Main Man Standings"
          >
            <div className="table-row table-head" role="row">
              <span role="columnheader">Rank</span>
              <span role="columnheader">Player</span>
              <span role="columnheader">Games</span>
              <span role="columnheader">Wins</span>
              <span role="columnheader">Losses</span>
              <span role="columnheader">TP</span>
              <span role="columnheader">OP</span>
              <span role="columnheader">VP</span>
            </div>

            {data.standings.map((standing) => (
              <div
                className={`table-row ${getRankClass(standing.rank)}`}
                role="row"
                key={standing.rank}
              >
                <span role="cell">{standing.rank}</span>
                <strong role="cell">
                  <Link
                    className="table-player-link"
                    to={`/players/${encodeURIComponent(standing.player)}`}
                  >
                    {formatPlayerName(standing.player, standing.displayName)}
                  </Link>
                </strong>
                <span role="cell">{standing.games}</span>
                <span role="cell">{standing.wins}</span>
                <span role="cell">{standing.losses}</span>
                <span role="cell">{standing.tp}</span>
                <span role="cell">{standing.op}</span>
                <span role="cell">{standing.vp}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="dashboard-side-column">
          <RecordPulse
            biggestBlowout={intelligence?.biggestVictories[0]}
            biggestUpset={intelligence?.recentUpsets[0]}
            closestMatch={intelligence?.closestGames[0]}
          />
          <RecentGames
            games={games}
            isLoading={false}
          />
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>Powered by</span>
        <strong>Lobo Infinity League API</strong>
      </footer>
    </main>
  )
}

function MemberWelcomeBanner({
  googleFormUrl,
  submissionsEnabled,
}: {
  googleFormUrl: string
  submissionsEnabled: boolean
}) {
  const auth = useAuth()

  if (!auth.authenticated) {
    return null
  }

  return (
    <section className="member-welcome-banner" aria-label="Member dashboard">
      <div>
        <p className="eyebrow">Welcome Back</p>
        <h2>{auth.user.displayName}</h2>
        <p>
          {auth.user.favoriteFaction
            ? `Favorite faction: ${auth.user.favoriteFaction}`
            : 'Set your favorite faction from My Profile.'}
        </p>
      </div>
      <div className="member-welcome-actions">
        {auth.user.favoriteFaction ? (
          <Link to={`/factions/${encodeURIComponent(auth.user.favoriteFaction)}`}>
            Favorite Faction
          </Link>
        ) : null}
        {auth.user.lastPage ? <Link to={auth.user.lastPage}>Continue</Link> : null}
        <Link to="/notifications">Notifications</Link>
        <Link to="/army-lists">My Army Lists</Link>
        {googleFormUrl && submissionsEnabled ? (
          <a href={googleFormUrl} rel="noreferrer" target="_blank">
            Submit Match
          </a>
        ) : null}
      </div>
    </section>
  )
}

function FeaturedMatchHero({ game }: { game: RecentGame }) {
  return (
    <Link className="featured-match-hero" to={`/games/${game.id}`}>
      <div className="featured-match-kicker">
        <span>Featured Match</span>
        <time>{game.date}</time>
      </div>
      <div className="featured-match-result">
        <div>
          <p>Winner</p>
          <h2>{formatPlayerName(game.winner, game.winnerDisplayName)}</h2>
          <span>{game.winnerFaction}</span>
        </div>
        <strong>defeated</strong>
        <div>
          <p>Loser</p>
          <h3>{formatPlayerName(game.loser, game.loserDisplayName)}</h3>
          <span>{game.loserFaction}</span>
        </div>
      </div>
      <dl className="featured-match-meta">
        <div>
          <dt>Mission</dt>
          <dd>{game.mission}</dd>
        </div>
        <div>
          <dt>OP</dt>
          <dd>{formatObjectiveScore(game)}</dd>
        </div>
        <div>
          <dt>Division</dt>
          <dd>{game.division}</dd>
        </div>
      </dl>
    </Link>
  )
}

function WatchCard({
  eyebrow,
  items,
  title,
}: {
  eyebrow: string
  items: StandingsBattle[]
  title: string
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="panel intelligence-pulse" aria-labelledby={titleToId(title)}>
      <div className="panel-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <div className="intelligence-pulse-list">
        {items.slice(0, 3).map((item) => (
          <Link
            className="intelligence-pulse-card"
            key={`${title}-${item.division}-${item.player}`}
            to={`/players/${encodeURIComponent(item.player)}`}
          >
            <span>
              {item.division} - Rank #{item.rank}
            </span>
            <strong>{formatPlayerName(item.player, item.displayName)}</strong>
            <p>{item.story}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function RecordPulse({
  biggestBlowout,
  biggestUpset,
  closestMatch,
}: {
  biggestBlowout?: IntelligenceGame
  biggestUpset?: {
    id: number
    loser: string
    loserDisplayName?: string
    story: string
    winner: string
    winnerDisplayName?: string
  }
  closestMatch?: IntelligenceGame
}) {
  const records = [
    biggestUpset
      ? {
          label: 'Biggest Upset',
          story: biggestUpset.story,
          title: `${formatPlayerName(biggestUpset.winner, biggestUpset.winnerDisplayName)} over ${formatPlayerName(biggestUpset.loser, biggestUpset.loserDisplayName)}`,
          to: `/games/${biggestUpset.id}`,
        }
      : null,
    closestMatch
      ? {
          label: 'Closest Match',
          story: closestMatch.story,
          title: `${formatPlayerName(closestMatch.winner, closestMatch.winnerDisplayName)} vs ${formatPlayerName(closestMatch.loser, closestMatch.loserDisplayName)}`,
          to: `/games/${closestMatch.id}`,
        }
      : null,
    biggestBlowout
      ? {
          label: 'Biggest Blowout',
          story: biggestBlowout.story,
          title: `${formatPlayerName(biggestBlowout.winner, biggestBlowout.winnerDisplayName)} vs ${formatPlayerName(biggestBlowout.loser, biggestBlowout.loserDisplayName)}`,
          to: `/games/${biggestBlowout.id}`,
        }
      : null,
  ].filter((record): record is NonNullable<typeof record> => record !== null)

  if (records.length === 0) {
    return null
  }

  return (
    <section className="panel intelligence-pulse" aria-labelledby="record-pulse">
      <div className="panel-heading">
        <p className="eyebrow">Records Engine</p>
        <h2 id="record-pulse">Record Pulse</h2>
      </div>
      <div className="intelligence-pulse-list">
        {records.map((record) => (
          <Link className="intelligence-pulse-card" key={record.label} to={record.to}>
            <span>{record.label}</span>
            <strong>{record.title}</strong>
            <p>{record.story}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function HeadlineStack({
  intelligence,
  news,
  strongestFaction,
}: {
  intelligence: LeagueIntelligenceData | null
  news: CommissionerNewsItem[]
  strongestFaction: string
}) {
  const headlines = [
    ...news.slice(0, 2).map((item) => ({
      label: item.date || 'Commissioner News',
      story: item.body,
      title: item.title,
      to: item.link || '/analytics',
    })),
    intelligence?.winStreaks[0]
      ? {
          label: 'Hottest Player',
          story: intelligence.winStreaks[0].story,
          title: formatPlayerName(
            intelligence.winStreaks[0].player,
            intelligence.winStreaks[0].displayName,
          ),
          to: `/players/${encodeURIComponent(intelligence.winStreaks[0].player)}`,
        }
      : null,
    intelligence?.missionTrends[0]
      ? {
          label: 'Most Played Mission',
          story: intelligence.missionTrends[0].story,
          title: intelligence.missionTrends[0].mission,
          to: `/missions/${encodeURIComponent(intelligence.missionTrends[0].mission)}`,
        }
      : null,
    strongestFaction
      ? {
          label: 'Strongest Faction',
          story: `${strongestFaction} is the current headline faction signal.`,
          title: strongestFaction,
          to: `/factions/${encodeURIComponent(strongestFaction)}`,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <div className="intelligence-story-stack">
      {headlines.map((headline) => (
        <Link className="intelligence-story" key={headline.label} to={headline.to}>
          <span>{headline.label}</span>
          <strong>{headline.title}</strong>
          <p>{headline.story}</p>
        </Link>
      ))}
    </div>
  )
}

function DashboardHighlights({
  armyListCommunity,
  games,
  hallOfFame,
  intelligence,
  news,
  overview,
  records,
}: {
  armyListCommunity: ArmyListCommunitySummary
  games: RecentGame[]
  hallOfFame: HallOfFameData | null
  intelligence: LeagueIntelligenceData | null
  news: CommissionerNewsItem[]
  overview: LeagueOverview
  records: Record<string, LeagueRecordValue>
}) {
  const activeDivision = overview.divisions
    .slice()
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0]
  const activePlayer = records.mostActivePlayer
  const activePlayerName =
    activePlayer && !('winner' in activePlayer) ? activePlayer.name : ''
  const activePlayerDisplayName =
    activePlayer && !('winner' in activePlayer)
      ? activePlayer.displayName || activePlayer.name || ''
      : ''
  const latestRecord = getLatestRecord(records)
  const hallLeader = hallOfFame?.leaders.tournamentPoints[0]
  const todayGames = games.filter((game) => isToday(game.date)).length
  const milestoneItems = buildMilestoneItems({
    games,
    hallLeader,
    intelligence,
    overview,
  })

  return (
    <section className="dashboard-highlight-grid" aria-label="League highlights">
      <section className="panel dashboard-news-widget">
        <div className="panel-heading">
          <p className="eyebrow">Commissioner News</p>
          <h2>League News</h2>
        </div>
        <div className="dashboard-news-list">
          {news.slice(0, 3).map((item) => (
            <Link className="dashboard-news-item" key={item.id} to={item.link || '/news'}>
              <span>{item.date || 'Live'}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel dashboard-metrics-widget">
        <div className="panel-heading">
          <p className="eyebrow">Today</p>
          <h2>League Snapshot</h2>
        </div>
        <dl className="dashboard-metric-list">
          <div>
            <dt>Games Today</dt>
            <dd>{todayGames}</dd>
          </div>
          <div>
            <dt>Most Active Division</dt>
            <dd>{activeDivision?.divisionLabel ?? 'League'}</dd>
          </div>
          <div>
            <dt>Most Active Player</dt>
            <dd>
              {activePlayerName ? (
                <Link to={`/players/${encodeURIComponent(activePlayerName)}`}>
                  {activePlayerDisplayName || activePlayerName}
                </Link>
              ) : (
                'Live data pending'
              )}
            </dd>
          </div>
          <div>
            <dt>Latest Record</dt>
            <dd>
              {latestRecord ? (
                <Link to={latestRecord.to}>{latestRecord.label}</Link>
              ) : (
                'Live data pending'
              )}
            </dd>
          </div>
          <div>
            <dt>Hall of Fame</dt>
            <dd>
              {hallLeader ? (
                <Link to={`/players/${encodeURIComponent(hallLeader.player)}`}>
                  {formatPlayerName(hallLeader.player, hallLeader.displayName)}
                </Link>
              ) : (
                'Live data pending'
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel dashboard-metrics-widget">
        <div className="panel-heading">
          <p className="eyebrow">Community</p>
          <h2>Army List Vault</h2>
        </div>
        <dl className="dashboard-metric-list">
          <div>
            <dt>Most Popular Faction</dt>
            <dd>
              {armyListCommunity.mostPopularFaction ? (
                <Link
                  to={`/factions/${encodeURIComponent(
                    armyListCommunity.mostPopularFaction,
                  )}`}
                >
                  {armyListCommunity.mostPopularFaction}
                </Link>
              ) : (
                'Live data pending'
              )}
            </dd>
          </div>
          <div>
            <dt>Highest Rated Designer</dt>
            <dd>
              {armyListCommunity.highestRatedDesigner ? (
                <Link
                  to={`/players/${encodeURIComponent(
                    armyListCommunity.highestRatedDesigner.name,
                  )}`}
                >
                  {armyListCommunity.highestRatedDesigner.name}
                </Link>
              ) : (
                'Live data pending'
              )}
            </dd>
          </div>
          <div>
            <dt>Trending Lists</dt>
            <dd>
              <Link to="/army-lists">
                {armyListCommunity.trendingLists.length} approved lists
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel dashboard-milestone-widget">
        <div className="panel-heading">
          <p className="eyebrow">Upcoming Milestones</p>
          <h2>Milestone Watch</h2>
        </div>
        <div className="dashboard-news-list">
          {milestoneItems.map((item) => (
            <Link className="dashboard-news-item" key={item.title} to={item.to}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}

function getLatestRecord(records: Record<string, LeagueRecordValue>) {
  const candidates = [
    ['Biggest OP Scoreline Margin', records.largestVPMargin],
    ['Biggest OP Margin', records.largestOPMargin],
    ['Highest Scoring Game', records.highestScoringGame],
    ['Closest Match', records.closestVPGame],
  ] as const

  for (const [label, record] of candidates) {
    if (record && 'winner' in record) {
      return {
        label,
        to: `/games/${record.id}`,
      }
    }
  }

  return null
}

function buildMilestoneItems({
  games,
  hallLeader,
  intelligence,
  overview,
}: {
  games: RecentGame[]
  hallLeader?: { displayName: string; player: string; tp: number }
  intelligence: LeagueIntelligenceData | null
  overview: LeagueOverview
}) {
  const totalGames = overview.totalLeagueGames
  const nextGameMilestone = Math.ceil((totalGames + 1) / 5) * 5
  const items = [
    {
      body: `${nextGameMilestone - totalGames} games until the league reaches ${nextGameMilestone} completed games.`,
      label: 'League Games',
      title: `${nextGameMilestone} Game Mark`,
      to: '/timeline',
    },
  ]

  if (hallLeader) {
    items.push({
      body: `${formatPlayerName(hallLeader.player, hallLeader.displayName)} is ${Math.max(0, 25 - hallLeader.tp)} TP away from the 25 TP threshold.`,
      label: 'Hall of Fame',
      title: `${formatPlayerName(hallLeader.player, hallLeader.displayName)} chasing 25 TP`,
      to: `/players/${encodeURIComponent(hallLeader.player)}`,
    })
  }

  if (intelligence?.winStreaks[0]) {
    const streak = intelligence.winStreaks[0]

    items.push({
      body: `${formatPlayerName(streak.player, streak.displayName)} needs one more win to extend the streak to ${streak.games + 1}.`,
      label: 'Streak Watch',
      title: `${formatPlayerName(streak.player, streak.displayName)} on a run`,
      to: `/players/${encodeURIComponent(streak.player)}`,
    })
  }

  if (games[0]) {
    items.push({
      body: `The next reported match will follow ${formatPlayerName(games[0].winner, games[0].winnerDisplayName)} vs ${formatPlayerName(games[0].loser, games[0].loserDisplayName)}.`,
      label: 'Next Report',
      title: 'Awaiting next battle report',
      to: '/timeline',
    })
  }

  return items.slice(0, 4)
}

function QuickNavigation() {
  const links = [
    ['Standings', '/standings'],
    ['Players', '/players'],
    ['Factions', '/factions'],
    ['Missions', '/missions'],
    ['Intelligence', '/analytics'],
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

function CommandPanel({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <section className="panel command-card" aria-labelledby={titleToId(title)}>
      <div className="panel-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <div className="intelligence-card-body">{children}</div>
    </section>
  )
}

function LeagueOverviewStrip({ overview }: { overview: LeagueOverview }) {
  return (
    <section className="league-overview-strip" aria-label="League overview">
      <p className="eyebrow">League Overview</p>
      <div className="league-overview-strip-items">
        {overview.divisions.map((division) => {
          const identity = getDivisionIdentity(division.division)

          return (
            <div
              className="league-overview-strip-item"
              key={division.division}
              style={getDivisionStyle(division.division)}
            >
              <strong>
                {identity.icon} {identity.shortLabel}
              </strong>
              <span>{division.players} Players</span>
              <span>{division.gamesPlayed} Games</span>
            </div>
          )
        })}
        <div className="league-overview-strip-item league-total">
          <strong>League</strong>
          <span>{overview.totalActivePlayers} Players</span>
          <span>{overview.totalLeagueGames} Games</span>
        </div>
      </div>
    </section>
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

function getGamesPerWeek(games: RecentGame[]) {
  const counts = new Map<string, number>()

  games.forEach((game) => {
    const week = getWeekLabel(game.date)
    counts.set(week, (counts.get(week) ?? 0) + 1)
  })

  return Array.from(counts.entries()).map(([label, value]) => ({
    label,
    value,
  }))
}

function getWeekLabel(dateText: string) {
  const date = new Date(dateText)

  if (Number.isNaN(date.getTime())) {
    return dateText || 'Unknown'
  }

  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - date.getDay())

  return weekStart.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

function isToday(dateText: string) {
  const parsed = new Date(dateText)

  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  const today = new Date()

  return (
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate()
  )
}

function getRankClass(rank: number) {
  if (rank === 1) {
    return 'rank-gold'
  }

  if (rank === 2) {
    return 'rank-silver'
  }

  if (rank === 3) {
    return 'rank-bronze'
  }

  return ''
}

function titleToId(title: string) {
  return title.toLowerCase().replaceAll(' ', '-')
}

export default Dashboard
