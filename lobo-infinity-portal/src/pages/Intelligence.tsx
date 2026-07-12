import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import { filterCanonicalMissionRecords } from '../config/missions'
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
import { formatObjectiveScore, formatPlayerName } from '../services/formatting'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') || ''
  const gameType = normalizeGameTypeFilter(searchParams.get('gameType'))
  const handleGameTypeChange = (value: GameTypeFilter) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'league') {
      next.delete('gameType')
    } else {
      next.set('gameType', value)
    }
    setSearchParams(next)
  }
  const [intelligenceState, setIntelligenceState] =
    useState<IntelligenceState>({
      status: 'idle',
    })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getAnalytics({
        eventId,
        gameType,
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
  }, [eventId, gameType])

  if (intelligenceState.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader
          eventScoped={Boolean(eventId)}
          gameType={gameType}
          onGameTypeChange={handleGameTypeChange}
        />
        <section className="intelligence-grid" aria-label="Event intelligence loading">
          <Skeleton label="Hot streaks loading" rows={5} />
          <Skeleton label="Records loading" rows={5} />
          <Skeleton label="Mission meta loading" rows={5} />
          <Skeleton label="Faction momentum loading" rows={5} />
        </section>
      </main>
    )
  }

  if (intelligenceState.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader
          eventScoped={Boolean(eventId)}
          gameType={gameType}
          onGameTypeChange={handleGameTypeChange}
        />
        <section className="dashboard-state" aria-label="Intelligence error">
          <p role="alert">{intelligenceState.error}</p>
        </section>
      </main>
    )
  }

  const { data } = intelligenceState

  return (
    <main className="portal-shell">
      <PageHeader
        eventScoped={Boolean(eventId)}
        gameType={gameType}
        onGameTypeChange={handleGameTypeChange}
      />

      <section className="intelligence-grid" aria-label="Event intelligence">
        <HotStreaksCard
          losingStreaks={data.losingStreaks}
          winStreaks={data.winStreaks}
        />
        <RecordsCard records={data.records} />
        <MissionMetaCard missions={filterCanonicalMissionRecords(data.missionTrends)} />
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
          title="Biggest Blowouts"
        />
        <GameListCard
          eyebrow="Closest Matches"
          games={data.closestGames}
          title="Closest Matches"
        />
        {data.recentUpsets.length > 0 ? (
          <UpsetsCard upsets={data.recentUpsets} />
        ) : null}
      </section>
    </main>
  )
}

type GameTypeFilter = 'league' | 'tournament' | 'casual' | 'all'

function PageHeader({
  eventScoped,
  gameType,
  onGameTypeChange,
}: {
  eventScoped: boolean
  gameType: GameTypeFilter
  onGameTypeChange: (value: GameTypeFilter) => void
}) {
  return (
    <section className="page-header" aria-labelledby="analytics-title">
      <p className="eyebrow">Analytics</p>
      <h1 id="analytics-title">{eventScoped ? 'Event Intelligence' : 'League Intelligence'}</h1>
      <p>Live stories, pressure points, meta movement, and race conditions</p>
      <label className="dashboard-filter-control">
        <span>Game Type</span>
        <select
          onChange={(event) => onGameTypeChange(event.target.value as GameTypeFilter)}
          value={gameType}
        >
          <option value="league">League</option>
          <option value="tournament">Tournament</option>
          <option value="casual">Casual</option>
          <option value="all">All Games</option>
        </select>
      </label>
    </section>
  )
}

function normalizeGameTypeFilter(value: string | null): GameTypeFilter {
  if (value === 'tournament' || value === 'casual' || value === 'all') {
    return value
  }

  return 'league'
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
            title={formatPlayerName(streak.player, streak.displayName)}
            to={playerPath(streak.player)}
          >
            {streak.story}
          </StoryLink>
        ))}
        {losingStreaks.map((streak) => (
          <StoryLink
            key={`loss-${streak.player}`}
            meta={`${streak.games} games`}
            title={formatPlayerName(streak.player, streak.displayName)}
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
    ['Largest OP Scoreline Margin', records.largestVPMargin],
    ['Largest OP Margin', records.largestOPMargin],
    ['Highest Scoring Game', records.highestScoringGame],
    ['Lowest Scoring Game', records.lowestScoringGame],
    ['Closest OP Game', records.closestVPGame],
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
            meta={`${mission.games} games / ${formatNumber(
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
            meta={`${item.division} / Rank #${item.rank}`}
            title={formatPlayerName(item.player, item.displayName)}
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
  title,
}: {
  eyebrow: string
  games: IntelligenceGame[]
  title: string
}) {
  return (
    <IntelligenceCard eyebrow={eyebrow} title={title}>
      <StoryStack>
        {games.map((game) => (
          <StoryLink
            key={`${title}-${game.id}`}
            meta={`${formatObjectiveScore({ op: game.value })} / ${game.date}`}
            title={`${formatPlayerName(game.winner, game.winnerDisplayName)} vs ${formatPlayerName(game.loser, game.loserDisplayName)}`}
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
            title={`${formatPlayerName(upset.winner, upset.winnerDisplayName)} over ${formatPlayerName(upset.loser, upset.loserDisplayName)}`}
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
    return `${formatPlayerName(record.winner, record.winnerDisplayName)} vs ${formatPlayerName(record.loser, record.loserDisplayName)}`
  }

  return record.displayName || record.name || record.faction || record.type || 'League Record'
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

  return '/intelligence'
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
