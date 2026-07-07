import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BarChart from '../components/BarChart'
import Loading from '../components/Loading'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type HallOfFameCareer,
  type HallOfFameData,
  type HallOfFameLeader,
  type HallOfFameRecordBookItem,
  type HallOfFameSeason,
  type HallOfFameTimelineItem,
  type LeagueRecordValue,
} from '../services/api'
import {
  formatPercentage,
  formatPlayerName,
  formatRecord as formatRecordValue,
} from '../services/formatting'

type HallOfFameState =
  | {
      status: 'idle'
    }
  | {
      data: HallOfFameData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function HallOfFame() {
  const [hallState, setHallState] = useState<HallOfFameState>({
    status: 'idle',
  })
  const [showSecondarySections, setShowSecondarySections] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getHallOfFame({
        signal: controller.signal,
      })
      .then((data) => {
        setHallState({
          data,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setHallState({
          error:
            error instanceof Error
              ? error.message
              : 'Hall of Fame could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (hallState.status !== 'success') {
      return
    }

    const timeout = window.setTimeout(() => {
      setShowSecondarySections(true)
    }, 0)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [hallState.status])

  if (hallState.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <div className="portal-grid">
          <Skeleton label="Hall of Fame loading" rows={6} />
          <section className="dashboard-state" aria-label="Hall of Fame loading">
            <Loading />
          </section>
        </div>
      </main>
    )
  }

  if (hallState.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Hall of Fame error">
          <p role="alert">{hallState.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell hall-museum">
      <PageHeader />
      <MuseumHero data={hallState.data} />

      <section className="command-center-grid" aria-label="Hall of Fame charts">
        <HallChart
          leaders={hallState.data.leaders.tournamentPoints}
          metric="tp"
          title="Tournament Points"
        />
        <HallChart
          leaders={hallState.data.leaders.objectivePoints}
          metric="op"
          title="Objective Points"
        />
        <HallChart
          leaders={hallState.data.leaders.victoryPoints}
          metric="vp"
          title="Victory Points"
        />
      </section>

      <section className="hall-gallery-grid" aria-label="Career leaders">
        <CareerLeaderBoard
          leaders={hallState.data.careerLeaders.achievementPoints}
          metric="achievementPoints"
          title="Most Achievement Points"
        />
        <CareerLeaderBoard
          leaders={hallState.data.careerLeaders.winPercentage}
          metric="winPercentage"
          title="Highest Career Win %"
        />
        <CareerLeaderBoard
          leaders={hallState.data.careerLeaders.promotions}
          metric="promotions"
          title="Most Promotions"
        />
        <CareerLeaderBoard
          leaders={hallState.data.careerLeaders.championships}
          metric="championships"
          title="Career Championships"
        />
      </section>

      {showSecondarySections ? (
        <>
          <section className="hall-gallery-grid" aria-label="League history">
            <CareerMuseum careers={hallState.data.playerCareers} />
            <RecordBook records={hallState.data.recordBook} />
          </section>

          <section className="hall-gallery-grid" aria-label="Season history and legacy timeline">
            <SeasonArchive seasons={hallState.data.seasonHistory} />
            <LeagueHistoryTimeline items={hallState.data.leagueHistory} />
          </section>

          <section className="intelligence-grid" aria-label="Hall of Fame records">
            <LeaderBoard title="Most Wins" leaders={hallState.data.leaders.wins} />
            <LeaderBoard title="Most Games" leaders={hallState.data.leaders.games} />
            <RecordsList records={hallState.data.records} />
          </section>
        </>
      ) : (
        <section className="portal-grid" aria-label="Hall of Fame archives loading">
          <Skeleton label="Hall of Fame archives loading" rows={4} />
        </section>
      )}
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="hall-title">
      <p className="eyebrow">League Museum</p>
      <h1 id="hall-title">Hall of Fame & Career</h1>
      <p>Historical records, career milestones, season archives, and legacy achievements</p>
    </section>
  )
}

function MuseumHero({ data }: { data: HallOfFameData }) {
  const champion = data.leaders.tournamentPoints[0]
  const careerLeader = data.careerLeaders.achievementPoints[0]
  const mostGames = data.leaders.games[0]

  return (
    <section className="hall-hero panel" aria-label="Hall of Fame museum summary">
      <div>
        <p className="eyebrow">Featured Legacy</p>
        <h2>
          {champion
            ? formatPlayerName(champion.player, champion.displayName)
            : 'Awaiting Champion'}
        </h2>
        <p>
          {champion
            ? `${champion.division} leader with ${champion.tp} TP, ${champion.op} OP, and ${champion.vp} VP.`
            : 'League champion history will populate as seasons are archived.'}
        </p>
      </div>
      <dl>
        <div>
          <dt>Career Point Leader</dt>
          <dd>
            {careerLeader
              ? formatPlayerName(careerLeader.player, careerLeader.displayName)
              : 'Not established'}
          </dd>
        </div>
        <div>
          <dt>Most Games</dt>
          <dd>
            {mostGames
              ? `${formatPlayerName(mostGames.player, mostGames.displayName)} / ${mostGames.games}`
              : 'Not established'}
          </dd>
        </div>
        <div>
          <dt>Season Archives</dt>
          <dd>{data.seasonHistory.length}</dd>
        </div>
      </dl>
    </section>
  )
}

function HallChart({
  leaders,
  metric,
  title,
}: {
  leaders: HallOfFameLeader[]
  metric: 'op' | 'tp' | 'vp'
  title: string
}) {
  return (
    <section className="panel command-card" aria-labelledby={titleToId(title)}>
      <div className="panel-heading">
        <p className="eyebrow">Trophy Chart</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <div className="intelligence-card-body">
        <BarChart
          points={leaders.slice(0, 6).map((leader) => ({
            label: formatPlayerName(leader.player, leader.displayName),
            meta: leader.division,
            to: `/players/${encodeURIComponent(leader.player)}`,
            value: leader[metric],
          }))}
          title={title}
        />
      </div>
    </section>
  )
}

function CareerLeaderBoard({
  leaders,
  metric,
  title,
}: {
  leaders: HallOfFameCareer[]
  metric: keyof Pick<
    HallOfFameCareer,
    'achievementPoints' | 'awards' | 'championships' | 'promotions' | 'seasonsPlayed' | 'winPercentage'
  >
  title: string
}) {
  return (
    <section className="panel hall-trophy-card" aria-labelledby={titleToId(title)}>
      <div className="panel-heading">
        <p className="eyebrow">Career</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <div className="leader-stack">
        {leaders.length === 0 ? (
          <p className="operations-empty">No historical entries yet.</p>
        ) : (
          leaders.slice(0, 8).map((leader, index) => (
            <Link
              className="leader-row"
              key={`${title}-${leader.player}`}
              to={`/players/${encodeURIComponent(leader.player)}`}
            >
              <span>#{index + 1}</span>
              <strong>{formatPlayerName(leader.player, leader.displayName)}</strong>
              <small>{leader.division}</small>
              <b>{metric === 'winPercentage' ? formatPercentage(leader[metric]) : leader[metric]}</b>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}

function CareerMuseum({ careers }: { careers: HallOfFameCareer[] }) {
  return (
    <section className="panel hall-trophy-card" aria-labelledby="career-museum">
      <div className="panel-heading">
        <p className="eyebrow">Player Legacy</p>
        <h2 id="career-museum">Career Museum</h2>
      </div>
      <div className="hall-career-grid">
        {careers.slice(0, 8).map((career) => (
          <Link
            className="hall-career-card"
            key={career.player}
            to={`/players/${encodeURIComponent(career.player)}`}
          >
            <span>{career.division}</span>
            <h3>{formatPlayerName(career.player, career.displayName)}</h3>
            <dl>
              <div>
                <dt>Career Record</dt>
                <dd>{formatRecordValue(career.wins, career.losses)}</dd>
              </div>
              <div>
                <dt>Games</dt>
                <dd>{career.games}</dd>
              </div>
              <div>
                <dt>Achievement Points</dt>
                <dd>{career.achievementPoints}</dd>
              </div>
              <div>
                <dt>Seasons</dt>
                <dd>{career.seasonsPlayed}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </section>
  )
}

function RecordBook({ records }: { records: HallOfFameRecordBookItem[] }) {
  return (
    <section className="panel hall-trophy-card" aria-labelledby="record-book">
      <div className="panel-heading">
        <p className="eyebrow">Permanent Archive</p>
        <h2 id="record-book">Record Book</h2>
      </div>
      <div className="hall-record-book">
        {records.map((record) => (
          <article className="operations-record" key={record.title}>
            <span>{record.title}</span>
            <h3>{record.holder || 'Not established'}</h3>
            <p>{record.value}</p>
            <small>{record.story}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

function SeasonArchive({ seasons }: { seasons: HallOfFameSeason[] }) {
  return (
    <section className="panel hall-trophy-card" aria-labelledby="season-archive">
      <div className="panel-heading">
        <p className="eyebrow">Season History</p>
        <h2 id="season-archive">Season Archive</h2>
      </div>
      <div className="hall-season-grid">
        {seasons.map((season) => (
          <details className="hall-season-card" key={`${season.season}-${season.date}`}>
            <summary>
              <span>{season.season}</span>
              <strong>{season.movement || 'Archived'}</strong>
            </summary>
            <dl>
              <div>
                <dt>Division</dt>
                <dd>{season.division}</dd>
              </div>
              <div>
                <dt>Final Rank</dt>
                <dd>{season.finalRank || 'Pending'}</dd>
              </div>
              <div>
                <dt>Record</dt>
                <dd>{season.record || 'Pending'}</dd>
              </div>
              <div>
                <dt>TP / OP / VP</dt>
                <dd>
                  {season.tp} / {season.op} / {season.vp}
                </dd>
              </div>
              <div>
                <dt>Achievements</dt>
                <dd>{season.achievementsEarned}</dd>
              </div>
              <div>
                <dt>Army Lists</dt>
                <dd>{season.armyListsSubmitted}</dd>
              </div>
            </dl>
            <p>{season.details}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function LeagueHistoryTimeline({ items }: { items: HallOfFameTimelineItem[] }) {
  return (
    <section className="panel hall-trophy-card" aria-labelledby="league-history">
      <div className="panel-heading">
        <p className="eyebrow">League History</p>
        <h2 id="league-history">Historical Timeline</h2>
      </div>
      <div className="profile-timeline-list">
        {items.map((item, index) => (
          <article className="profile-timeline-card" key={item.id || `${item.type}-${index}`}>
            <span>{item.type}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <small>{item.timestamp}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

function LeaderBoard({
  leaders,
  title,
}: {
  leaders: HallOfFameLeader[]
  title: string
}) {
  return (
    <section className="panel intelligence-card" aria-labelledby={titleToId(title)}>
      <div className="panel-heading">
        <p className="eyebrow">Hall of Fame</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <div className="intelligence-card-body">
        <div className="leader-stack">
          {leaders.slice(0, 8).map((leader, index) => (
            <Link
              className="leader-row"
              key={`${title}-${leader.player}`}
              to={`/players/${encodeURIComponent(leader.player)}`}
            >
              <span>#{index + 1}</span>
              <strong>{formatPlayerName(leader.player, leader.displayName)}</strong>
              <small>{leader.division}</small>
              <b>{title === 'Most Wins' ? leader.wins : leader.games}</b>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function RecordsList({
  records,
}: {
  records: Record<string, LeagueRecordValue>
}) {
  const entries = Object.entries(records).filter((entry) => entry[1] !== null)

  return (
    <section className="panel intelligence-card" aria-labelledby="records-engine">
      <div className="panel-heading">
        <p className="eyebrow">Records Engine</p>
        <h2 id="records-engine">League Records</h2>
      </div>
      <div className="intelligence-card-body">
        <div className="intelligence-story-stack">
          {entries.map(([key, record]) => (
            <RecordLink key={key} record={record}>
              {formatRecordLabel(key)}
            </RecordLink>
          ))}
        </div>
      </div>
    </section>
  )
}

function RecordLink({
  children,
  record,
}: {
  children: ReactNode
  record: LeagueRecordValue
}) {
  if (!record) {
    return null
  }

  const path =
    'id' in record
      ? `/games/${record.id}`
      : record.type === 'player' && record.name
        ? `/players/${encodeURIComponent(record.name)}`
        : record.type === 'faction' && record.name
          ? `/factions/${encodeURIComponent(record.name)}`
          : record.type === 'mission' && record.name
            ? `/missions/${encodeURIComponent(record.name)}`
            : record.faction
              ? `/factions/${encodeURIComponent(record.faction)}`
              : '/hall-of-fame'

  return (
    <Link className="intelligence-story" to={path}>
      <span>{children}</span>
      <strong>{getRecordTitle(record)}</strong>
      <p>{record.story}</p>
    </Link>
  )
}

function getRecordTitle(record: NonNullable<LeagueRecordValue>) {
  if ('winner' in record) {
    return `${record.winner} vs ${record.loser}`
  }

  return record.name || record.faction || record.type || 'League Record'
}

function formatRecordLabel(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (text) => text.toUpperCase())
}

function titleToId(title: string) {
  return title.toLowerCase().replaceAll(' ', '-')
}

export default HallOfFame
