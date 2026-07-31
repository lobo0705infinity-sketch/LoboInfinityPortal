import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import InteractiveMetricCard from '../components/InteractiveMetricCard'
import Skeleton from '../components/Skeleton'
import lieutenantOrderReference from '../../docs/mockups/lieutenant-order-reference.png'
import { CANONICAL_ARMY_REGISTRY, getArmyParentFaction, normalizeArmyForDisplay } from '../config/armies'
import { readArmyIntelligenceFactionParam } from '../services/armyIntelligenceNavigation'
import {
  apiClient,
  type ArmyIntelligenceArmyList,
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
type ArmyListExplorerSort = 'submissionDate' | 'player' | 'sectorial' | 'points'
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

type MetricIcon = 'impetuous' | 'irregular' | 'lieutenant' | 'lists' | 'points' | 'regular' | 'tactical' | 'wounds'

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

type ArmyListExplorerSummary = {
  knownArmyLists: number
  mostActivePlayer: string
  mostActivePlayerCount: number
  mostPopularSectorial: string
  newestSubmission: string
  players: number
  sectorialCoverage: number
  sectorials: number
  totalSectorials: number
}

type ArmyIntelligenceSelectionScope = {
  isParentFaction: boolean
  label: string
  parentFaction: string
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
  const [searchParams] = useSearchParams()
  const requestedFaction = readArmyIntelligenceFactionParam(searchParams)
  const [selectedSectorial, setSelectedSectorial] = useState(requestedFaction)
  const [resultFilter, setResultFilter] = useState<AnalysisResultFilter>('all')
  const [modelEquipmentFilter, setModelEquipmentFilter] = useState('')
  const [modelSkillFilter, setModelSkillFilter] = useState('')
  const [modelSort, setModelSort] = useState<ModelUsageSort>('alphabetical')
  const [modelTypeFilter, setModelTypeFilter] = useState('')
  const [modelWeaponFilter, setModelWeaponFilter] = useState('')
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [explorerPlayerFilter, setExplorerPlayerFilter] = useState('')
  const [explorerSearch, setExplorerSearch] = useState('')
  const [explorerSectorialFilter, setExplorerSectorialFilter] = useState('')
  const [explorerSort, setExplorerSort] = useState<ArmyListExplorerSort>('submissionDate')
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
      Array.from(new Set([
        ...uniqueDecodedLists.map((list) => getIntelligenceParentFaction(list)).filter(Boolean),
        ...uniqueDecodedLists.map((list) => getDecodedSectorial(list)).filter(Boolean),
      ]))
        .sort((left, right) => left.localeCompare(right)),
    [uniqueDecodedLists],
  )
  const selectedExplorerScope = useMemo(
    () => getSelectedExplorerScope(selectedSectorial),
    [selectedSectorial],
  )
  const selectedScopeLists = useMemo(
    () =>
      selectedExplorerScope.label
        ? uniqueDecodedLists.filter((list) => intelligenceListMatchesSelectedScope(list, selectedExplorerScope))
        : [],
    [selectedExplorerScope, uniqueDecodedLists],
  )
  const matchingLists = useMemo(
    () => selectedScopeLists.filter((list) => matchesResultFilter(list, resultFilter)),
    [resultFilter, selectedScopeLists],
  )
  const selectedArmyListExplorerRows = useMemo(
    () => buildExplorerRowsFromSelectedLists(matchingLists),
    [matchingLists],
  )
  const selectedKnownArmyLists = selectedArmyListExplorerRows.length
  const explorerPlayerOptions = useMemo(
    () => getUniqueExplorerOptions(selectedArmyListExplorerRows.map(formatExplorerPlayer)),
    [selectedArmyListExplorerRows],
  )
  const explorerSectorialOptions = useMemo(
    () => getUniqueExplorerOptions(selectedArmyListExplorerRows.map(getExplorerSectorial)),
    [selectedArmyListExplorerRows],
  )
  const visibleExplorerRows = useMemo(
    () =>
      filterAndSortExplorerRows(
        selectedArmyListExplorerRows,
        {
          player: explorerPlayerFilter,
          search: explorerSearch,
          sectorial: explorerSectorialFilter,
          sort: explorerSort,
        },
      ),
    [
      explorerPlayerFilter,
      explorerSearch,
      explorerSectorialFilter,
      explorerSort,
      selectedArmyListExplorerRows,
    ],
  )
  const explorerSummary = useMemo(
    () => buildArmyListExplorerSummary(selectedArmyListExplorerRows, selectedExplorerScope),
    [selectedArmyListExplorerRows, selectedExplorerScope],
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
    if (!requestedFaction || requestedFaction === selectedSectorial) {
      return
    }

    setSelectedSectorial(requestedFaction)
  }, [requestedFaction, selectedSectorial])

  useEffect(() => {
    if (modelSkillFilter && !skillOptions.includes(modelSkillFilter)) {
      setModelSkillFilter('')
    }
  }, [modelSkillFilter, skillOptions])

  useEffect(() => {
    if (!selectedSectorial) {
      return
    }

    setExplorerOpen(false)
    setExplorerPlayerFilter('')
    setExplorerSearch('')
    setExplorerSectorialFilter('')
    setExplorerSort('submissionDate')

    window.scrollTo({
      left: 0,
      top: 0,
    })
  }, [selectedSectorial])

  useEffect(() => {
    if (explorerPlayerFilter && !explorerPlayerOptions.includes(explorerPlayerFilter)) {
      setExplorerPlayerFilter('')
    }
  }, [explorerPlayerFilter, explorerPlayerOptions])

  useEffect(() => {
    if (explorerSectorialFilter && !explorerSectorialOptions.includes(explorerSectorialFilter)) {
      setExplorerSectorialFilter('')
    }
  }, [explorerSectorialFilter, explorerSectorialOptions])

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
            <MetricCard
              actionLabel="Browse submitted army lists"
              disabled={selectedArmyListExplorerRows.length === 0}
              helperText="View submitted army lists"
              icon="lists"
              label="Known Army Lists"
              onValueAction={() => setExplorerOpen(true)}
              value={selectedKnownArmyLists}
            />
            <MetricCard icon="regular" label="Average Regular Orders" value={analysis.averageRegularOrders} />
            <MetricCard icon="irregular" label="Average Irregular Orders" value={analysis.averageIrregularOrders} />
            <MetricCard icon="tactical" label="Average Tactical Awareness Orders" value={analysis.averageTacticalAwarenessOrders} />
            <MetricCard icon="impetuous" label="Average Impetuous Orders" value={analysis.averageImpetuousOrders} />
            <MetricCard icon="lieutenant" label="Average Lieutenant Orders" value={analysis.averageLieutenantOrders} />
            <MetricCard icon="wounds" label="Average Wounds / Structure per Model" value={analysis.averageDurability} />
            <MetricCard icon="points" label="Average Points" value={analysis.averagePoints} />
          </section>

          <ArmyListExplorer
            lists={visibleExplorerRows}
            onClose={() => setExplorerOpen(false)}
            open={explorerOpen}
            playerFilter={explorerPlayerFilter}
            playerOptions={explorerPlayerOptions}
            search={explorerSearch}
            sectorialFilter={explorerSectorialFilter}
            sectorialOptions={explorerSectorialOptions}
            selectedFaction={selectedExplorerScope.label || selectedSectorial}
            showFactionScopeStats={selectedExplorerScope.isParentFaction}
            setExplorerOpen={setExplorerOpen}
            setPlayerFilter={setExplorerPlayerFilter}
            setSearch={setExplorerSearch}
            setSectorialFilter={setExplorerSectorialFilter}
            setSort={setExplorerSort}
            sort={explorerSort}
            summary={explorerSummary}
          />

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

