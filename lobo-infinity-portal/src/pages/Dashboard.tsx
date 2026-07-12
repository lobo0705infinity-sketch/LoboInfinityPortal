import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import BarChart from '../components/BarChart'
import Loading from '../components/Loading'
import RecentGames from '../components/RecentGames'
import Skeleton from '../components/Skeleton'
import StatCard from '../components/StatCard'
import {
  type ArmyListCommunitySummary,
  type CommissionerNewsItem,
  type CommunityCommandCenterData,
  type HallOfFameData,
  type IntelligenceGame,
  type LeagueIntelligenceData,
  type LeagueRecordValue,
  type RecentGame,
  type SchedulingRequest,
  type StandingsBattle,
} from '../services/api'
import type { LeagueOverview } from '../types/dashboard'
import {
  getDivisionIdentity,
  getDivisionStyle,
} from '../utils/divisions'
import {
  formatObjectiveScore,
  formatPlayerName,
  formatSchedulingDateTime,
} from '../services/formatting'
import {
  DashboardDataProvider,
  useDashboardDataContext,
} from '../contexts/DashboardDataContext'
import '../App.css'

type LeaguePersonalityItem = {
  body: string
  label: string
  title: string
  to: string
}

type LeaguePersonality = {
  featuredMatch: LeaguePersonalityItem | null
  headlines: LeaguePersonalityItem[]
  heroMessage: string
  recordSpotlight: LeaguePersonalityItem | null
  seasonTimeline: LeaguePersonalityItem[]
  spotlight: LeaguePersonalityItem | null
}

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
      ? intelligence.records.mostActiveMission.name
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
          <RecentGames games={games} isLoading={false} />
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>Powered by</span>
        <strong>Lobo Infinity League API</strong>
      </footer>
    </main>
  )
}

