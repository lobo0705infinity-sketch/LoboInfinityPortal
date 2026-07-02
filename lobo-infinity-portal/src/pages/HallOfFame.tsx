import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BarChart from '../components/BarChart'
import Loading from '../components/Loading'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type HallOfFameData,
  type HallOfFameLeader,
  type LeagueRecordValue,
} from '../services/api'

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
    <main className="portal-shell">
      <PageHeader />

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

      <section className="intelligence-grid" aria-label="Hall of Fame records">
        <LeaderBoard title="Most Wins" leaders={hallState.data.leaders.wins} />
        <LeaderBoard title="Most Games" leaders={hallState.data.leaders.games} />
        <RecordsList records={hallState.data.records} />
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="hall-title">
      <p className="eyebrow">Records Engine</p>
      <h1 id="hall-title">Hall of Fame</h1>
      <p>Live league leaders and all-time records from reported games</p>
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
        <p className="eyebrow">Chart</p>
        <h2 id={titleToId(title)}>{title}</h2>
      </div>
      <div className="intelligence-card-body">
        <BarChart
          points={leaders.slice(0, 6).map((leader) => ({
            label: leader.player,
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
              <strong>{leader.player}</strong>
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
