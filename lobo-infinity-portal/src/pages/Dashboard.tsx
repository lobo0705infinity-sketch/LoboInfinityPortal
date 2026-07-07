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
  type CommunityCommandCenterData,
  type HallOfFameData,
  type HomeData,
  type IntelligenceGame,
  type LeagueIntelligenceData,
  type LeagueRecordValue,
  type PortalSettings,
  type RecentGame,
  type SchedulingRequest,
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

function buildDashboardPageDataFromHome(home: HomeData): DashboardPageData {
  return {
    armyListCommunity: home.armyListCommunity,
    dashboard: home.dashboard,
    hallOfFame: home.hallOfFame,
    intelligence: home.intelligence,
    news: home.news,
    records: home.records,
    recentGames: home.recentGames,
    settings: home.settings,
  }
}

async function hydrateDashboardAnalytics(
  initialData: DashboardPageData,
  signal: AbortSignal,
  setHomeState: (state: HomeState) => void,
) {
  const intelligence = await apiClient.getAnalytics({ signal })

  if (signal.aborted) {
    return
  }

  setHomeState({
    data: {
      ...initialData,
      intelligence,
      records: intelligence.records,
    },
    status: 'success',
  })
}

function Dashboard() {
  const auth = useAuth()
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
        const home = await apiClient.getHome({
          signal: controller.signal,
        })

        const initialData = buildDashboardPageDataFromHome(home)

        setHomeState({
          data: initialData,
          status: 'success',
        })

        void hydrateDashboardAnalytics(
          initialData,
          controller.signal,
          setHomeState,
        ).catch(() => undefined)
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
      {!auth.authenticated ? <DashboardHeader lastUpdated={lastUpdated} /> : null}
      {auth.authenticated ? <CommunityCommandCenter /> : null}

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

type CommunityCommandState =
  | {
      status: 'idle'
    }
  | {
      data: CommunityCommandCenterData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function CommunityCommandCenter() {
  const [state, setState] = useState<CommunityCommandState>({ status: 'idle' })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getCommunityCommandCenter({ signal: controller.signal })
      .then((data) => {
        setState({ data, status: 'success' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Community command center could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  if (state.status === 'idle') {
    return (
      <section className="community-command-center panel" aria-label="Community Command Center loading">
        <div className="panel-heading">
          <p className="eyebrow">Community Command Center</p>
          <h2>What should I do today?</h2>
        </div>
        <Skeleton label="Community command center loading" rows={5} />
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section className="community-command-center panel" aria-label="Community Command Center error">
        <div className="panel-heading">
          <p className="eyebrow">Community Command Center</p>
          <h2>What should I do today?</h2>
        </div>
        <p className="operations-empty" role="alert">
          {state.error}
        </p>
      </section>
    )
  }

  const data = state.data
  const suggested = data.opponentTracker.suggested
  const priority = getPlayerHomePriority(data)
  const nextMatch = data.matchRequests.upcoming[0]
  const remainingOpponents = data.opponentTracker.remaining
  const actionableNotifications = [
    ...data.matchRequests.incoming.map((request) => ({
      body: `${request.fromPlayer} wants to play on ${request.proposedDate} at ${request.proposedTime}.`,
      id: request.id,
      link: '/match-finder',
      title: `Match request from ${request.fromPlayer}`,
      type: 'Scheduling',
    })),
    ...data.communityActivity.latestAchievements.slice(0, 2).map((item) => ({
      body: item.body,
      id: item.id,
      link: item.link || '/notifications',
      title: item.title,
      type: item.type,
    })),
    ...data.communityActivity.news.slice(0, 2).map((item) => ({
      body: item.body,
      id: String(item.id),
      link: item.link || '/news',
      title: item.title,
      type: 'Commissioner News',
    })),
  ].slice(0, 4)

  return (
    <section className="player-home" aria-labelledby="player-home-title">
      <section className="player-home-hero">
        <div>
          <p className="eyebrow">Player Home</p>
          <h1 id="player-home-title">Welcome back, {data.welcome.displayName}</h1>
          <p>
            {data.welcome.currentLeague} - {data.welcome.currentDivision || 'League'} -
            Week {data.welcome.currentWeek || data.schedule.deadlines.currentWeek}
          </p>
        </div>
        <dl className="player-home-hero-stats">
          <div>
            <dt>Record</dt>
            <dd>{data.welcome.currentRecord || '0-0'}</dd>
          </div>
          <div>
            <dt>Rank</dt>
            <dd>#{data.welcome.currentRank || '-'}</dd>
          </div>
          <div>
            <dt>League</dt>
            <dd>{data.welcome.leagueCompletion || data.opponentTracker.progress.completionPercentage}%</dd>
          </div>
        </dl>
      </section>

      <section className="player-home-priority" aria-labelledby="next-priority-title">
        <div>
          <p className="eyebrow">Next Priority</p>
          <h2 id="next-priority-title">{priority.title}</h2>
          <p>{priority.reason}</p>
          {suggested ? (
            <small>
              {suggested.reason}
              {data.opponentTracker.remaining[0]?.availabilitySummary
                ? ` - ${data.opponentTracker.remaining[0].availabilitySummary}`
                : ''}
            </small>
          ) : null}
        </div>
        <CommandActionLink className="player-home-primary-action" to={priority.link}>
          {priority.action}
        </CommandActionLink>
      </section>

      <section className="player-home-grid">
        <section className="player-home-card player-home-upcoming" aria-labelledby="upcoming-title">
          <div className="player-home-card-heading">
            <p className="eyebrow">Upcoming</p>
            <h2 id="upcoming-title">Matches & Requests</h2>
          </div>
          {nextMatch ? (
            <article className="player-home-match">
              <span>Accepted</span>
              <strong>
                {getOtherRequestPlayer(nextMatch, data.welcome.leaguePlayer)}
              </strong>
              <p>
                {nextMatch.proposedDate} - {nextMatch.proposedTime}
                {getCountdownLabel(nextMatch.proposedDate)}
              </p>
            </article>
          ) : null}
          {data.matchRequests.incoming.map((request) => (
            <CommandActionLink className="player-home-match action" key={request.id} to="/match-finder">
              <span>Waiting for your response</span>
              <strong>{request.fromPlayer}</strong>
              <p>{request.proposedDate} - {request.proposedTime}</p>
            </CommandActionLink>
          ))}
          {data.matchRequests.outgoing.map((request) => (
            <article className="player-home-match" key={request.id}>
              <span>Pending</span>
              <strong>{request.toPlayer}</strong>
              <p>{request.proposedDate} - {request.proposedTime}</p>
            </article>
          ))}
          {!nextMatch &&
          data.matchRequests.incoming.length === 0 &&
          data.matchRequests.outgoing.length === 0 ? (
            <CommandActionLink className="player-home-empty-action" to="/match-finder">
              <strong>No matches scheduled</strong>
              <span>Schedule your next league game.</span>
            </CommandActionLink>
          ) : null}
        </section>

        <section className="player-home-card" aria-labelledby="progress-title">
          <div className="player-home-card-heading">
            <p className="eyebrow">Season Progress</p>
            <h2 id="progress-title">{data.promotion.status}</h2>
          </div>
          <ProgressBar
            label={`${data.opponentTracker.progress.gamesCompleted} / ${data.opponentTracker.progress.gamesRequired} Games`}
            value={data.opponentTracker.progress.completionPercentage}
          />
          <dl className="player-home-mini-stats">
            <div>
              <dt>Remaining</dt>
              <dd>{data.opponentTracker.progress.gamesRemaining}</dd>
            </div>
            <div>
              <dt>Place</dt>
              <dd>#{data.promotion.currentRank}</dd>
            </div>
            <div>
              <dt>Magic #</dt>
              <dd>{data.promotion.magicNumber}</dd>
            </div>
          </dl>
        </section>
      </section>

      <section className="player-home-grid wide">
        <section className="player-home-card" aria-labelledby="remaining-opponents-title">
          <div className="player-home-card-heading">
            <p className="eyebrow">Remaining Opponents</p>
            <h2 id="remaining-opponents-title">Who Still Needs a Game?</h2>
          </div>
          <div className="player-home-opponents">
            {remainingOpponents.slice(0, 5).map((opponent) => (
              <CommandActionLink
                className="player-home-opponent"
                key={opponent.player}
                to={opponent.scheduleLink || `/match-finder?opponent=${encodeURIComponent(opponent.player)}`}
              >
                <div>
                  <strong>{formatPlayerName(opponent.player, opponent.displayName)}</strong>
                  <span>
                    {opponent.availabilitySummary || 'No availability added yet.'}
                  </span>
                </div>
                <small>{opponent.suggestedPriority}</small>
              </CommandActionLink>
            ))}
            {remainingOpponents.length === 0 ? (
              <div className="player-home-empty-action">
                <strong>Season complete</strong>
                <span>Enjoy the rest of the season and cheer on the remaining players.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="player-home-card" aria-labelledby="notifications-title">
          <div className="player-home-card-heading">
            <p className="eyebrow">Actionable</p>
            <h2 id="notifications-title">Notifications</h2>
          </div>
          <div className="player-home-feed compact">
            {actionableNotifications.map((item) => (
              <CommandActionLink className="player-home-feed-item" key={item.id} to={item.link}>
                <span>{item.type}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </CommandActionLink>
            ))}
            {actionableNotifications.length === 0 ? (
              <CommandActionLink className="player-home-empty-action" to="/notifications">
                <strong>No urgent alerts</strong>
                <span>View all notifications when you want the full feed.</span>
              </CommandActionLink>
            ) : null}
          </div>
          <CommandActionLink className="player-home-secondary-action" to="/notifications">
            View All
          </CommandActionLink>
        </section>
      </section>

      <section className="player-home-card" aria-labelledby="quick-actions-title">
        <div className="player-home-card-heading">
          <p className="eyebrow">Fast Actions</p>
          <h2 id="quick-actions-title">Quick Actions</h2>
        </div>
        <nav className="player-home-actions" aria-label="Player quick actions">
          {buildPlayerHomeQuickActions(data).map((action) => (
            <CommandActionLink key={action.label} to={action.link}>
              {action.label}
            </CommandActionLink>
          ))}
        </nav>
      </section>

      <section className="player-home-grid wide">
        <section className="player-home-card" aria-labelledby="activity-title">
          <div className="player-home-card-heading">
            <p className="eyebrow">League Activity</p>
            <h2 id="activity-title">What Changed?</h2>
          </div>
          <div className="player-home-feed">
            {data.communityActivity.latestResults.slice(0, 3).map((game) => (
              <CommandActionLink className="player-home-feed-item" key={game.id} to={`/games/${game.id}`}>
                <span>Latest Result</span>
                <strong>
                  {formatPlayerName(game.winner, game.winnerDisplayName)} defeated{' '}
                  {formatPlayerName(game.loser, game.loserDisplayName)}
                </strong>
                <p>{game.mission} - {formatObjectiveScore(game)}</p>
              </CommandActionLink>
            ))}
            {data.communityActivity.news.slice(0, 2).map((item) => (
              <CommandActionLink className="player-home-feed-item" key={item.id} to={item.link || '/news'}>
                <span>Commissioner News</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </CommandActionLink>
            ))}
          </div>
        </section>

        <section className="player-home-card" aria-labelledby="motivation-title">
          <div className="player-home-card-heading">
            <p className="eyebrow">Momentum</p>
            <h2 id="motivation-title">Keep Moving</h2>
          </div>
          <div className="player-home-feed compact">
            {buildMotivationMessages(data).map((message) => (
              <p className="community-insight" key={message}>
                {message}
              </p>
            ))}
          </div>
        </section>
      </section>
    </section>
  )
}

function CommandActionLink({
  children,
  className,
  to,
}: {
  children: ReactNode
  className?: string
  to: string
}) {
  if (/^https?:\/\//i.test(to)) {
    return (
      <a className={className} href={to} rel="noreferrer" target="_blank">
        {children}
      </a>
    )
  }

  return (
    <Link className={className} to={to}>
      {children}
    </Link>
  )
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="season-progress-bar">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <meter max={100} min={0} value={value} />
    </div>
  )
}

function getPlayerHomePriority(data: CommunityCommandCenterData) {
  const incoming = data.matchRequests.incoming[0]

  if (incoming) {
    return {
      action: 'Respond Now',
      link: '/match-finder',
      reason: `${incoming.fromPlayer} is waiting for your response.`,
      title: `Respond to ${incoming.fromPlayer}`,
    }
  }

  const suggested = data.opponentTracker.suggested

  if (suggested) {
    return {
      action: 'Schedule Match',
      link: `/match-finder?opponent=${encodeURIComponent(suggested.player)}`,
      reason: 'You still need this league game.',
      title: `Play ${formatPlayerName(suggested.player, suggested.displayName)}`,
    }
  }

  const action = data.today[0] || data.nextActions[0]

  if (action) {
    return {
      action: action.label.toLowerCase().includes('availability')
        ? 'Update Availability'
        : 'Open',
      link: action.link,
      reason: 'This is the most useful league action available right now.',
      title: action.label,
    }
  }

  return {
    action: 'View Standings',
    link: '/standings',
    reason: 'You are caught up for now.',
    title: 'Check League Status',
  }
}

function getOtherRequestPlayer(request: SchedulingRequest, playerName: string) {
  return request.fromPlayer === playerName ? request.toPlayer : request.fromPlayer
}

function getCountdownLabel(dateText: string) {
  const date = new Date(dateText)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const today = new Date()
  const diffDays = Math.ceil(
    (date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) /
      86_400_000,
  )

  if (diffDays === 0) {
    return ' - Today'
  }

  if (diffDays === 1) {
    return ' - Tomorrow'
  }

  if (diffDays > 1) {
    return ` - In ${diffDays} days`
  }

  return ''
}

function buildPlayerHomeQuickActions(data: CommunityCommandCenterData) {
  const actions = [
    ...data.quickActions,
    { label: 'Schedule Match', link: '/match-finder' },
    { label: 'Update Availability', link: '/match-finder#availability' },
    { label: 'View Standings', link: '/standings' },
    { label: 'Player Profile', link: '/profile' },
  ]

  const unique = new Map<string, { label: string; link: string }>()

  actions.forEach((action) => {
    if (!unique.has(action.label)) {
      unique.set(action.label, action)
    }
  })

  return Array.from(unique.values()).slice(0, 6)
}

function buildMotivationMessages(data: CommunityCommandCenterData) {
  const messages = []
  const remaining = data.opponentTracker.progress.gamesRemaining

  if (remaining === 0) {
    messages.push(
      'Season complete. Enjoy the rest of the season and cheer on the remaining players.',
    )
  } else {
    messages.push(
      `Only ${remaining} ${remaining === 1 ? 'game' : 'games'} remaining.`,
    )
  }

  if (data.promotion.status !== 'Safe') {
    messages.push(`You are currently in the ${data.promotion.status}.`)
  }

  if (data.opponentTracker.progress.completionPercentage > 0) {
    messages.push(
      `You are ${data.opponentTracker.progress.completionPercentage}% through your required games.`,
    )
  }

  if (data.intelligence[0]) {
    messages.push(data.intelligence[0])
  }

  return messages.slice(0, 4)
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
    ['Match Finder', '/match-finder'],
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
