import { useEffect, useMemo, useState } from 'react'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type ArmyIntelligenceCount,
  type ArmyIntelligenceData,
  type ArmyIntelligenceList,
} from '../services/api'

type ArmyIntelligenceState =
  | {
      status: 'loading'
    }
  | {
      data: ArmyIntelligenceData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function ArmyIntelligence() {
  const [state, setState] = useState<ArmyIntelligenceState>({
    status: 'loading',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getArmyIntelligence({
        signal: controller.signal,
      })
      .then((data) => {
        setState({
          data,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Army Intelligence could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <main className="portal-shell army-intelligence-page">
        <PageHeader />
        <section className="army-intelligence-summary" aria-label="Army Intelligence loading">
          <Skeleton label="Army Intelligence summary loading" rows={5} />
          <Skeleton label="Army Intelligence faction data loading" rows={5} />
          <Skeleton label="Army Intelligence unit data loading" rows={5} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell army-intelligence-page">
        <PageHeader />
        <section className="dashboard-state" aria-label="Army Intelligence error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return <ArmyIntelligenceContent data={state.data} />
}

function ArmyIntelligenceContent({ data }: { data: ArmyIntelligenceData }) {
  const [selectedSectorial, setSelectedSectorial] = useState('')
  const sectorials = useMemo(
    () =>
      Array.from(
        new Set(
          data.lists
            .map((list) => getListSectorial(list))
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [data.lists],
  )
  const filteredLists = useMemo(
    () =>
      selectedSectorial
        ? data.lists.filter((list) =>
            selectedSectorial === 'all'
              ? true
              : isListAttributedToSectorial(list, selectedSectorial),
          )
        : [],
    [data.lists, selectedSectorial],
  )
  const decodedLists = useMemo(
    () => filteredLists.filter((list) => list.status === 'decoded' && list.decoded),
    [filteredLists],
  )
  const pendingLists = filteredLists.filter((list) => list.status === 'pending')
  const failedLists = filteredLists.filter((list) => list.status === 'failed')
  const unassignedIssueLists = useMemo(
    () =>
      selectedSectorial && selectedSectorial !== 'all'
        ? data.lists.filter(
            (list) =>
              (list.status === 'pending' || list.status === 'failed') &&
              !isListAttributedToSectorial(list, selectedSectorial),
          )
        : [],
    [data.lists, selectedSectorial],
  )
  const summary = useMemo(() => buildFilteredSummary(filteredLists), [filteredLists])

  return (
    <main className="portal-shell army-intelligence-page">
      <PageHeader />

      <SectorialSelector
        onChange={setSelectedSectorial}
        sectorials={sectorials}
        value={selectedSectorial}
      />

      {!selectedSectorial ? (
        <section className="panel army-intelligence-empty" aria-label="Select a sectorial">
          <p>Select a sectorial to review decoded list trends, unit usage, and specialist roles.</p>
        </section>
      ) : (
        <>

      <section className="army-intelligence-summary" aria-label="Army Intelligence summary">
        <MetricCard label="Decoded Lists" value={summary.decodedLists} />
        <MetricCard label="Pending" value={summary.pendingLists} />
        <MetricCard label="Failed" value={summary.failedLists} />
        <MetricCard label="Average Points" value={summary.averagePoints} />
        <MetricCard label="Average SWC" value={summary.averageSwc} />
        <MetricCard label="Combat Groups" value={summary.averageCombatGroups} />
        <MetricCard label="Regular Orders" value={summary.averageRegularOrders} />
        <MetricCard label="Irregular Orders" value={summary.averageIrregularOrders} />
      </section>

      <section className="army-intelligence-grid" aria-label="Army Intelligence aggregates">
        <CountPanel items={summary.units} limit={12} title="Most-Used Units" />
        <CountPanel items={summary.lieutenants} title="Lieutenant Choices" />
        <CountPanel items={summary.hackers} title="Hackers" />
        <CountPanel items={summary.specialists} title="Specialists" />
        <CountPanel items={summary.doctorsEngineers} title="Doctors / Engineers" />
      </section>

      <section className="panel army-intelligence-lists" aria-labelledby="decoded-lists-title">
        <div className="army-intelligence-section-heading">
          <div>
            <p className="eyebrow">Decoded Snapshots</p>
            <h2 id="decoded-lists-title">Submitted Lists</h2>
          </div>
          <strong>{decodedLists.length} decoded</strong>
        </div>
        <div className="army-intelligence-list-table" role="table" aria-label="Decoded army lists">
          <div role="row">
            <span role="columnheader">Player</span>
            <span role="columnheader">Faction</span>
            <span role="columnheader">List</span>
            <span role="columnheader">Totals</span>
          </div>
          {decodedLists.map((list) => (
            <DecodedListRow key={list.snapshotKey} list={list} />
          ))}
        </div>
      </section>

      {(pendingLists.length > 0 || failedLists.length > 0) && (
        <section className="army-intelligence-grid" aria-label="Pending and failed decodes">
          <StatusPanel lists={pendingLists} status="pending" title="Pending Decodes" />
          <StatusPanel lists={failedLists} status="failed" title="Failed Decodes" />
        </section>
      )}
      {unassignedIssueLists.length > 0 && (
        <section className="panel army-intelligence-unassigned" aria-labelledby="unassigned-decodes-title">
          <div className="army-intelligence-section-heading">
            <div>
              <p className="eyebrow">Unassigned</p>
              <h2 id="unassigned-decodes-title">Decode Issues</h2>
            </div>
            <strong>Not attributed to {selectedSectorial}</strong>
          </div>
          <p>
            These pending or failed decode snapshots do not currently have enough faction
            or sectorial metadata to associate them with the selected sectorial.
          </p>
          <ol>
            {unassignedIssueLists.slice(0, 8).map((list) => (
              <li key={list.snapshotKey}>
                <span>{list.player || list.snapshotKey}</span>
                <strong>{list.status === 'failed' ? list.error || 'Decode failed' : 'Pending'}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}
        </>
      )}
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="army-intelligence-title">
      <p className="eyebrow">Intelligence</p>
      <h1 id="army-intelligence-title">Army Intelligence</h1>
      <p>Decoded snapshots from submitted League, Casual, Tournament, and Army List Library codes</p>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="army-intelligence-metric">
      <span>{label}</span>
      <strong>{Number.isInteger(value) ? value : value.toFixed(1)}</strong>
    </article>
  )
}

function SectorialSelector({
  onChange,
  sectorials,
  value,
}: {
  onChange: (value: string) => void
  sectorials: string[]
  value: string
}) {
  return (
    <section className="panel army-intelligence-selector" aria-label="Army Intelligence sectorial selector">
      <label>
        <span>Select Sectorial</span>
        <select onChange={(event) => onChange(event.target.value)} value={value}>
          <option value="">Choose a sectorial</option>
          <option value="all">All Sectorials</option>
          {sectorials.map((sectorial) => (
            <option key={sectorial} value={sectorial}>
              {sectorial}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}

function CountPanel({
  items,
  limit = 8,
  title,
}: {
  items: ArmyIntelligenceCount[]
  limit?: number
  title: string
}) {
  const visible = items.slice(0, limit)

  return (
    <section className="panel army-intelligence-panel" aria-labelledby={`${slugify(title)}-title`}>
      <h2 id={`${slugify(title)}-title`}>{title}</h2>
      {visible.length === 0 ? (
        <p>No decoded data yet.</p>
      ) : (
        <ol>
          {visible.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function DecodedListRow({ list }: { list: ArmyIntelligenceList }) {
  const decoded = list.decoded

  return (
    <div role="row">
      <span role="cell">{list.player}</span>
      <span role="cell">{list.sectorial || list.faction || 'Not recorded'}</span>
      <span role="cell">{decoded?.listName || 'Unnamed list'}</span>
      <span role="cell">
        {decoded
          ? `${decoded.totals.points} pts / ${decoded.totals.swc} SWC / ${decoded.totals.combatGroups} groups`
          : 'Pending'}
      </span>
    </div>
  )
}

function StatusPanel({
  lists,
  status,
  title,
}: {
  lists: ArmyIntelligenceList[]
  status: 'failed' | 'pending'
  title: string
}) {
  return (
    <section className={`panel army-intelligence-panel is-${status}`} aria-labelledby={`${status}-decodes-title`}>
      <h2 id={`${status}-decodes-title`}>{title}</h2>
      {lists.length === 0 ? (
        <p>No {status} decodes.</p>
      ) : (
        <ol>
          {lists.slice(0, 8).map((list) => (
            <li key={list.snapshotKey}>
              <span>{list.player || list.snapshotKey}</span>
              <strong>{status === 'failed' ? list.error || 'Decode failed' : 'Pending'}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function getListSectorial(list: ArmyIntelligenceList) {
  return list.decoded?.sectorial || list.sectorial || list.faction
}

function isListAttributedToSectorial(list: ArmyIntelligenceList, sectorial: string) {
  if (list.status === 'decoded') {
    return getListSectorial(list) === sectorial
  }

  return list.sectorial === sectorial
}

function buildFilteredSummary(lists: ArmyIntelligenceList[]) {
  const decodedLists = lists.filter((list) => list.status === 'decoded' && list.decoded)
  const entries = decodedLists.flatMap((list) =>
    list.decoded?.combatGroups.flatMap((group) => group.entries) ?? [],
  )

  return {
    averageCombatGroups: average(
      decodedLists.map((list) => list.decoded?.totals.combatGroups ?? 0),
    ),
    averageIrregularOrders: average(
      decodedLists.map((list) => list.decoded?.orderCounts.irregular ?? 0),
    ),
    averagePoints: average(
      decodedLists.map((list) => list.decoded?.totals.points ?? 0),
    ),
    averageRegularOrders: average(
      decodedLists.map((list) => list.decoded?.orderCounts.regular ?? 0),
    ),
    averageSwc: average(decodedLists.map((list) => list.decoded?.totals.swc ?? 0)),
    decodedLists: decodedLists.length,
    doctorsEngineers: countEntries(
      entries.filter((entry) => entry.doctor || entry.engineer).map((entry) => entry.unit),
    ),
    factions: countEntries(decodedLists.map((list) => list.faction)),
    failedLists: lists.filter((list) => list.status === 'failed').length,
    hackers: countEntries(entries.filter((entry) => entry.hacker).map((entry) => entry.unit)),
    lieutenants: countEntries(
      entries.filter((entry) => entry.lieutenant).map((entry) => entry.unit),
    ),
    pendingLists: lists.filter((list) => list.status === 'pending').length,
    sectorials: countEntries(decodedLists.map((list) => getListSectorial(list))),
    specialists: countEntries(
      entries.filter((entry) => entry.specialist).map((entry) => entry.unit),
    ),
    units: countEntries(entries.map((entry) => entry.unit)),
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10
}

function countEntries(values: string[]): ArmyIntelligenceCount[] {
  const counts = new Map<string, number>()

  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    })

  return Array.from(counts.entries())
    .map(([name, count]) => ({ count, name }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
}

export default ArmyIntelligence
