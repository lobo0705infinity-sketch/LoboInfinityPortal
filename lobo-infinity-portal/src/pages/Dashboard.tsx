import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import RecentGames from '../components/RecentGames'
import StatCard from '../components/StatCard'
import useDashboard from '../hooks/useDashboard'
import {
  apiClient,
  type CommissionerNewsItem,
  type LeagueIntelligenceData,
  type RecentGame,
} from '../services/api'
import type { LeagueOverview } from '../types/dashboard'
import {
  getDivisionIdentity,
  getDivisionStyle,
} from '../utils/divisions'
import '../App.css'

type DashboardExperienceState =
  | {
      status: 'idle'
    }
  | {
      games: RecentGame[]
      intelligence: LeagueIntelligenceData | null
      news: CommissionerNewsItem[]
      status: 'success'
    }

function Dashboard() {
  const { data, error, isLoading } = useDashboard()
  const [experienceState, setExperienceState] =
    useState<DashboardExperienceState>({
      status: 'idle',
    })
  const lastUpdated = new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadExperience() {
      const [gamesResult, newsResult, intelligenceResult] =
        await Promise.allSettled([
          apiClient.getRecentGames({ signal: controller.signal }),
          apiClient.getNews({ signal: controller.signal }),
          apiClient.getAnalytics({ signal: controller.signal }),
        ])

      if (controller.signal.aborted) {
        return
      }

      setExperienceState({
        games:
          gamesResult.status === 'fulfilled' ? gamesResult.value : [],
        intelligence:
          intelligenceResult.status === 'fulfilled'
            ? intelligenceResult.value
            : null,
        news: newsResult.status === 'fulfilled' ? newsResult.value : [],
        status: 'success',
      })
    }

    void loadExperience()

    return () => {
      controller.abort()
    }
  }, [])

  if (isLoading) {
    return (
      <main className="portal-shell">
        <DashboardHeader lastUpdated={lastUpdated} />
        <section className="dashboard-state" aria-label="Dashboard loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="portal-shell">
        <DashboardHeader lastUpdated={lastUpdated} />
        <section className="dashboard-state" aria-label="Dashboard error">
          <p role="alert">{error ?? 'Dashboard data could not be loaded.'}</p>
        </section>
      </main>
    )
  }

  const featuredGame =
    experienceState.status === 'success' ? experienceState.games[0] : undefined
  const news = experienceState.status === 'success' ? experienceState.news : []
  const intelligence =
    experienceState.status === 'success' ? experienceState.intelligence : null

  return (
    <main className="portal-shell">
      <DashboardHeader lastUpdated={lastUpdated} />

      {featuredGame || news.length > 0 || intelligence ? (
        <section
          className="dashboard-experience-grid"
          aria-label="Portal experience"
        >
          {featuredGame ? <FeaturedMatchHero game={featuredGame} /> : null}
          <div className="dashboard-experience-side">
            <CommissionerNews news={news} />
            <IntelligencePulse intelligence={intelligence} />
          </div>
        </section>
      ) : null}

      <section className="league-stats" aria-label="Dashboard summary">
        <StatCard
          icon="C"
          label="League Leader"
          subtitle="Current Leader"
          value={data.summary.leagueLeader}
        />
        <StatCard
          icon="G"
          label="Games Played"
          subtitle="Main Man Games"
          value={data.summary.gamesPlayed}
        />
        <StatCard
          icon="P"
          label="Active Players"
          subtitle="Main Man Reporting"
          value={data.summary.activePlayers}
        />
        <StatCard
          icon="F"
          label="Top Faction"
          subtitle="Current Meta Leader"
          value={data.summary.topFaction}
        />
      </section>

      <LeagueOverviewStrip overview={data.leagueOverview} />

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
                <span role="cell">{formatRank(standing.rank)}</span>
                <strong role="cell">
                  <Link
                    className="table-player-link"
                    to={`/players/${encodeURIComponent(standing.player)}`}
                  >
                    {standing.player}
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
          <aside className="panel summary-panel" aria-labelledby="summary-title">
            <div className="panel-heading">
              <p className="eyebrow">League Summary</p>
              <h2 id="summary-title">Live Snapshot</h2>
            </div>

            <dl className="summary-list">
              <div>
                <dt>Leader</dt>
                <dd>
                  <Link
                    className="summary-player-link"
                    to={`/players/${encodeURIComponent(
                      data.summary.leagueLeader,
                    )}`}
                  >
                    {data.summary.leagueLeader}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Top Faction</dt>
                <dd>{data.summary.topFaction}</dd>
              </div>
              <div>
                <dt>Main Man Games</dt>
                <dd>{data.summary.gamesPlayed}</dd>
              </div>
              <div>
                <dt>Main Man Reporting</dt>
                <dd>{data.summary.activePlayers}</dd>
              </div>
            </dl>
          </aside>

          <RecentGames />
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>Powered by</span>
        <strong>Lobo Infinity League API</strong>
      </footer>
    </main>
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
          <h2>{game.winner}</h2>
          <span>{game.winnerFaction}</span>
        </div>
        <strong>defeated</strong>
        <div>
          <p>Loser</p>
          <h3>{game.loser}</h3>
          <span>{game.loserFaction}</span>
        </div>
      </div>
      <dl className="featured-match-meta">
        <div>
          <dt>Mission</dt>
          <dd>{game.mission}</dd>
        </div>
        <div>
          <dt>VP</dt>
          <dd>{game.vp}</dd>
        </div>
        <div>
          <dt>Division</dt>
          <dd>{game.division}</dd>
        </div>
      </dl>
    </Link>
  )
}

