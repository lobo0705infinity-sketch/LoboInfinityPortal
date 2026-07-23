import { type ReactNode, useEffect, useMemo, useState } from 'react'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type ArmyIntelligenceData,
  type ArmyIntelligenceDecodedEntry,
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

type AnalysisResultFilter = 'all' | 'winning' | 'losing'

type UsageRow = {
  listCount: number
  name: string
  percentage: number
  totalSelections: number
}

type ArmyAnalysis = {
  averageCombatGroups: number
  averageImpetuousOrders: number
  averageIrregularOrders: number
  averageLieutenantOrders: number
  averagePoints: number
  averageRegularOrders: number
  averageSwc: number
  averageTacticalAwarenessOrders: number
  doctors: UsageRow[]
  engineers: UsageRow[]
  hackers: UsageRow[]
  lieutenants: UsageRow[]
  listCount: number
  modelUsage: UsageRow[]
  specialists: UsageRow[]
}

const resultFilterOptions: Array<{
  label: string
  value: AnalysisResultFilter
}> = [
  {
    label: 'All Army Lists',
    value: 'all',
  },
  {
    label: 'Army Lists with a Winning Record',
    value: 'winning',
  },
  {
    label: 'Army Lists with a Losing Record',
    value: 'losing',
  },
]

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
          <Skeleton label="Army Intelligence controls loading" rows={3} />
          <Skeleton label="Army Intelligence metrics loading" rows={5} />
          <Skeleton label="Army Intelligence model usage loading" rows={5} />
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
  const [resultFilter, setResultFilter] = useState<AnalysisResultFilter>('all')
  const decodedLists = useMemo(
    () => data.lists.filter(isDecodedList),
    [data.lists],
  )
  const sectorials = useMemo(
    () =>
      Array.from(new Set(decodedLists.map((list) => getDecodedSectorial(list)).filter(Boolean)))
        .sort((left, right) => left.localeCompare(right)),
    [decodedLists],
  )
  const matchingLists = useMemo(
    () =>
      selectedSectorial
        ? decodedLists
            .filter((list) => getDecodedSectorial(list) === selectedSectorial)
            .filter((list) => matchesResultFilter(list, resultFilter))
        : [],
    [decodedLists, resultFilter, selectedSectorial],
  )
  const analysis = useMemo(() => buildArmyAnalysis(matchingLists), [matchingLists])

  return (
    <main className="portal-shell army-intelligence-page">
      <PageHeader />

      <section className="panel army-intelligence-selector" aria-label="Army Intelligence analysis controls">
        <label>
          <span>Select Sectorial</span>
          <select onChange={(event) => setSelectedSectorial(event.target.value)} value={selectedSectorial}>
            <option value="">Choose a sectorial</option>
            {sectorials.map((sectorial) => (
              <option key={sectorial} value={sectorial}>
                {sectorial}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Analyze</span>
          <select
            onChange={(event) => setResultFilter(event.target.value as AnalysisResultFilter)}
            value={resultFilter}
          >
            {resultFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!selectedSectorial ? (
        <section className="panel army-intelligence-empty" aria-label="Choose a sectorial">
          <p>Choose a sectorial to view army-list analysis.</p>
        </section>
      ) : matchingLists.length === 0 ? (
        <section className="panel army-intelligence-empty" aria-label="No matching army lists">
          <p>No decoded army lists match the selected sectorial and result filter.</p>
        </section>
      ) : (
        <>
          <section className="army-intelligence-summary" aria-label="Army Intelligence analysis summary">
            <MetricCard label="Army Lists Analyzed" value={analysis.listCount} />
            <MetricCard label="Average Regular Orders" value={analysis.averageRegularOrders} />
            <MetricCard label="Average Irregular Orders" value={analysis.averageIrregularOrders} />
            <MetricCard label="Average Impetuous Orders" value={analysis.averageImpetuousOrders} />
            <MetricCard label="Average Tactical Awareness" value={analysis.averageTacticalAwarenessOrders} />
            <MetricCard label="Average Lieutenant Bonus" value={analysis.averageLieutenantOrders} />
            <MetricCard label="Average Points" value={analysis.averagePoints} />
            <MetricCard label="Average SWC" value={analysis.averageSwc} />
          </section>

          <UsagePanel items={analysis.modelUsage} title="Model Usage" variant="wide" />

          <section className="army-intelligence-grid" aria-label="Role usage breakdowns">
            <ResponsiveDisclosure title="Lieutenant Choices">
              <UsagePanel items={analysis.lieutenants} title="Lieutenant Choices" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Hackers">
              <UsagePanel items={analysis.hackers} title="Hackers" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Specialists">
              <UsagePanel items={analysis.specialists} title="Specialists" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Doctors">
              <UsagePanel items={analysis.doctors} title="Doctors" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Engineers">
              <UsagePanel items={analysis.engineers} title="Engineers" titleHidden />
            </ResponsiveDisclosure>
          </section>
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
      <p>Sectorial list-building analysis from decoded submitted army codes</p>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="army-intelligence-metric">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </article>
  )
}

function UsagePanel({
  items,
  titleHidden,
  title,
  variant,
}: {
  items: UsageRow[]
  titleHidden?: boolean
  title: string
  variant?: 'wide'
}) {
  const visible = items.slice(0, variant === 'wide' ? 24 : 10)

  return (
    <section
      className={`${titleHidden ? '' : 'panel '}army-intelligence-panel${titleHidden ? ' army-intelligence-panel-embedded' : ''}${variant === 'wide' ? ' army-intelligence-panel-wide' : ''}`}
      aria-labelledby={titleHidden ? undefined : `${slugify(title)}-title`}
    >
      {!titleHidden ? (
        <h2 id={`${slugify(title)}-title`}>{title}</h2>
      ) : null}
      {visible.length === 0 ? (
        <p>No matching decoded usage.</p>
      ) : (
        <ol className="army-intelligence-usage-list">
          {visible.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{item.totalSelections}</strong>
              <small>
                {item.listCount} lists / {formatNumber(item.percentage)}%
              </small>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function ResponsiveDisclosure({
  children,
  count,
  title,
  variant,
}: {
  children: ReactNode
  count?: number
  title: string
  variant?: 'warning'
}) {
  const [open, setOpen] = useState(() =>
    typeof window === 'undefined'
      ? true
      : !window.matchMedia('(max-width: 720px)').matches,
  )

  return (
    <section
      className={`panel army-intelligence-disclosure${variant === 'warning' ? ' is-warning' : ''}`}
      data-open={open ? 'true' : 'false'}
    >
      <button
        aria-expanded={open}
        className="army-intelligence-disclosure-toggle"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{title}</span>
        {typeof count === 'number' ? <strong>{count}</strong> : null}
      </button>
      <div className="army-intelligence-disclosure-content" hidden={!open}>
        {children}
      </div>
    </section>
  )
}

function isDecodedList(list: ArmyIntelligenceList) {
  return list.status === 'decoded' && Boolean(list.decoded)
}

function getDecodedSectorial(list: ArmyIntelligenceList) {
  return list.decoded?.sectorial || ''
}

function matchesResultFilter(list: ArmyIntelligenceList, filter: AnalysisResultFilter) {
  if (filter === 'all') {
    return true
  }

  const result = list.result.trim().toLowerCase()

  if (filter === 'winning') {
    return result === 'win'
  }

  return result === 'loss'
}

function buildArmyAnalysis(lists: ArmyIntelligenceList[]): ArmyAnalysis {
  const decodedLists = lists.filter((list): list is ArmyIntelligenceList & { decoded: NonNullable<ArmyIntelligenceList['decoded']> } =>
    Boolean(list.decoded),
  )
  const entriesByList = decodedLists.map((list) =>
    list.decoded.combatGroups.flatMap((group) => group.entries),
  )

  return {
    averageCombatGroups: average(decodedLists.map((list) => list.decoded.totals.combatGroups)),
    averageImpetuousOrders: average(decodedLists.map((list) => list.decoded.orderCounts.impetuous)),
    averageIrregularOrders: average(decodedLists.map((list) => list.decoded.orderCounts.irregular)),
    averageLieutenantOrders: average(decodedLists.map((list) => list.decoded.orderCounts.lieutenant)),
    averagePoints: average(decodedLists.map((list) => list.decoded.totals.points)),
    averageRegularOrders: average(decodedLists.map((list) => list.decoded.orderCounts.regular)),
    averageSwc: average(decodedLists.map((list) => list.decoded.totals.swc)),
    averageTacticalAwarenessOrders: average(
      entriesByList.map((listEntries) =>
        listEntries.reduce((total, entry) => total + countTacticalAwarenessOrders(entry), 0),
      ),
    ),
    doctors: buildUsageRows(entriesByList, (entry) => entry.doctor),
    engineers: buildUsageRows(entriesByList, (entry) => entry.engineer),
    hackers: buildUsageRows(entriesByList, (entry) => entry.hacker),
    lieutenants: buildUsageRows(entriesByList, (entry) => entry.lieutenant),
    listCount: decodedLists.length,
    modelUsage: buildUsageRows(entriesByList),
    specialists: buildUsageRows(entriesByList, (entry) => entry.specialist),
  }
}

function buildUsageRows(
  entriesByList: ArmyIntelligenceDecodedEntry[][],
  predicate: (entry: ArmyIntelligenceDecodedEntry) => boolean = () => true,
): UsageRow[] {
  const totalSelections = new Map<string, number>()
  const listAppearances = new Map<string, number>()

  entriesByList.forEach((entries) => {
    const seenInList = new Set<string>()

    entries.filter(predicate).forEach((entry) => {
      const name = getModelName(entry)

      if (!name) {
        return
      }

      totalSelections.set(name, (totalSelections.get(name) ?? 0) + 1)
      seenInList.add(name)
    })

    seenInList.forEach((name) => {
      listAppearances.set(name, (listAppearances.get(name) ?? 0) + 1)
    })
  })

  return Array.from(totalSelections.entries())
    .map(([name, total]) => {
      const listCount = listAppearances.get(name) ?? 0

      return {
        listCount,
        name,
        percentage: entriesByList.length ? (listCount / entriesByList.length) * 100 : 0,
        totalSelections: total,
      }
    })
    .sort(
      (left, right) =>
        right.totalSelections - left.totalSelections ||
        right.listCount - left.listCount ||
        left.name.localeCompare(right.name),
    )
}

function getModelName(entry: ArmyIntelligenceDecodedEntry) {
  return (entry.unit || entry.profile).trim()
}

function countTacticalAwarenessOrders(entry: ArmyIntelligenceDecodedEntry) {
  return entry.orderTypes.filter((orderType) =>
    orderType.trim().toLowerCase().replace(/[^a-z]/g, '').includes('tacticalawareness'),
  ).length
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export default ArmyIntelligence
