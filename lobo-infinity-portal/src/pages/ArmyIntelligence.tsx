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
type ModelUsageSort = 'usage' | 'pointsHigh' | 'pointsLow'

type UsageRow = {
  listCount: number
  name: string
  percentage: number
  points?: number
  profile?: string
  skills?: string[]
  troopType?: string
  totalSelections: number
}

type ModelUsageAccumulator = Omit<UsageRow, 'skills'> & {
  skills: Set<string>
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
  chainOfCommand: UsageRow[]
  doctors: UsageRow[]
  engineers: UsageRow[]
  forwardObservers: UsageRow[]
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
const troopTypeOptions = ['HI', 'LI', 'MI', 'REM', 'SK', 'TAG', 'VH', 'WB']
const modelUsageSortOptions: Array<{
  label: string
  value: ModelUsageSort
}> = [
  {
    label: 'Usage Count',
    value: 'usage',
  },
  {
    label: 'Points: High to Low',
    value: 'pointsHigh',
  },
  {
    label: 'Points: Low to High',
    value: 'pointsLow',
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
  const [modelSkillFilter, setModelSkillFilter] = useState('')
  const [modelSort, setModelSort] = useState<ModelUsageSort>('usage')
  const [modelTypeFilter, setModelTypeFilter] = useState('')
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
  const skillOptions = useMemo(() => buildSkillOptions(matchingLists), [matchingLists])
  const availableTroopTypes = useMemo(() => buildTroopTypeOptions(matchingLists), [matchingLists])
  const filteredModelUsage = useMemo(
    () =>
      filterAndSortModelUsage(
        analysis.modelUsage,
        {
          skill: modelSkillFilter,
          sort: modelSort,
          troopType: modelTypeFilter,
        },
      ),
    [analysis.modelUsage, modelSkillFilter, modelSort, modelTypeFilter],
  )

  useEffect(() => {
    if (modelSkillFilter && !skillOptions.includes(modelSkillFilter)) {
      setModelSkillFilter('')
    }
  }, [modelSkillFilter, skillOptions])

  useEffect(() => {
    if (modelTypeFilter && !availableTroopTypes.includes(modelTypeFilter)) {
      setModelTypeFilter('')
    }
  }, [availableTroopTypes, modelTypeFilter])

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
            <MetricCard label="Average Lieutenant Orders" value={analysis.averageLieutenantOrders} />
            <MetricCard label="Average Points" value={analysis.averagePoints} />
            <MetricCard label="Average SWC" value={analysis.averageSwc} />
          </section>

          <section className="panel army-intelligence-selector army-intelligence-model-controls" aria-label="Model Usage filters">
            <label>
              <span>Type</span>
              <select onChange={(event) => setModelTypeFilter(event.target.value)} value={modelTypeFilter}>
                <option value="">All Types</option>
                {troopTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select onChange={(event) => setModelSort(event.target.value as ModelUsageSort)} value={modelSort}>
                {modelUsageSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Skill</span>
              <select onChange={(event) => setModelSkillFilter(event.target.value)} value={modelSkillFilter}>
                <option value="">All Skills</option>
                {skillOptions.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <UsagePanel items={filteredModelUsage} title="Model Usage" variant="wide" />

          <section className="army-intelligence-grid" aria-label="Role usage breakdowns">
            <ResponsiveDisclosure title="Lieutenant Choices">
              <UsagePanel items={analysis.lieutenants} title="Lieutenant Choices" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Hackers">
              <UsagePanel items={analysis.hackers} title="Hackers" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Specialist Operatives">
              <UsagePanel items={analysis.specialists} title="Specialist Operatives" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Doctors">
              <UsagePanel items={analysis.doctors} title="Doctors" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Engineers">
              <UsagePanel items={analysis.engineers} title="Engineers" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Forward Observers">
              <UsagePanel items={analysis.forwardObservers} title="Forward Observers" titleHidden />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Chain of Command">
              <UsagePanel items={analysis.chainOfCommand} title="Chain of Command" titleHidden />
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
        <p>None</p>
      ) : (
        <ol className="army-intelligence-usage-list">
          {visible.map((item) => (
            <li key={`${item.name}|${item.profile ?? ''}|${item.points ?? ''}|${item.troopType ?? ''}`}>
              <span>{formatModelUsageName(item)}</span>
              <strong>{item.totalSelections}</strong>
              <small>
                {typeof item.points === 'number' ? `${item.points} pts / ` : ''}
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
    chainOfCommand: buildUsageRows(entriesByList, (entry) => entry.chainOfCommand),
    doctors: buildUsageRows(entriesByList, (entry) => entry.doctor),
    engineers: buildUsageRows(entriesByList, (entry) => entry.engineer),
    forwardObservers: buildUsageRows(entriesByList, (entry) => entry.forwardObserver),
    hackers: buildUsageRows(entriesByList, (entry) => entry.hacker),
    lieutenants: buildUsageRows(entriesByList, (entry) => entry.lieutenant),
    listCount: decodedLists.length,
    modelUsage: buildModelUsageRows(entriesByList),
    specialists: buildUsageRows(entriesByList, (entry) => entry.specialist),
  }
}

function buildSkillOptions(lists: ArmyIntelligenceList[]) {
  const skills = new Set<string>()

  lists.forEach((list) => {
    list.decoded?.combatGroups.forEach((group) => {
      group.entries.forEach((entry) => {
        entry.skills.forEach((skill) => {
          if (skill) {
            skills.add(skill)
          }
        })
      })
    })
  })

  return Array.from(skills).sort((left, right) => left.localeCompare(right))
}

function buildTroopTypeOptions(lists: ArmyIntelligenceList[]) {
  const types = new Set<string>()

  lists.forEach((list) => {
    list.decoded?.combatGroups.forEach((group) => {
      group.entries.forEach((entry) => {
        if (entry.troopType) {
          types.add(entry.troopType)
        }
      })
    })
  })

  return Array.from(types).sort((left, right) => left.localeCompare(right))
}

function filterAndSortModelUsage(
  rows: UsageRow[],
  filters: {
    skill: string
    sort: ModelUsageSort
    troopType: string
  },
) {
  return rows
    .filter((row) => !filters.troopType || row.troopType === filters.troopType)
    .filter((row) => !filters.skill || rowSkills(row).includes(filters.skill))
    .sort((left, right) => compareModelUsageRows(left, right, filters.sort))
}

function buildModelUsageRows(entriesByList: ArmyIntelligenceDecodedEntry[][]): UsageRow[] {
  const rowsByKey = new Map<string, ModelUsageAccumulator>()
  const listAppearances = new Map<string, Set<number>>()

  entriesByList.forEach((entries, listIndex) => {
    entries.forEach((entry) => {
      const name = getModelName(entry)

      if (!name) {
        return
      }

      const key = [name, entry.profile, entry.points, entry.troopType].join('|')
      const row = rowsByKey.get(key) ?? {
        listCount: 0,
        name,
        percentage: 0,
        points: entry.points,
        profile: entry.profile,
        skills: new Set<string>(),
        totalSelections: 0,
        troopType: entry.troopType,
      }

      row.totalSelections += 1
      entry.skills.forEach((skill) => row.skills.add(skill))
      rowsByKey.set(key, row)

      const appearances = listAppearances.get(key) ?? new Set<number>()
      appearances.add(listIndex)
      listAppearances.set(key, appearances)
    })
  })

  return Array.from(rowsByKey.entries())
    .map(([key, row]) => ({
      listCount: listAppearances.get(key)?.size ?? 0,
      name: row.name,
      percentage: entriesByList.length
        ? ((listAppearances.get(key)?.size ?? 0) / entriesByList.length) * 100
        : 0,
      points: row.points,
      profile: row.profile,
      skills: Array.from(row.skills).sort((left, right) => left.localeCompare(right)),
      totalSelections: row.totalSelections,
      troopType: row.troopType,
    }))
    .sort((left, right) => compareModelUsageRows(left, right, 'usage'))
}

function compareModelUsageRows(left: UsageRow, right: UsageRow, sort: ModelUsageSort): number {
  if (sort === 'pointsHigh') {
    return (right.points ?? 0) - (left.points ?? 0) || compareModelUsageRows(left, right, 'usage')
  }

  if (sort === 'pointsLow') {
    return (left.points ?? 0) - (right.points ?? 0) || compareModelUsageRows(left, right, 'usage')
  }

  return (
    right.totalSelections - left.totalSelections ||
    right.listCount - left.listCount ||
    left.name.localeCompare(right.name) ||
    String(left.profile || '').localeCompare(String(right.profile || ''))
  )
}

function rowSkills(row: UsageRow) {
  return 'skills' in row && Array.isArray(row.skills) ? row.skills : []
}

function formatModelUsageName(item: UsageRow) {
  const name = item.name.trim()
  const profile = item.profile?.trim()

  if (!profile || profile === name) {
    return name
  }

  const normalizedName = name.toLocaleLowerCase()
  const normalizedProfile = profile.toLocaleLowerCase()

  if (normalizedProfile.startsWith(normalizedName)) {
    const detail = profile.slice(name.length).trim()
    return detail ? `${name} - ${detail}` : name
  }

  return `${name} - ${profile}`
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