function CommissionerNews({ news }: { news: CommissionerNewsItem[] }) {
  if (news.length === 0) {
    return null
  }

  return (
    <section className="panel commissioner-news" aria-labelledby="news-title">
      <div className="panel-heading">
        <p className="eyebrow">Commissioner News</p>
        <h2 id="news-title">League Desk</h2>
      </div>
      <div className="commissioner-news-list">
        {news.slice(0, 3).map((item) => {
          const content = (
            <>
              <span>{item.date}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </>
          )

          return item.link ? (
            <a
              className="commissioner-news-card"
              href={item.link}
              key={item.id}
              rel="noreferrer"
              target="_blank"
            >
              {content}
            </a>
          ) : (
            <article className="commissioner-news-card" key={item.id}>
              {content}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function IntelligencePulse({
  intelligence,
}: {
  intelligence: LeagueIntelligenceData | null
}) {
  if (!intelligence) {
    return null
  }

  const stories = [
    intelligence.winStreaks[0]
      ? {
          label: 'Hot Streak',
          story: intelligence.winStreaks[0].story,
          title: intelligence.winStreaks[0].player,
          to: `/players/${encodeURIComponent(intelligence.winStreaks[0].player)}`,
        }
      : null,
    intelligence.factionMomentum[0]
      ? {
          label: 'Faction Momentum',
          story: intelligence.factionMomentum[0].story,
          title: intelligence.factionMomentum[0].faction,
          to: `/factions/${encodeURIComponent(
            intelligence.factionMomentum[0].faction,
          )}`,
        }
      : null,
    intelligence.missionTrends[0]
      ? {
          label: 'Mission Meta',
          story: intelligence.missionTrends[0].story,
          title: intelligence.missionTrends[0].mission,
          to: `/missions/${encodeURIComponent(
            intelligence.missionTrends[0].mission,
          )}`,
        }
      : null,
    intelligence.closestGames[0]
      ? {
          label: 'Closest Match',
          story: intelligence.closestGames[0].story,
          title: intelligence.closestGames[0].label,
          to: `/games/${intelligence.closestGames[0].id}`,
        }
      : null,
  ].filter((story): story is NonNullable<typeof story> => story !== null)

  if (stories.length === 0) {
    return null
  }

  return (
    <section
      className="panel intelligence-pulse"
      aria-labelledby="intelligence-pulse-title"
    >
      <div className="panel-heading">
        <p className="eyebrow">League Intelligence</p>
        <h2 id="intelligence-pulse-title">Live Signals</h2>
      </div>
      <div className="intelligence-pulse-list">
        {stories.slice(0, 3).map((story) => (
          <Link className="intelligence-pulse-card" key={story.to} to={story.to}>
            <span>{story.label}</span>
            <strong>{story.title}</strong>
            <p>{story.story}</p>
          </Link>
        ))}
      </div>
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

function formatRank(rank: number) {
  return rank
}

export default Dashboard