function CommunityCommandCenter() {
  const {
    communityCommandCenter,
    communityCommandCenterStatus,
    communityCommandCenterError,
  } = useDashboardDataContext()

  if (communityCommandCenterStatus === 'loading') {
    return (
      <section className="panel community-command-center-panel" aria-label="Community command center loading">
        <div className="panel-heading">
          <p className="eyebrow">Community Command Center</p>
          <h2>Loading community insights</h2>
        </div>
        <div className="dashboard-state">
          <Loading />
        </div>
      </section>
    )
  }

  if (communityCommandCenterStatus === 'error') {
    return (
      <section className="panel community-command-center-panel" aria-label="Community command center error">
        <div className="panel-heading">
          <p className="eyebrow">Community Command Center</p>
          <h2>Community insights unavailable</h2>
        </div>
        <div className="dashboard-state">
          <p role="alert">{communityCommandCenterError}</p>
        </div>
      </section>
    )
  }

  if (!communityCommandCenter) {
    return null
  }

  const personality = buildLeaguePersonality(communityCommandCenter)

  return (
    <section className="community-command-center" aria-label="Community command center">
      <div className="community-command-center-hero">
        <p className="eyebrow">Community Command Center</p>
        <h2>{personality.heroMessage}</h2>
      </div>
      <LeaguePersonalityShowcase personality={personality} />
      <section className="panel community-quick-actions" aria-labelledby="community-actions-title">
        <div className="panel-heading">
          <p className="eyebrow">Quick Actions</p>
          <h2 id="community-actions-title">Take action</h2>
        </div>
        <nav className="player-home-actions" aria-label="Community quick actions">
          {buildPlayerHomeQuickActions(communityCommandCenter).map((action) => (
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
            <h2 id="activity-title">What changed?</h2>
          </div>
          <div className="player-home-feed">
            {communityCommandCenter.communityActivity.latestResults.slice(0, 3).map((game) => (
              <CommandActionLink className="player-home-feed-item" key={game.id} to={`/games/${game.id}`}>
                <span>Latest Result</span>
                <strong>
                  {formatPlayerName(game.winner, game.winnerDisplayName)} defeated{' '}
                  {formatPlayerName(game.loser, game.loserDisplayName)}
                </strong>
                <p>{formatMissionLabel(game.mission)} - {formatObjectiveScore(game)}</p>
              </CommandActionLink>
            ))}
            {communityCommandCenter.communityActivity.news.slice(0, 2).map((item) => (
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
            <h2 id="motivation-title">Keep moving</h2>
          </div>
          <div className="player-home-feed compact">
            {buildMotivationMessages(communityCommandCenter).map((message) => (
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

function LeaguePersonalityShowcase({
  personality,
}: {
  personality: LeaguePersonality
}) {
  return (
    <section className="league-personality-grid" aria-label="League story">
      <section className="player-home-card league-headlines-card" aria-labelledby="league-headlines-title">
        <div className="player-home-card-heading">
          <p className="eyebrow">League Headlines</p>
          <h2 id="league-headlines-title">What Everyone Is Talking About</h2>
        </div>
        <div className="player-home-feed">
          {personality.headlines.map((headline) => (
            <CommandActionLink
              className="player-home-feed-item"
              key={`${headline.label}-${headline.title}`}
              to={headline.to}
            >
              <span>{headline.label}</span>
              <strong>{headline.title}</strong>
              <p>{headline.body}</p>
            </CommandActionLink>
          ))}
        </div>
      </section>

      {personality.featuredMatch ? (
        <CommandActionLink
          className="player-home-card league-featured-match"
          to={personality.featuredMatch.to}
        >
          <span>{personality.featuredMatch.label}</span>
          <strong>{personality.featuredMatch.title}</strong>
          <p>{personality.featuredMatch.body}</p>
        </CommandActionLink>
      ) : null}

      <section className="player-home-card" aria-labelledby="season-story-title">
        <div className="player-home-card-heading">
          <p className="eyebrow">Season Story</p>
          <h2 id="season-story-title">How the Week Is Moving</h2>
        </div>
        <div className="league-storyline">
          {personality.seasonTimeline.map((item) => (
            <CommandActionLink key={`${item.label}-${item.title}`} to={item.to}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </CommandActionLink>
          ))}
        </div>
      </section>

      <section className="player-home-card" aria-labelledby="league-spotlight-title">
        <div className="player-home-card-heading">
          <p className="eyebrow">Spotlight</p>
          <h2 id="league-spotlight-title">League Pulse</h2>
        </div>
        <div className="player-home-feed compact">
          {personality.recordSpotlight ? (
            <CommandActionLink className="player-home-feed-item" to={personality.recordSpotlight.to}>
              <span>{personality.recordSpotlight.label}</span>
              <strong>{personality.recordSpotlight.title}</strong>
              <p>{personality.recordSpotlight.body}</p>
            </CommandActionLink>
          ) : null}
          {personality.spotlight ? (
            <CommandActionLink className="player-home-feed-item" to={personality.spotlight.to}>
              <span>{personality.spotlight.label}</span>
              <strong>{personality.spotlight.title}</strong>
              <p>{personality.spotlight.body}</p>
            </CommandActionLink>
          ) : null}
          <CommandActionLink className="player-home-secondary-action" to="/rivalries">
            Rivalry Room
          </CommandActionLink>
        </div>
      </section>
    </section>
  )
}

function buildLeaguePersonality(
  data: CommunityCommandCenterData,
): LeaguePersonality {
  return {
    featuredMatch: buildFeaturedLeagueMatch(data),
    headlines: buildLeagueHeadlines(data),
    heroMessage: buildDynamicHeroMessage(data),
    recordSpotlight: buildRecordSpotlight(data),
    seasonTimeline: buildSeasonTimeline(data),
    spotlight: buildCommunitySpotlight(data),
  }
}

function buildDynamicHeroMessage(data: CommunityCommandCenterData) {
  const incoming = data.matchRequests.incoming[0]

  if (incoming) {
    return `${incoming.fromPlayer} is waiting on your match response.`
  }

  const suggested = data.opponentTracker.suggested
  const suggestedCard = suggested
    ? data.opponentTracker.remaining.find(
        (opponent) => opponent.player === suggested.player,
      )
    : null

  if (suggested && suggestedCard?.availabilitySummary) {
    return `You and ${formatPlayerName(suggested.player, suggested.displayName)} have a scheduling window: ${suggestedCard.availabilitySummary}.`
  }

  const remaining = data.opponentTracker.progress.gamesRemaining

  if (remaining > 0) {
    return `Only ${remaining} ${remaining === 1 ? 'league game remains' : 'league games remain'}.`
  }

  if (data.intelligence[0]) {
    return data.intelligence[0]
  }

  return `${data.welcome.currentLeague} - Week ${data.welcome.currentWeek || data.schedule.deadlines.currentWeek}.`
}

function buildLeagueHeadlines(data: CommunityCommandCenterData) {
  const headlines: LeaguePersonalityItem[] = []

  data.communityActivity.news.slice(0, 2).forEach((item) => {
    headlines.push({
      body: item.body,
      label: item.date || 'Commissioner Briefing',
      title: item.title,
      to: item.link || '/news',
    })
  })

  data.communityActivity.latestResults.slice(0, 2).forEach((game) => {
    headlines.push({
      body: `${formatMissionLabel(game.mission)} ended ${formatObjectiveScore(game)}.`,
      label: game.division || 'Latest Result',
      title: `${formatPlayerName(game.winner, game.winnerDisplayName)} defeated ${formatPlayerName(game.loser, game.loserDisplayName)}`,
      to: `/games/${game.id}`,
    })
  })

  data.communityActivity.latestAchievements.slice(0, 2).forEach((item) => {
    headlines.push({
      body: item.body,
      label: item.type || 'Achievement',
      title: item.title,
      to: item.link || '/notifications',
    })
  })

  if (data.welcome.leagueCompletion > 0) {
    headlines.push({
      body: `${data.welcome.currentLeague} is ${data.welcome.leagueCompletion}% complete.`,
      label: 'Season Progress',
      title: `${data.welcome.currentDivision || 'League'} reaches ${data.welcome.leagueCompletion}%`,
      to: '/standings',
    })
  }

  if (data.promotion.status && data.promotion.status !== 'Safe') {
    headlines.push({
      body: `Rank #${data.promotion.currentRank} keeps you in the ${data.promotion.status}.`,
      label: 'Promotion Watch',
      title: data.promotion.status,
      to: '/standings',
    })
  }

  return headlines.slice(0, 5)
}

function buildFeaturedLeagueMatch(
  data: CommunityCommandCenterData,
): LeaguePersonalityItem | null {
  const upcoming = data.matchRequests.upcoming[0]

  if (upcoming) {
    const opponent = getOtherRequestPlayer(upcoming, data.welcome.leaguePlayer)

    return {
      body: `${formatSchedulingDateTime(
        upcoming.proposedDate,
        upcoming.proposedTime,
      )}. This one matters because it moves your season progress forward.`,
      label: 'Featured Match',
      title: `${data.welcome.displayName} vs ${opponent}`,
      to: '/match-finder',
    }
  }

  const suggested = data.opponentTracker.suggested

  if (suggested) {
    return {
      body: `${suggested.reason} Schedule it before the week gets away from the division.`,
      label: 'Featured Match',
      title: `${data.welcome.displayName} vs ${formatPlayerName(suggested.player, suggested.displayName)}`,
      to: `/match-finder?opponent=${encodeURIComponent(suggested.player)}`,
    }
  }

  const latest = data.communityActivity.latestResults[0]

  if (latest) {
    return {
      body: `${formatMissionLabel(latest.mission)} finished ${formatObjectiveScore(latest)}. Latest completed battles shape the table while new matchups get scheduled.`,
      label: 'Featured Battle',
      title: `${formatPlayerName(latest.winner, latest.winnerDisplayName)} vs ${formatPlayerName(latest.loser, latest.loserDisplayName)}`,
      to: `/games/${latest.id}`,
    }
  }

  return null
}

function buildSeasonTimeline(data: CommunityCommandCenterData) {
  const timeline: LeaguePersonalityItem[] = [
    {
      body: `${data.welcome.currentLeague} is active with ${data.opponentTracker.progress.gamesCompleted} of ${data.opponentTracker.progress.gamesRequired} required games completed for you.`,
      label: `Week ${data.welcome.currentWeek || data.schedule.deadlines.currentWeek}`,
      title: 'Your season is in motion',
      to: '/match-finder',
    },
  ]

  if (data.communityActivity.latestResults[0]) {
    const game = data.communityActivity.latestResults[0]
    timeline.push({
      body: `${formatMissionLabel(game.mission)} - ${formatObjectiveScore(game)}.`,
      label: game.date || 'Latest Result',
      title: `${formatPlayerName(game.winner, game.winnerDisplayName)} reports a win`,
      to: `/games/${game.id}`,
    })
  }

  if (data.communityActivity.news[0]) {
    const news = data.communityActivity.news[0]
    timeline.push({
      body: news.body,
      label: news.date || 'Commissioner News',
      title: news.title,
      to: news.link || '/news',
    })
  }

  if (data.opponentTracker.progress.completionPercentage > 0) {
    timeline.push({
      body: `${data.opponentTracker.progress.gamesRemaining} games remain on your slate.`,
      label: 'Season Progress',
      title: `${data.opponentTracker.progress.completionPercentage}% complete`,
      to: '/match-finder',
    })
  }

  return timeline.slice(0, 4)
}

function buildRecordSpotlight(
  data: CommunityCommandCenterData,
): LeaguePersonalityItem | null {
  const achievement = data.communityActivity.latestAchievements[0]

  if (achievement) {
    return {
      body: achievement.body,
      label: achievement.type || 'Achievement',
      title: achievement.title,
      to: achievement.link || '/notifications',
    }
  }

  const result = data.communityActivity.latestResults[0]

  if (!result) {
    return null
  }

  return {
    body: `${formatMissionLabel(result.mission)} produced a ${formatObjectiveScore(result)} result.`,
    label: 'Record Spotlight',
    title: 'Latest completed battle',
    to: `/games/${result.id}`,
  }
}

function buildCommunitySpotlight(
  data: CommunityCommandCenterData,
): LeaguePersonalityItem | null {
  const result = data.communityActivity.latestResults[0]

  if (result) {
    return {
      body: `${formatPlayerName(result.winner, result.winnerDisplayName)} was the latest player to report a result.`,
      label: 'Community Spotlight',
      title: formatPlayerName(result.winner, result.winnerDisplayName),
      to: `/players/${encodeURIComponent(result.winner)}`,
    }
  }

  if (data.opponentTracker.remaining[0]) {
    const opponent = data.opponentTracker.remaining[0]

    return {
      body: opponent.availabilitySummary || 'No availability added yet.',
      label: 'Opponent Spotlight',
      title: formatPlayerName(opponent.player, opponent.displayName),
      to: opponent.scheduleLink || `/match-finder?opponent=${encodeURIComponent(opponent.player)}`,
    }
  }

  return null
}

function getOtherRequestPlayer(request: SchedulingRequest, playerName: string) {
  return request.fromPlayer === playerName ? request.toPlayer : request.fromPlayer
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
          <dd>{formatMissionLabel(game.mission)}</dd>
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
  const missionTrend = intelligence
    ? intelligence.missionTrends[0]
    : null
  const headlines = [
    ...news.slice(0, 2).map((item) => ({
      label: item.date || 'Commissioner News',
      story: item.body,
      title: item.title,
      to: item.link || '/intelligence',
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
    missionTrend
      ? {
          label: 'Most Played Mission',
          story: missionTrend.story,
          title: missionTrend.mission,
          to: `/missions/${encodeURIComponent(missionTrend.mission)}`,
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

function formatMissionLabel(mission: string) {
  return mission || 'Mission not recorded'
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