function MetricCard({
  actionLabel,
  disabled,
  helperText,
  icon,
  label,
  onValueAction,
  value,
}: {
  actionLabel?: string
  disabled?: boolean
  helperText?: string
  icon: MetricIcon
  label: string
  onValueAction?: () => void
  value: number
}) {
  return (
    <InteractiveMetricCard
      ariaLabel={actionLabel || `Open ${label}`}
      className="army-intelligence-metric"
      disabled={disabled}
      helperText={helperText}
      icon={<MetricIcon icon={icon} />}
      label={label}
      onActivate={onValueAction}
      value={formatNumber(value)}
    />
  )
}

function ExplorerStat({
  ariaLabel,
  helperText,
  label,
  onClick,
  value,
}: {
  ariaLabel?: string
  helperText?: string
  label: string
  onClick?: () => void
  value: string
}) {
  return (
    <InteractiveMetricCard
      ariaLabel={ariaLabel || label}
      className="army-intelligence-explorer-stat"
      helperText={helperText}
      label={label}
      onActivate={onClick}
      value={value}
    />
  )
}

function MetricIcon({ icon }: { icon: MetricIcon }) {
  if (icon === 'lieutenant') {
    return (
      <span
        aria-hidden="true"
        className="army-intelligence-metric-icon is-lieutenant"
        style={{ backgroundImage: `url(${lieutenantOrderReference})` }}
      />
    )
  }

  if (icon === 'points' || icon === 'wounds') {
    return <span aria-hidden="true" className={`army-intelligence-metric-icon is-${icon}`} />
  }

  return (
    <span aria-hidden="true" className={`army-intelligence-metric-icon is-${icon}`} />
  )
}

