import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type ArmyIntelligenceData,
  type ArmyIntelligenceDecodedEntry,
  type ArmyIntelligenceRefreshFailure,
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
type ModelUsageSort = 'alphabetical' | 'pointsHigh' | 'pointsLow'
type RefreshCounts = {
  currentTarget: string
  decoded: number
  failed: number
  failures: ArmyIntelligenceRefreshFailure[]
  progress: number
  skipped: number
  total: number
}
type RefreshState =
  | {
      status: 'idle'
    }
  | {
      counts: RefreshCounts
      message: string
      status: 'running'
    }
  | {
      counts: RefreshCounts
      message: string
      status: 'success'
    }
  | {
      counts?: RefreshCounts
      message: string
      status: 'error'
    }

type UsageRow = {
  equipment?: string[]
  listCount: number
  name: string
  percentage: number
  avaTaken?: number
  points?: number
  profile?: string
  skills?: string[]
  troopType?: string
  totalSelections: number
  weapons?: string[]
}

type ModelUsageAccumulator = Omit<UsageRow, 'equipment' | 'skills' | 'weapons'> & {
  equipment: Set<string>
  skills: Set<string>
  weapons: Set<string>
}

type UniqueArmyIntelligenceList = ArmyIntelligenceList & {
  resultSet: Set<string>
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
  averageDurability: number
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
    label: 'Alphabetically',
    value: 'alphabetical',
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

function formatRefreshTarget(
  item:
    | {
        listName?: string
        player?: string
        sectorial?: string
      }
    | undefined,
) {
  if (!item) {
    return ''
  }

  const sectorialOrList = item.sectorial || item.listName || 'Unassigned'
  const player = item.player || 'Unknown player'
  return `${sectorialOrList} / ${player}`
}

function formatRefreshFailureContext(failure: ArmyIntelligenceRefreshFailure) {
  const context = [failure.sectorial, failure.listName].filter(Boolean).join(' / ')
  return context || 'Unassigned list'
}

function formatRefreshProgress(counts?: RefreshCounts) {
  if (!counts) {
    return 'Preparing snapshot queue'
  }

  if (counts.total <= 0) {
    return 'Preparing snapshot queue'
  }

  return `${counts.progress} of ${counts.total}${counts.currentTarget ? ` - ${counts.currentTarget}` : ''}`
}

function getRefreshPercent(counts?: RefreshCounts) {
  if (!counts || counts.total <= 0) {
    return 0
  }

  return Math.min(100, Math.round((counts.progress / counts.total) * 100))
}

function ArmyIntelligence() {
  const [state, setState] = useState<ArmyIntelligenceState>({
    status: 'loading',
  })

  const loadArmyIntelligence = useCallback((signal?: AbortSignal) =>
    apiClient
      .getArmyIntelligence(signal ? { signal } : {})
      .then((data) => {
        setState({
          data,
          status: 'success',
        })
        return data
      })
      .catch((error: unknown) => {
        if (signal?.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Army Intelligence could not be loaded.',
          status: 'error',
        })
      }), [])

  useEffect(() => {
    const controller = new AbortController()

    void loadArmyIntelligence(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadArmyIntelligence])

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

  return <ArmyIntelligenceContent data={state.data} reload={loadArmyIntelligence} />
}

function ArmyIntelligenceContent({
  data,
  reload,
}: {
  data: ArmyIntelligenceData
  reload: () => Promise<ArmyIntelligenceData | void>
}) {
  const auth = useAuth()
  const [selectedSectorial, setSelectedSectorial] = useState('')
  const [resultFilter, setResultFilter] = useState<AnalysisResultFilter>('all')
  const [modelEquipmentFilter, setModelEquipmentFilter] = useState('')
  const [modelSkillFilter, setModelSkillFilter] = useState('')
  const [modelSort, setModelSort] = useState<ModelUsageSort>('alphabetical')
  const [modelTypeFilter, setModelTypeFilter] = useState('')
  const [modelWeaponFilter, setModelWeaponFilter] = useState('')
  const [refreshState, setRefreshState] = useState<RefreshState>({ status: 'idle' })
  const decodedLists = useMemo(
    () => data.lists.filter(isDecodedList),
    [data.lists],
  )
  const uniqueDecodedLists = useMemo(
    () => deduplicateSubmittedArmyLists(decodedLists),
    [decodedLists],
  )
  const sectorials = useMemo(
    () =>
      Array.from(new Set(uniqueDecodedLists.map((list) => getDecodedSectorial(list)).filter(Boolean)))
        .sort((left, right) => left.localeCompare(right)),
    [uniqueDecodedLists],
  )
  const matchingLists = useMemo(
    () =>
      selectedSectorial
        ? uniqueDecodedLists
            .filter((list) => getDecodedSectorial(list) === selectedSectorial)
            .filter((list) => matchesResultFilter(list, resultFilter))
        : [],
    [resultFilter, selectedSectorial, uniqueDecodedLists],
  )
  const analysis = useMemo(() => buildArmyAnalysis(matchingLists), [matchingLists])
  const equipmentOptions = useMemo(() => buildEquipmentOptions(matchingLists), [matchingLists])
  const skillOptions = useMemo(() => buildSkillOptions(matchingLists), [matchingLists])
  const weaponOptions = useMemo(() => buildWeaponOptions(matchingLists), [matchingLists])
  const filteredModelUsage = useMemo(
    () =>
      filterAndSortModelUsage(
        analysis.modelUsage,
        {
          equipment: modelEquipmentFilter,
          skill: modelSkillFilter,
          sort: modelSort,
          troopType: modelTypeFilter,
          weapon: modelWeaponFilter,
        },
      ),
    [analysis.modelUsage, modelEquipmentFilter, modelSkillFilter, modelSort, modelTypeFilter, modelWeaponFilter],
  )

  useEffect(() => {
    if (modelSkillFilter && !skillOptions.includes(modelSkillFilter)) {
      setModelSkillFilter('')
    }
  }, [modelSkillFilter, skillOptions])

  useEffect(() => {
    if (!selectedSectorial) {
      return
    }

    window.scrollTo({
      left: 0,
      top: 0,
    })
  }, [selectedSectorial])

  useEffect(() => {
    if (modelWeaponFilter && !weaponOptions.includes(modelWeaponFilter)) {
      setModelWeaponFilter('')
    }
  }, [modelWeaponFilter, weaponOptions])

  useEffect(() => {
    if (modelEquipmentFilter && !equipmentOptions.includes(modelEquipmentFilter)) {
      setModelEquipmentFilter('')
    }
  }, [equipmentOptions, modelEquipmentFilter])

  const canRefreshArmyIntelligence = auth.hasPermission('manageCache')

  async function refreshAllSectorials() {
    if (!canRefreshArmyIntelligence || refreshState.status === 'running') {
      return
    }

    let counts: RefreshCounts = {
      currentTarget: '',
      decoded: 0,
      failed: 0,
      failures: [],
      progress: 0,
      skipped: 0,
      total: data.lists.length,
    }
    const failedSnapshotKeys = new Set<string>()

    setRefreshState({
      counts,
      message:
        counts.total > 0
          ? `Preparing ${counts.total} Army Intelligence snapshots...`
          : 'Preparing Army Intelligence snapshot queue...',
      status: 'running',
    })

    try {
      for (let pass = 0; pass < 250; pass += 1) {
        const result = await apiClient.refreshArmyIntelligenceSnapshots({
          batchLimit: 1,
          excludeSnapshotKeys: Array.from(failedSnapshotKeys),
        })
        const total = result.sourceCount || counts.total
        const skipped = pass === 0 ? result.currentCount : counts.skipped
        const newFailures = result.failures.filter(
          (failure) => !failedSnapshotKeys.has(failure.snapshotKey),
        )

        for (const failure of newFailures) {
          failedSnapshotKeys.add(failure.snapshotKey)
        }
        const currentTarget = formatRefreshTarget(result.processed[0])

        counts = {
          currentTarget,
          decoded: counts.decoded + result.decoded,
          failed: failedSnapshotKeys.size,
          failures: [...counts.failures, ...newFailures],
          progress: Math.min(
            total,
            skipped + counts.decoded + result.decoded + failedSnapshotKeys.size,
          ),
          skipped,
          total,
        }

        setRefreshState({
          counts,
          message:
            total > 0
              ? `Processing ${counts.progress} of ${total}${currentTarget ? ` - ${currentTarget}` : ''}`
              : 'No submitted army-list snapshots found.',
          status: 'running',
        })

        if (!result.hasMore) {
          break
        }

        if (result.updated === 0 && result.failed === 0 && result.decoded === 0) {
          throw new Error('Army Intelligence refresh made no progress.')
        }

        if (pass === 249) {
          throw new Error('Army Intelligence refresh stopped after 250 batches.')
        }
      }

      await reload()

      setRefreshState({
        counts,
        message:
          counts.failed > 0
            ? 'Refresh completed with errors'
            : 'Refresh complete',
        status: 'success',
      })
    } catch (error) {
      setRefreshState({
        counts,
        message:
          error instanceof Error
            ? error.message
            : 'Army Intelligence refresh failed.',
        status: 'error',
      })
    }
  }

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
        {auth.hasPermission('manageCache') ? (
          <div className="army-intelligence-refresh-action" aria-live="polite">
            <button
              className="button army-intelligence-refresh-button"
              disabled={refreshState.status === 'running'}
              onClick={refreshAllSectorials}
              type="button"
            >
              {refreshState.status === 'running'
                ? 'Refreshing...'
                : 'Refresh All Sectorials'}
            </button>
            <p
              className={`army-intelligence-refresh-status is-${refreshState.status}`}
              role={refreshState.status === 'error' ? 'alert' : undefined}
            >
              {refreshState.status === 'idle'
                ? 'Commissioner action: refreshes stale snapshots one at a time.'
                : refreshState.message}
            </p>
            {refreshState.status !== 'idle' ? (
              <div className={`army-intelligence-refresh-summary is-${refreshState.status}`}>
                <div className="army-intelligence-refresh-progress-line">
                  <span>Total snapshots: {refreshState.counts?.total ?? data.lists.length}</span>
                  <span>
                    Progress: {formatRefreshProgress(refreshState.counts)}
                  </span>
                </div>
                <div
                  aria-label="Army Intelligence refresh progress"
                  aria-valuemax={Math.max(1, refreshState.counts?.total ?? data.lists.length)}
                  aria-valuemin={0}
                  aria-valuenow={refreshState.counts?.progress ?? 0}
                  className="army-intelligence-refresh-progress"
                  role="progressbar"
                >
                  <span style={{ width: `${getRefreshPercent(refreshState.counts)}%` }} />
                </div>
                <div className="army-intelligence-refresh-counters">
                  <span><strong>{refreshState.counts?.decoded ?? 0}</strong>Decoded</span>
                  <span><strong>{refreshState.counts?.skipped ?? 0}</strong>Skipped</span>
                  <span><strong>{refreshState.counts?.failed ?? 0}</strong>Failed</span>
                </div>
              </div>
            ) : null}
            {refreshState.status !== 'idle' && refreshState.counts?.failures.length ? (
              <ul className="army-intelligence-refresh-failures">
                {refreshState.counts.failures.map((failure) => (
                  <li key={failure.snapshotKey}>
                    <strong>{failure.player || 'Unknown player'}</strong>
                    <span>{formatRefreshFailureContext(failure)}</span>
                    <span>{failure.reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
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
            <MetricCard label="Average Wounds / Structure per Model" value={analysis.averageDurability} />
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
            <label>
              <span>Weapon</span>
              <select onChange={(event) => setModelWeaponFilter(event.target.value)} value={modelWeaponFilter}>
                <option value="">All Weapons</option>
                {weaponOptions.map((weapon) => (
                  <option key={weapon} value={weapon}>
                    {weapon}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Equipment</span>
              <select onChange={(event) => setModelEquipmentFilter(event.target.value)} value={modelEquipmentFilter}>
                <option value="">All Equipment</option>
                {equipmentOptions.map((equipment) => (
                  <option key={equipment} value={equipment}>
                    {equipment}
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
          <li className="army-intelligence-usage-list-header">
            <span>Profile</span>
            <strong>{variant === 'wide' ? 'AVA Taken' : 'Selections'}</strong>
            <small>Lists</small>
          </li>
          {visible.map((item) => (
            <li key={`${item.name}|${item.profile ?? ''}|${item.points ?? ''}|${item.troopType ?? ''}`}>
              <span className="army-intelligence-profile-cell">
                <span>{formatModelUsageName(item)}</span>
                {typeof item.points === 'number' ? (
                  <small className="army-intelligence-points-cell">{item.points} pts</small>
                ) : null}
              </span>
              <strong>{variant === 'wide' ? formatAvaTaken(item.avaTaken) : item.totalSelections}</strong>
              <small className="army-intelligence-lists-cell">
                <span>{item.listCount} lists</span>
                <span>{formatNumber(item.percentage)}%</span>
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

function deduplicateSubmittedArmyLists(lists: ArmyIntelligenceList[]): UniqueArmyIntelligenceList[] {
  const uniqueByKey = new Map<string, UniqueArmyIntelligenceList>()

  lists
    .filter(isAllowedArmyIntelligenceSource)
    .forEach((list) => {
      const key = getSubmittedArmyListDeduplicationKey(list)

      if (!key) {
        return
      }

      const existing = uniqueByKey.get(key)
      if (existing) {
        normalizeResultValue(list.result).forEach((result) => existing.resultSet.add(result))
        return
      }

      uniqueByKey.set(key, {
        ...list,
        resultSet: normalizeResultValue(list.result),
      })
    })

  return Array.from(uniqueByKey.values())
}

function isAllowedArmyIntelligenceSource(list: ArmyIntelligenceList) {
  return ['league', 'casual', 'tournament'].includes(list.sourceType.trim().toLowerCase())
}

function getSubmittedArmyListDeduplicationKey(list: ArmyIntelligenceList) {
  const player = normalizeArmyIntelligenceDeduplicationPart(list.player)
  const armyCodeHash = list.armyCodeHash.trim().toLowerCase()

  return player && armyCodeHash ? `${player}:${armyCodeHash}` : ''
}

function normalizeArmyIntelligenceDeduplicationPart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeResultValue(value: string) {
  const result = value.trim().toLowerCase()

  return result ? new Set([result]) : new Set<string>()
}

function getDecodedSectorial(list: ArmyIntelligenceList) {
  return normalizeSectorialDisplayName(list.decoded?.sectorial || '')
}

function normalizeSectorialDisplayName(value: string) {
  const name = value.trim()
  const compact = name.replace(/\s+/g, '').toLocaleLowerCase()

  if (compact === 'panoceania') {
    return 'PanOceania'
  }

  return name
}

function matchesResultFilter(list: UniqueArmyIntelligenceList, filter: AnalysisResultFilter) {
  if (filter === 'all') {
    return true
  }

  if (filter === 'winning') {
    return list.resultSet.has('win')
  }

  return list.resultSet.has('loss')
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
    averageDurability: average(entriesByList.map(calculateAverageDurabilityPerModel)),
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

function calculateAverageDurabilityPerModel(entries: ArmyIntelligenceDecodedEntry[]) {
  const values = entries
    .map((entry) => entry.wounds ?? entry.structure)
    .filter((value): value is number => typeof value === 'number')

  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0
}

function buildSkillOptions(lists: ArmyIntelligenceList[]) {
  return buildEntryTokenOptions(lists, (entry) => entry.skills)
}

function buildWeaponOptions(lists: ArmyIntelligenceList[]) {
  return buildEntryTokenOptions(lists, (entry) => (entry.weapons ?? []).map(normalizeWeaponModeName))
}

function buildEquipmentOptions(lists: ArmyIntelligenceList[]) {
  return buildEntryTokenOptions(lists, (entry) => entry.equipment)
}

function buildEntryTokenOptions(
  lists: ArmyIntelligenceList[],
  getTokens: (entry: ArmyIntelligenceDecodedEntry) => string[],
) {
  const values = new Set<string>()
  lists.forEach((list) => {
    list.decoded?.combatGroups.forEach((group) => {
      group.entries.forEach((entry) => {
        ;(getTokens(entry) ?? []).forEach((value) => {
          if (value) {
            values.add(value)
          }
        })
      })
    })
  })

  return Array.from(values).sort((left, right) => left.localeCompare(right))
}

function filterAndSortModelUsage(
  rows: UsageRow[],
  filters: {
    equipment: string
    skill: string
    sort: ModelUsageSort
    troopType: string
    weapon: string
  },
) {
  return rows
    .filter((row) => !filters.troopType || row.troopType === filters.troopType)
    .filter((row) => !filters.skill || rowSkills(row).includes(filters.skill))
    .filter((row) => !filters.weapon || rowWeapons(row).includes(filters.weapon))
    .filter((row) => !filters.equipment || rowEquipment(row).includes(filters.equipment))
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
        equipment: new Set<string>(),
        listCount: 0,
        name,
        percentage: 0,
        points: entry.points,
        profile: entry.profile,
        skills: new Set<string>(),
        totalSelections: 0,
        troopType: entry.troopType,
        weapons: new Set<string>(),
      }

      row.totalSelections += 1
      ;(entry.equipment ?? []).forEach((equipment) => row.equipment.add(equipment))
      entry.skills.forEach((skill) => row.skills.add(skill))
      ;(entry.weapons ?? []).forEach((weapon) => row.weapons.add(normalizeWeaponModeName(weapon)))
      rowsByKey.set(key, row)

      const appearances = listAppearances.get(key) ?? new Set<number>()
      appearances.add(listIndex)
      listAppearances.set(key, appearances)
    })
  })

  return Array.from(rowsByKey.entries())
    .map(([key, row]) => ({
      equipment: Array.from(row.equipment).sort((left, right) => left.localeCompare(right)),
      avaTaken: (listAppearances.get(key)?.size ?? 0) > 0
        ? row.totalSelections / (listAppearances.get(key)?.size ?? 1)
        : 0,
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
      weapons: Array.from(row.weapons).sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => compareModelUsageRows(left, right, 'alphabetical'))
}

function compareModelUsageRows(left: UsageRow, right: UsageRow, sort: ModelUsageSort): number {
  if (sort === 'pointsHigh') {
    return (right.points ?? 0) - (left.points ?? 0) || compareModelUsageRows(left, right, 'alphabetical')
  }

  if (sort === 'pointsLow') {
    return (left.points ?? 0) - (right.points ?? 0) || compareModelUsageRows(left, right, 'alphabetical')
  }

  const labelComparison = formatModelUsageName(left).localeCompare(formatModelUsageName(right))
  return labelComparison || right.totalSelections - left.totalSelections || right.listCount - left.listCount
}

function rowSkills(row: UsageRow) {
  return 'skills' in row && Array.isArray(row.skills) ? row.skills : []
}

function rowWeapons(row: UsageRow) {
  return 'weapons' in row && Array.isArray(row.weapons) ? row.weapons : []
}

function rowEquipment(row: UsageRow) {
  return 'equipment' in row && Array.isArray(row.equipment) ? row.equipment : []
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
  return entry.skills.some((skill) => normalizeExactSkillToken(skill) === 'tacticalawareness') ? 1 : 0
}

function normalizeExactSkillToken(skill: string) {
  return skill.trim().toLowerCase().replace(/[^a-z]/g, '')
}

function normalizeWeaponModeName(weapon: string) {
  return weapon.trim().replace(/\s+\[[^\]]+\]$/, '')
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

function formatAvaTaken(value: number | undefined) {
  return typeof value === 'number' ? value.toFixed(1) : '0.0'
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export default ArmyIntelligence
