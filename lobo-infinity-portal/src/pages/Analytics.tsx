import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import {
  apiClient,
  type FactionMomentum,
  type IntelligenceGame,
  type IntelligenceMissionTrend,
  type IntelligenceStreak,
  type LeagueIntelligenceData,
  type LeagueRecordValue,
  type RecentUpset,
  type StandingsBattle,
} from '../services/api'

type IntelligenceState =
  | {
      status: 'idle'
    }
  | {
      data: LeagueIntelligenceData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function Analytics() {
  const [intelligenceState, setIntelligenceState] =
    useState<IntelligenceState>({
      status: 'idle',
    })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getAnalytics({
        signal: controller.signal,
      })
      .then((data) => {
        setIntelligenceState({
          data,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setIntelligenceState({
          error:
            error instanceof Error
              ? error.message
              : 'League intelligence could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  if (intelligenceState.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Intelligence loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (intelligenceState.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Intelligence error">
          <p role="alert">{intelligenceState.error}</p>
        </section>
      </main>
    )
  }

  const { data } = intelligenceState

  return (
    <main className="portal-shell">
      <PageHeader />

      <section className="intelligence-grid" aria-label="League intelligence">
        <HotStreaksCard
          losingStreaks={data.losingStreaks}
          winStreaks={data.winStreaks}
        />
        <RecordsCard records={data.records} />
        <MissionMetaCard missions={data.missionTrends} />
        <FactionMomentumCard factions={data.factionMomentum} />
        <BattleCard
          eyebrow="Promotion Race"
          items={data.promotionBattle}
          title="Promotion Race"
        />
        <BattleCard
          eyebrow="Relegation Race"
          items={data.relegationBattle}
          title="Relegation Race"
        />
        <GameListCard
          eyebrow="Biggest Blowouts"
          games={data.biggestVictories}
          metricSuffix=" VP"
          title="Biggest Blowouts"
        />
        <GameListCard
          eyebrow="Closest Matches"
          games={data.closestGames}
          metricSuffix=" VP"
          title="Closest Matches"
        />
        {data.recentUpsets.length > 0 ? (
          <UpsetsCard upsets={data.recentUpsets} />
        ) : null}
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="analytics-title">
      <p className="eyebrow">Analytics</p>
      <h1 id="analytics-title">League Intelligence</h1>
      <p>Live stories, pressure points, meta movement, and race conditions</p>
    </section>
  )
}

function IntelligenceCard({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <section className="panel intelligence-card" aria-labelledby={titleToId(title)}>
      <div className="panel-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <div className="intelligence-card-body">{children}</div>
    </section>
  )
}

function HotStreaksCard({
  losingStreaks,
  winStreaks,
}: {
  losingStreaks: IntelligenceStreak[]
  winStreaks: IntelligenceStreak[]
}) {
  return (
    <IntelligenceCard eyebrow="Hot Streaks" title="Hot Streaks">
      <StoryStack>
        {winStreaks.map((streak) => (
          <StoryLink
            key={`win-${streak.player}`}
            meta={`${streak.games} games`}
            title={streak.player}
            to={playerPath(streak.player)}
          >
            {streak.story}
          </StoryLink>
        ))}
        {losingStreaks.map((streak) => (
          <StoryLink
            key={`loss-${streak.player}`}
            meta={`${streak.games} games`}
            title={streak.player}
            to={playerPath(streak.player)}
          >
            {streak.story}
          </StoryLink>
        ))}
      </StoryStack>
    </IntelligenceCard>
  )
}

function RecordsCard({ records }: { records: Record<string, LeagueRecordValue> }) {
  const recordItems = [
    ['Largest VP Margin', records.largestVPMargin],
    ['Largest OP Margin', records.largestOPMargin],
    ['Highest Scoring Game', records.highestScoringGame],
    ['Lowest Scoring Game', records.lowestScoringGame],
    ['Closest VP Game', records.closestVPGame],
    ['Most Active Player', records.mostActivePlayer],
    ['Most Active Faction', records.mostActiveFaction],
    ['Most Active Mission', records.mostActiveMission],
    ['Best First-Turn Faction', records.bestFirstTurnFaction],
    ['Worst First-Turn Faction', records.worstFirstTurnFaction],
  ] as const

  return (
    <IntelligenceCard eyebrow="League Records" title="League Records">
      <StoryStack>
        {recordItems.map(([label, record]) =>
          record ? (
            <StoryLink
              key={label}
              meta={label}
              title={getRecordTitle(record)}
              to={getRecordPath(record)}
            >
              {record.story}
            </StoryLink>
          ) : null,
        )}
      </StoryStack>
    </IntelligenceCard>
  )
}

function MissionMetaCard({ missions }: { missions: IntelligenceMissionTrend[] }) {
  return (
    <IntelligenceCard eyebrow="Mission Meta" title="Mission Meta">
      <StoryStack>
        {missions.map((mission) => (
          <StoryLink
            key={mission.mission}
            meta={`${mission.games} games · ${formatNumber(
              mission.firstTurnWinRate,
            )}% first-turn wins`}
            title={mission.mission}
            to={missionPath(mission.mission)}
          >
            {mission.story}
          </StoryLink>
        ))}
      </StoryStack>
    </IntelligenceCard>
  )
}

function FactionMomentumCard({ factions }: { factions: FactionMomentum[] }) {
  return (
    <IntelligenceCard eyebrow="Faction Momentum" title="Faction Momentum">
      <StoryStack>
        {factions.map((faction) => (
          <StoryLink
            key={faction.faction}
            meta={faction.trend}
            title={faction.faction}
            to={factionPath(faction.faction)}
          >
            {faction.story}
          </StoryLink>
        ))}
      </StoryStack>
    </IntelligenceCard>
  )
}

function BattleCard({
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
    <IntelligenceCard eyebrow={eyebrow} title={title}>
      <StoryStack>
        {items.map((item) => (
          <StoryLink
            key={`${item.division}-${item.rank}-${item.player}`}
            meta={`${item.division} · Rank #${item.rank}`}
            title={item.player}
            to={playerPath(item.player)}
          >
            {item.story}
          </StoryLink>
        ))}
      </StoryStack>
    </IntelligenceCard>
  )
}

function GameListCard({
  eyebrow,
  games,
  metricSuffix,
  title,
}: {
  eyebrow: string
  games: IntelligenceGame[]
  metricSuffix: string
  title: string
}) {
  return (
    <IntelligenceCard eyebrow={eyebrow} title={title}>
      <StoryStack>
        {games.map((game) => (
          <StoryLink
            key={`${title}-${game.id}`}
            meta={`${game.value}${metricSuffix} · ${game.date}`}
            title={`${game.winner} vs ${game.loser}`}
            to={`/games/${game.id}`}
          >
            {game.story}
          </StoryLink>
        ))}
      </StoryStack>
    </IntelligenceCard>
  )
}

function UpsetsCard({ upsets }: { upsets: RecentUpset[] }) {
  return (
    <IntelligenceCard eyebrow="Latest Upsets" title="Latest Upsets">
      <StoryStack>
        {upsets.map((upset) => (
          <StoryLink
            key={`upset-${upset.id}`}
            meta={`Rank #${upset.winnerRank} over #${upset.loserRank}`}
            title={`${upset.winner} over ${upset.loser}`}
            to={`/games/${upset.id}`}
          >
            {upset.story}
          </StoryLink>
        ))}
      </StoryStack>
    </IntelligenceCard>
  )
}

function StoryStack({ children }: { children: ReactNode }) {
  return <div className="intelligence-story-stack">{children}</div>
}

function StoryLink({
  children,
  meta,
  title,
  to,
}: {
  children: ReactNode
  meta: string
  title: string
  to: string
}) {
  return (
    <Link className="intelligence-story" to={to}>
      <span>{meta}</span>
      <strong>{title}</strong>
      <p>{children}</p>
    </Link>
  )
}

function getRecordTitle(record: NonNullable<LeagueRecordValue>) {
  if ('winner' in record) {
    return `${record.winner} vs ${record.loser}`
  }

  return record.name || record.faction || record.type || 'League Record'
}

function getRecordPath(record: NonNullable<LeagueRecordValue>) {
  if ('winner' in record) {
    return `/games/${record.id}`
  }

  if (record.type === 'player' && record.name) {
    return playerPath(record.name)
  }

  if (record.type === 'faction' && record.name) {
    return factionPath(record.name)
  }

  if (record.type === 'mission' && record.name) {
    return missionPath(record.name)
  }

  if (record.faction) {
    return factionPath(record.faction)
  }

  return '/analytics'
}

function playerPath(player: string) {
  return `/players/${encodeURIComponent(player)}`
}

function factionPath(faction: string) {
  return `/factions/${encodeURIComponent(faction)}`
}

function missionPath(mission: string) {
  return `/missions/${encodeURIComponent(mission)}`
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function titleToId(title: string) {
  return title.toLowerCase().replaceAll(' ', '-')
}

export default Analytics