function ArmyListExplorer({
  lists,
  onClose,
  open,
  playerFilter,
  playerOptions,
  search,
  sectorialFilter,
  sectorialOptions,
  selectedFaction,
  showFactionScopeStats,
  setExplorerOpen,
  setPlayerFilter,
  setSearch,
  setSectorialFilter,
  setSort,
  sort,
  summary,
}: {
  lists: ArmyIntelligenceArmyList[]
  onClose: () => void
  open: boolean
  playerFilter: string
  playerOptions: string[]
  search: string
  sectorialFilter: string
  sectorialOptions: string[]
  selectedFaction: string
  showFactionScopeStats: boolean
  setExplorerOpen: (value: boolean) => void
  setPlayerFilter: (value: string) => void
  setSearch: (value: string) => void
  setSectorialFilter: (value: string) => void
  setSort: (value: ArmyListExplorerSort) => void
  sort: ArmyListExplorerSort
  summary: ArmyListExplorerSummary
}) {
  if (!open) {
    return null
  }

  return (
    <section
      aria-label={`${selectedFaction} Army List Explorer`}
      className="army-intelligence-explorer-backdrop"
      role="dialog"
    >
      <div className="army-intelligence-explorer-panel">
        <div className="army-intelligence-explorer-header">
          <div>
            <p className="eyebrow">Army List Explorer</p>
            <h2>{selectedFaction}</h2>
          </div>
          <button onClick={onClose} type="button">Close</button>
        </div>

        <div className="army-intelligence-explorer-stats">
          <ExplorerStat
            ariaLabel="Show all submitted army lists"
            helperText="Show all submitted lists"
            label="Known Army Lists"
            onClick={() => {
              setPlayerFilter('')
              setSectorialFilter('')
              setSearch('')
            }}
            value={String(summary.knownArmyLists)}
          />
          <ExplorerStat label="Players" value={String(summary.players)} />
          {showFactionScopeStats ? (
            <ExplorerStat label="Sectorials Represented" value={String(summary.sectorials)} />
          ) : null}
          {showFactionScopeStats && summary.totalSectorials > 0 ? (
            <ExplorerStat
              label="Sectorial Coverage"
              value={`${summary.sectorialCoverage} / ${summary.totalSectorials}`}
            />
          ) : null}
          <ExplorerStat label="Newest Submission" value={formatExplorerDate(summary.newestSubmission)} />
          {showFactionScopeStats ? (
            <ExplorerStat
              ariaLabel="Filter Army List Explorer by most popular sectorial"
              helperText={summary.mostPopularSectorial ? 'Filter by this sectorial' : undefined}
              label="Most Popular Sectorial"
              onClick={
                summary.mostPopularSectorial
                  ? () => {
                      setExplorerOpen(true)
                      setSectorialFilter(summary.mostPopularSectorial)
                    }
                  : undefined
              }
              value={summary.mostPopularSectorial || 'None'}
            />
          ) : null}
          <ExplorerStat
            ariaLabel="Filter Army List Explorer by most submitted player"
            helperText={summary.mostActivePlayer ? 'Filter by this player' : undefined}
            label="Most Submitted By"
            onClick={
              summary.mostActivePlayer
                ? () => {
                    setExplorerOpen(true)
                    setPlayerFilter(summary.mostActivePlayer)
                  }
                : undefined
            }
            value={
              summary.mostActivePlayer
                ? `${summary.mostActivePlayer} (${summary.mostActivePlayerCount})`
                : 'None'
            }
          />
        </div>

        <section className="army-intelligence-explorer-controls" aria-label="Army List Explorer controls">
          <label>
            <span>Sort</span>
            <select onChange={(event) => setSort(event.target.value as ArmyListExplorerSort)} value={sort}>
              <option value="submissionDate">Submission Date</option>
              <option value="player">Player</option>
              <option value="sectorial">Sectorial</option>
              <option value="points">Points</option>
            </select>
          </label>
          <label>
            <span>Player</span>
            <select onChange={(event) => setPlayerFilter(event.target.value)} value={playerFilter}>
              <option value="">All Players</option>
              {playerOptions.map((player) => (
                <option key={player} value={player}>{player}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Sectorial</span>
            <select onChange={(event) => setSectorialFilter(event.target.value)} value={sectorialFilter}>
              <option value="">All Sectorials</option>
              {sectorialOptions.map((sectorial) => (
                <option key={sectorial} value={sectorial}>{sectorial}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Player or army name"
              type="search"
              value={search}
            />
          </label>
        </section>

        {lists.length === 0 ? (
          <p className="army-intelligence-explorer-empty">No army lists match the current explorer filters.</p>
        ) : (
          <div className="army-intelligence-explorer-table" role="region" aria-label="Known Army Lists">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Sectorial</th>
                  <th>Army Name</th>
                  <th>Points</th>
                  <th>SWC</th>
                  <th>Submission Date</th>
                  <th>Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((list) => (
                  <tr key={`${list.source}:${list.id}:${list.armyCode}`}>
                    <td>{formatExplorerPlayer(list)}</td>
                    <td>{getExplorerSectorial(list) || 'Not recorded'}</td>
                    <td>{list.armyName || 'Untitled Army List'}</td>
                    <td>{formatNumber(list.points)}</td>
                    <td>{formatNumber(list.swc)}</td>
                    <td>{formatExplorerDate(list.submissionDate)}</td>
                    <td>{list.source || 'Community Library'}</td>
                    <td>
                      <Link to={getArmyIntelligenceListTarget(list)}>
                        Open List
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
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
      {!titleHidden && variant !== 'wide' ? (
        <h2 id={`${slugify(title)}-title`}>{title}</h2>
      ) : null}
      {visible.length === 0 ? (
        <p>None</p>
      ) : (
        <ol className="army-intelligence-usage-list">
          <li className="army-intelligence-usage-list-header">
            <span className="army-intelligence-profile-cell">Profile</span>
            <strong>Selections</strong>
            {variant === 'wide' ? <small className="army-intelligence-points-cell">Points</small> : null}
            <small className="army-intelligence-lists-cell">Lists</small>
            {variant === 'wide' ? <small className="army-intelligence-ava-cell">AVA Taken</small> : null}
          </li>
          {visible.map((item) => (
            <li key={`${item.name}|${item.profile ?? ''}|${item.points ?? ''}|${item.troopType ?? ''}`}>
              <span className="army-intelligence-profile-cell">
                <span>{formatModelUsageName(item)}</span>
                {variant !== 'wide' && typeof item.points === 'number' ? (
                  <small className="army-intelligence-points-cell">{item.points} pts</small>
                ) : null}
              </span>
              <strong>{item.totalSelections}</strong>
              {variant === 'wide' ? (
                <small className="army-intelligence-points-cell">
                  {typeof item.points === 'number' ? `${item.points} pts` : '0 pts'}
                </small>
              ) : null}
              <small className="army-intelligence-lists-cell">
                {variant === 'wide'
                  ? `${item.listCount} lists`
                  : `${item.listCount} lists / ${formatNumber(item.percentage)}%`}
              </small>
              {variant === 'wide' ? (
                <small className="army-intelligence-ava-cell">
                  {formatAvaTaken(item.avaTaken)} / {formatNumber(item.percentage)}%
                </small>
              ) : null}
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

function getSelectedExplorerScope(selectedItem: string): ArmyIntelligenceSelectionScope {
  const label = normalizeSectorialDisplayName(normalizeArmyForDisplay(selectedItem))
  const registryEntry = CANONICAL_ARMY_REGISTRY.find((army) => army.active && army.name === label)
  const isParentFaction = registryEntry?.type === 'Vanilla' && registryEntry.parentFaction === registryEntry.name
  const parentFaction = registryEntry?.parentFaction || getArmyParentFaction(label) || label

  return {
    isParentFaction,
    label,
    parentFaction,
  }
}

function intelligenceListMatchesSelectedScope(list: ArmyIntelligenceList, scope: ArmyIntelligenceSelectionScope) {
  if (scope.isParentFaction) {
    return getIntelligenceParentFaction(list) === scope.parentFaction
  }

  return getDecodedSectorial(list) === scope.label
}

function getIntelligenceParentFaction(list: ArmyIntelligenceList) {
  return getArmyParentFaction(list.decoded?.faction) ||
    getArmyParentFaction(list.faction) ||
    normalizeArmyForDisplay(list.faction)
}

function buildExplorerRowsFromSelectedLists(lists: UniqueArmyIntelligenceList[]): ArmyIntelligenceArmyList[] {
  return lists.map((list, index) => ({
    id: getStableExplorerRowId(list, index),
    armyCode: '',
    armyLink: '',
    armyName: list.decoded?.listName || 'Untitled Army List',
    faction: getIntelligenceParentFaction(list),
    player: list.player || list.sourcePlayer,
    playerDisplayName: list.player || list.sourcePlayer || 'Unknown Player',
    points: list.decoded?.totals.points ?? 0,
    sectorial: getDecodedSectorial(list),
    source: formatIntelligenceSource(list),
    submissionDate: list.date || list.decodedAt,
    swc: list.decoded?.totals.swc ?? 0,
  }))
}

function getStableExplorerRowId(list: ArmyIntelligenceList, index: number) {
  const sourceId = Number(list.sourceId)

  return Number.isFinite(sourceId) && sourceId > 0
    ? sourceId
    : index + 1
}

function formatIntelligenceSource(list: ArmyIntelligenceList) {
  const sourceType = list.sourceType.trim().toLowerCase()
  const gameType = list.gameType.trim().toLowerCase()

  if (sourceType === 'league' || gameType === 'league') {
    return 'League'
  }

  if (sourceType === 'casual' || gameType === 'casual') {
    return 'Casual'
  }

  if (sourceType === 'tournament' || gameType.includes('team')) {
    return 'Team Tournament'
  }

  return list.gameType || list.sourceType || 'Army Intelligence'
}

function getExplorerSectorial(list: ArmyIntelligenceArmyList) {
  return normalizeSectorialDisplayName(normalizeArmyForDisplay(list.sectorial))
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

function filterAndSortExplorerRows(
  lists: ArmyIntelligenceArmyList[],
  filters: {
    player: string
    search: string
    sectorial: string
    sort: ArmyListExplorerSort
  },
) {
  const query = filters.search.trim().toLowerCase()

  return lists
    .filter((list) => !filters.player || formatExplorerPlayer(list) === filters.player)
    .filter((list) => !filters.sectorial || getExplorerSectorial(list) === filters.sectorial)
    .filter((list) =>
      !query ||
      formatExplorerPlayer(list).toLowerCase().includes(query) ||
      list.armyName.toLowerCase().includes(query),
    )
    .sort((left, right) => compareExplorerRows(left, right, filters.sort))
}

function compareExplorerRows(
  left: ArmyIntelligenceArmyList,
  right: ArmyIntelligenceArmyList,
  sort: ArmyListExplorerSort,
): number {
  if (sort === 'player') {
    return formatExplorerPlayer(left).localeCompare(formatExplorerPlayer(right)) ||
      compareExplorerRows(left, right, 'submissionDate')
  }

  if (sort === 'sectorial') {
    return getExplorerSectorial(left).localeCompare(getExplorerSectorial(right)) ||
      compareExplorerRows(left, right, 'submissionDate')
  }

  if (sort === 'points') {
    return right.points - left.points || compareExplorerRows(left, right, 'submissionDate')
  }

  return getExplorerDateTime(right.submissionDate) - getExplorerDateTime(left.submissionDate) ||
    right.id - left.id ||
    left.armyName.localeCompare(right.armyName)
}

function buildArmyListExplorerSummary(
  lists: ArmyIntelligenceArmyList[],
  selectedScope: ArmyIntelligenceSelectionScope,
): ArmyListExplorerSummary {
  const players = new Set<string>()
  const sectorials = new Set<string>()
  const playerCounts = new Map<string, number>()
  const sectorialCounts = new Map<string, number>()
  let newestSubmission = ''

  lists.forEach((list) => {
    const player = formatExplorerPlayer(list)
    const sectorial = getExplorerSectorial(list)

    players.add(player)
    playerCounts.set(player, (playerCounts.get(player) ?? 0) + 1)

    if (sectorial && isCanonicalSectorial(sectorial)) {
      sectorials.add(sectorial)
      sectorialCounts.set(sectorial, (sectorialCounts.get(sectorial) ?? 0) + 1)
    }

    if (getExplorerDateTime(list.submissionDate) > getExplorerDateTime(newestSubmission)) {
      newestSubmission = list.submissionDate
    }
  })

  const mostActivePlayer = getCountLeader(playerCounts)
  const mostPopularSectorial = getCountLeader(sectorialCounts)
  const totalSectorials = selectedScope.isParentFaction
    ? getTotalSectorialsForFaction(selectedScope.parentFaction)
    : 0

  return {
    knownArmyLists: lists.length,
    mostActivePlayer: mostActivePlayer.name,
    mostActivePlayerCount: mostActivePlayer.count,
    mostPopularSectorial: selectedScope.isParentFaction ? mostPopularSectorial.name : '',
    newestSubmission,
    players: players.size,
    sectorialCoverage: totalSectorials > 0 ? sectorials.size : 0,
    sectorials: sectorials.size,
    totalSectorials,
  }
}

function getTotalSectorialsForFaction(parentFaction: string) {
  const faction = normalizeArmyForDisplay(parentFaction)

  if (!faction) {
    return 0
  }

  return CANONICAL_ARMY_REGISTRY.filter(
    (army) => army.active && army.type === 'Sectorial' && army.parentFaction === faction,
  ).length
}

function isCanonicalSectorial(value: string) {
  const canonicalName = normalizeArmyForDisplay(value)

  return CANONICAL_ARMY_REGISTRY.some(
    (army) => army.active && army.type === 'Sectorial' && army.name === canonicalName,
  )
}

function getCountLeader(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([name, count]) => ({ count, name }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))[0] ?? {
      count: 0,
      name: '',
    }
}

function getUniqueExplorerOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

function formatExplorerPlayer(list: ArmyIntelligenceArmyList) {
  return list.playerDisplayName || list.player || 'Unknown Player'
}

function formatExplorerDate(value: string) {
  if (!value) {
    return 'Not recorded'
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getExplorerDateTime(value: string) {
  if (!value) {
    return 0
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function getArmyIntelligenceListTarget(list: ArmyIntelligenceArmyList) {
  const value = (list.armyCode || list.armyLink || String(list.id)).trim()

  return `/army-list/${encodeURIComponent(value)}`
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
