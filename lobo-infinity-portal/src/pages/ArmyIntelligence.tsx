import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import InteractiveMetricCard from '../components/InteractiveMetricCard'
import Skeleton from '../components/Skeleton'
import lieutenantOrderReference from '../../docs/mockups/lieutenant-order-reference.png'
import { CANONICAL_ARMY_REGISTRY } from '../config/armies'
import { readArmyIntelligenceFactionParam } from '../services/armyIntelligenceNavigation'
import { publicArmyWorkspace } from '../services/publicArmyWorkspaceProjection'
import { getCanonicalArmyListForIntelligenceSource } from '../services/armyIntelligenceExplorer'
import { getArmyParentFaction, normalizeArmyForDisplay } from '../services/armyIdentity'
import { getInfinityArmyTarget } from '../services/infinityArmyLinks'
import {
  apiClient,
  type ArmyIntelligenceArmyList,
  type ArmyIntelligenceDecodedEntry,
  type ArmyIntelligenceFactionData,
  type ArmyIntelligenceList,
  type ArmyIntelligenceSummaryData,
  type OperationsQueueData,
  type OperationsQueueItem,
  type OperationsStateData,
} from '../services/api'

type ArmyIntelligenceState =
  | {
      status: 'loading'
    }
  | {
      data: ArmyIntelligenceSummaryData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

type ArmyIntelligenceFactionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { data: ArmyIntelligenceFactionData; status: 'success' }
  | { error: string; status: 'error' }

type AnalysisResultFilter = 'all' | 'winning' | 'losing'
type ArmyListExplorerSort = 'submissionDate' | 'player' | 'sectorial' | 'points'
type ModelUsageSort = 'alphabetical' | 'pointsHigh' | 'pointsLow'
type UsageRow = {
  equipment?: string[]
  listCount: number
  name: string
  percentage: number
  avaTaken?: number
  points?: number
  profile?: string
  profileDisplayLabel?: string
  profileKey?: string
  profileLabel?: string
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

type UsageGroup = {
  listCount: number
  name: string
  percentage: number
  profiles: UsageRow[]
  totalSelections: number
}

type IntelligenceBriefObservation = {
  heading: string
  id: string
  priority: number
  text: string
}

type IntelligenceBriefTroopGroup = {
  listCount: number
  name: string
  percentage: number
  totalSelections: number
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

function ArmyIntelligence() {
  const [state, setState] = useState<ArmyIntelligenceState>({
    status: 'loading',
  })

  const loadArmyIntelligence = useCallback((signal?: AbortSignal) =>
    publicArmyWorkspace
      .getIntelligenceSummary(signal)
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

  return <ArmyIntelligenceContent data={state.data} />
}

function ArmyIntelligenceContent({
  data: summary,
}: {
  data: ArmyIntelligenceSummaryData
}) {
  const [searchParams] = useSearchParams()
  const requestedFaction = readArmyIntelligenceFactionParam(searchParams)
  const [selectedSectorial, setSelectedSectorial] = useState(requestedFaction)
  const [factionState, setFactionState] = useState<ArmyIntelligenceFactionState>(
    requestedFaction ? { status: 'loading' } : { status: 'idle' },
  )
  const [resultFilter, setResultFilter] = useState<AnalysisResultFilter>('all')
  const [modelEquipmentFilter, setModelEquipmentFilter] = useState('')
  const [modelSearchFilter, setModelSearchFilter] = useState('')
  const [modelSkillFilter, setModelSkillFilter] = useState('')
  const [modelSort, setModelSort] = useState<ModelUsageSort>('alphabetical')
  const [modelTypeFilter, setModelTypeFilter] = useState('')
  const [modelWeaponFilter, setModelWeaponFilter] = useState('')
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [explorerPlayerFilter, setExplorerPlayerFilter] = useState('')
  const [explorerSearch, setExplorerSearch] = useState('')
  const [explorerSectorialFilter, setExplorerSectorialFilter] = useState('')
  const [explorerSort, setExplorerSort] = useState<ArmyListExplorerSort>('submissionDate')

  const factionData = factionState.status === 'success' ? factionState.data : null
  const decodedLists = useMemo(
    () => (factionData?.lists ?? []).filter(isDecodedList),
    [factionData?.lists],
  )
  const uniqueDecodedLists = useMemo(
    () => deduplicateSubmittedArmyLists(decodedLists),
    [decodedLists],
  )
  const sectorials = summary.options
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
    () => buildExplorerRowsFromSelectedLists(matchingLists, factionData?.armyLists ?? []),
    [factionData?.armyLists, matchingLists],
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
  const intelligenceBrief = useMemo(
    () => buildIntelligenceBrief(matchingLists, analysis, selectedExplorerScope.label || selectedSectorial),
    [analysis, matchingLists, selectedExplorerScope.label, selectedSectorial],
  )
  const equipmentOptions = useMemo(() => buildEquipmentOptions(matchingLists), [matchingLists])
  const skillOptions = useMemo(() => buildSkillOptions(matchingLists), [matchingLists])
  const weaponOptions = useMemo(() => buildWeaponOptions(matchingLists), [matchingLists])
  const filteredModelUsage = useMemo(
    () =>
      filterAndSortModelUsage(
        analysis.modelUsage,
        {
          equipment: modelEquipmentFilter,
          search: modelSearchFilter,
          skill: modelSkillFilter,
          sort: modelSort,
          troopType: modelTypeFilter,
          weapon: modelWeaponFilter,
        },
    ),
    [analysis.modelUsage, modelEquipmentFilter, modelSearchFilter, modelSkillFilter, modelSort, modelTypeFilter, modelWeaponFilter],
  )

  useEffect(() => {
    if (!requestedFaction || requestedFaction === selectedSectorial) {
      return
    }

    setSelectedSectorial(requestedFaction)
  }, [requestedFaction, selectedSectorial])

  useEffect(() => {
    if (!selectedSectorial) {
      setFactionState({ status: 'idle' })
      return
    }

    const controller = new AbortController()
    const requestedSectorial = selectedSectorial

    setFactionState({ status: 'loading' })
    void publicArmyWorkspace
      .getIntelligenceFaction(requestedSectorial, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted && requestedSectorial === selectedSectorial) {
          setFactionState({ data, status: 'success' })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setFactionState({
          error: error instanceof Error ? error.message : 'Army Intelligence faction data could not be loaded.',
          status: 'error',
        })
      })

    return () => controller.abort()
  }, [selectedSectorial])

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
        <ArmyIntelligenceOperationsStatus />
      </section>

      {!selectedSectorial ? (
        <section className="panel army-intelligence-empty" aria-label="Choose a sectorial">
          <p>Choose a sectorial to view army-list analysis.</p>
        </section>
      ) : factionState.status === 'loading' ? (
        <section className="army-intelligence-summary" aria-label="Selected Army Intelligence loading">
          <Skeleton label={`${selectedSectorial} intelligence loading`} rows={5} />
        </section>
      ) : factionState.status === 'error' ? (
        <section className="dashboard-state" aria-label="Selected Army Intelligence error">
          <p role="alert">{factionState.error}</p>
        </section>
      ) : matchingLists.length === 0 ? (
        <section className="panel army-intelligence-empty" aria-label="No matching army lists">
          <p>No decoded army lists match the selected sectorial and result filter.</p>
        </section>
      ) : (
        <>
          <IntelligenceBrief observations={intelligenceBrief} />

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
              <span>Search</span>
              <input
                onChange={(event) => setModelSearchFilter(event.target.value)}
                placeholder="Troop or profile"
                type="search"
                value={modelSearchFilter}
              />
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

          <UsagePanel
            items={filteredModelUsage}
            search={modelSearchFilter}
            title="Model Usage"
            variant="wide"
          />

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

type ArmyIntelligenceOperationsStatusState =
  | {
      status: 'idle'
    }
  | {
      status: 'loading'
    }
  | {
      queue: OperationsQueueData
      state: OperationsStateData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function ArmyIntelligenceOperationsStatus() {
  const auth = useAuth()
  const canViewOperations = auth.isAtLeastRole('Assistant Commissioner')
  const [state, setState] = useState<ArmyIntelligenceOperationsStatusState>({
    status: 'idle',
  })

  useEffect(() => {
    if (
      auth.status !== 'ready' ||
      !auth.authenticated ||
      !canViewOperations
    ) {
      return
    }

    const controller = new AbortController()

    async function loadOperationsStatus() {
      setState({ status: 'loading' })

      try {
        const [operationsState, operationsQueue] = await Promise.all([
          apiClient.getOperationsState({ signal: controller.signal }),
          apiClient.getOperationsQueue({ signal: controller.signal }),
        ])

        setState({
          queue: operationsQueue,
          state: operationsState,
          status: 'success',
        })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Operations Engine status could not be loaded.',
          status: 'error',
        })
      }
    }

    void loadOperationsStatus()

    return () => {
      controller.abort()
    }
  }, [auth.authenticated, auth.status, canViewOperations])

  if (!canViewOperations) {
    return null
  }

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div className="army-intelligence-operations-status" aria-live="polite">
        <span>Automatic Operations</span>
        <strong>Loading status</strong>
        <p>The Operations Engine refreshes Army Intelligence automatically when upstream artifacts change.</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="army-intelligence-operations-status is-error" aria-live="polite">
        <span>Automatic Operations</span>
        <strong>Status unavailable</strong>
        <p>{state.error}</p>
      </div>
    )
  }

  const armyState =
    state.state.states.find((item) => item.subsystemId === 'armyIntelligence')
  const operation =
    findArmyIntelligenceOperation(state.queue.queue)

  return (
    <div className="army-intelligence-operations-status" aria-live="polite">
      <span>Automatic Operations</span>
      <strong>{formatArmyIntelligenceOperationsStatus(armyState)}</strong>
      <p>The Operations Engine refreshes Army Intelligence automatically after Game Engine changes.</p>
      <small>
        {operation
          ? `${operation.operationType}: ${operation.status}`
          : 'No Army Intelligence operation is currently pending.'}
      </small>
    </div>
  )
}

function findArmyIntelligenceOperation(queue: OperationsQueueItem[]) {
  const blockingStatuses = [
    'Queued',
    'Running',
    'Waiting on Dependency',
    'Retrying',
    'Failed',
  ]

  return queue.find((operation) => {
    return (
      operation.owningSubsystem === 'armyIntelligence' &&
      blockingStatuses.includes(operation.status)
    )
  })
}

function formatArmyIntelligenceOperationsStatus(
  state: OperationsStateData['states'][number] | undefined,
) {
  if (!state) {
    return 'State unavailable'
  }

  if (!state.healthy) {
    return 'Unhealthy'
  }

  if (state.stale) {
    return `Stale${state.staleReason ? `: ${state.staleReason}` : ''}`
  }

  return 'Healthy'
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
                      <ArmyIntelligenceOpenList armyCode={list.armyCode} />
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

function IntelligenceBrief({ observations }: { observations: IntelligenceBriefObservation[] }) {
  return (
    <section className="panel army-intelligence-brief" aria-labelledby="army-intelligence-brief-title">
      <div className="army-intelligence-brief-header">
        <span aria-hidden="true">INTEL</span>
        <h2 id="army-intelligence-brief-title">Intelligence Brief</h2>
      </div>
      {observations.length > 0 ? (
        <ul>
          {observations.map((observation) => (
            <li key={observation.id}>
              <strong>{observation.heading}</strong>
              <span>{observation.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Additional Army Lists are needed before meaningful intelligence can be generated.</p>
      )}
    </section>
  )
}

function UsagePanel({
  items,
  search = '',
  titleHidden,
  title,
  variant,
}: {
  items: UsageRow[]
  search?: string
  titleHidden?: boolean
  title: string
  variant?: 'wide'
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const visible = items.slice(0, variant === 'wide' ? 24 : 10)
  const usageGroups = buildUsageGroups(items)
  const shouldGroup = variant === 'wide' || usageGroups.some((group) => group.profiles.length > 1)
  const visibleGroups = shouldGroup
    ? usageGroups.slice(0, variant === 'wide' ? 24 : 10)
    : []
  const normalizedSearch = normalizeSearchToken(search)

  function toggleGroup(name: string) {
    setExpandedGroups((current) => {
      const next = new Set(current)

      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }

      return next
    })
  }

  return (
    <section
      className={`${titleHidden ? '' : 'panel '}army-intelligence-panel${titleHidden ? ' army-intelligence-panel-embedded' : ''}${variant === 'wide' ? ' army-intelligence-panel-wide' : ''}`}
      aria-labelledby={titleHidden ? undefined : `${slugify(title)}-title`}
    >
      {!titleHidden && variant !== 'wide' ? (
        <h2 id={`${slugify(title)}-title`}>{title}</h2>
      ) : null}
      {items.length === 0 ? (
        <p>None</p>
      ) : shouldGroup ? (
        <div className="army-intelligence-usage-groups">
          <div className="army-intelligence-usage-list army-intelligence-usage-list-header">
            <span className="army-intelligence-profile-cell">Troop / Profile</span>
            <strong title="Total models across all submitted Army Lists.">Copies</strong>
            {variant === 'wide' ? <small className="army-intelligence-points-cell">Points</small> : null}
            <small className="army-intelligence-lists-cell" title="Number of submitted Army Lists containing this troop.">Lists</small>
            {variant === 'wide' ? (
              <>
                <small className="army-intelligence-avg-copies-cell" title="Average number of copies when the troop is taken.">Avg Copies/List</small>
                <small className="army-intelligence-coverage-cell" title="Percentage of submitted Army Lists containing the troop.">List Coverage</small>
              </>
            ) : null}
          </div>
          {visibleGroups.map((group) => (
            <div
              className={`army-intelligence-usage-group${doesGroupNameMatchSearch(group, normalizedSearch) ? ' is-search-match' : ''}`}
              data-open={isUsageGroupOpen(group, expandedGroups, normalizedSearch) ? 'true' : 'false'}
              key={group.name}
            >
              <button
                aria-controls={`${slugify(title)}-${slugify(group.name)}-profiles`}
                aria-expanded={isUsageGroupOpen(group, expandedGroups, normalizedSearch)}
                aria-label={`${group.name}, ${group.totalSelections} copies. ${isUsageGroupOpen(group, expandedGroups, normalizedSearch) ? 'Collapse' : 'Expand'} profiles.`}
                className="army-intelligence-usage-group-summary"
                onClick={() => toggleGroup(group.name)}
                onKeyDown={handleUsageGroupKeyDown}
                type="button"
              >
                <span className="army-intelligence-profile-cell">
                  <span>{group.name} ({group.totalSelections})</span>
                  <small>{group.profiles.length} profiles</small>
                </span>
                <strong>{group.totalSelections}</strong>
                {variant === 'wide' ? <small className="army-intelligence-points-cell">-</small> : null}
                <small className="army-intelligence-lists-cell">
                  {variant === 'wide'
                    ? `${group.listCount} lists`
                    : `${group.listCount} lists / ${formatNumber(group.percentage)}%`}
                </small>
                {variant === 'wide' ? (
                  <>
                    <small className="army-intelligence-avg-copies-cell">
                      {formatAvaTaken(calculateAverageCopiesPerContainingList(group.totalSelections, group.listCount))}
                    </small>
                    <small className="army-intelligence-coverage-cell">
                      {formatNumber(group.percentage)}%
                    </small>
                  </>
                ) : null}
              </button>
              <ol
                className="army-intelligence-usage-list army-intelligence-profile-usage-list"
                hidden={!isUsageGroupOpen(group, expandedGroups, normalizedSearch)}
                id={`${slugify(title)}-${slugify(group.name)}-profiles`}
              >
                {group.profiles.map((item) => (
                  <li key={`${item.profileKey ?? item.profile ?? item.name}|${item.points ?? ''}|${item.troopType ?? ''}`}>
                    <span className="army-intelligence-profile-cell">
                      <span>{item.profileDisplayLabel || item.profileLabel || formatModelUsageName(item)}</span>
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
                      <>
                        <small className="army-intelligence-avg-copies-cell">
                          {formatAvaTaken(item.avaTaken)}
                        </small>
                        <small className="army-intelligence-coverage-cell">
                          {formatNumber(item.percentage)}%
                        </small>
                      </>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <ol className="army-intelligence-usage-list">
          <li className="army-intelligence-usage-list-header">
            <span className="army-intelligence-profile-cell">Profile</span>
            <strong title="Total models across all submitted Army Lists.">Copies</strong>
            {variant === 'wide' ? <small className="army-intelligence-points-cell">Points</small> : null}
            <small className="army-intelligence-lists-cell" title="Number of submitted Army Lists containing this troop.">Lists</small>
            {variant === 'wide' ? (
              <>
                <small className="army-intelligence-avg-copies-cell" title="Average number of copies when the troop is taken.">Avg Copies/List</small>
                <small className="army-intelligence-coverage-cell" title="Percentage of submitted Army Lists containing the troop.">List Coverage</small>
              </>
            ) : null}
          </li>
          {visible.map((item) => (
            <li key={`${item.profileKey ?? item.name}|${item.profile ?? ''}|${item.points ?? ''}|${item.troopType ?? ''}`}>
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
                <>
                  <small className="army-intelligence-avg-copies-cell">
                    {formatAvaTaken(item.avaTaken)}
                  </small>
                  <small className="army-intelligence-coverage-cell">
                    {formatNumber(item.percentage)}%
                  </small>
                </>
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
        ;(list.results ?? []).forEach((result) => existing.resultSet.add(result))
        return
      }

      const resultSet = normalizeResultValue(list.result)
      ;(list.results ?? []).forEach((result) => resultSet.add(result))

      uniqueByKey.set(key, {
        ...list,
        resultSet,
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
  return normalizeSectorialDisplayName(normalizeArmyForDisplay(list.decoded?.sectorial || list.sectorial || ''))
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
  return getDecodedSectorial(list) === scope.label
}

function getIntelligenceParentFaction(list: ArmyIntelligenceList) {
  return getArmyParentFaction(list.decoded?.faction) ||
    getArmyParentFaction(list.faction) ||
    normalizeArmyForDisplay(list.faction)
}

function buildExplorerRowsFromSelectedLists(
  lists: UniqueArmyIntelligenceList[],
  canonicalArmyLists: ArmyIntelligenceArmyList[],
): ArmyIntelligenceArmyList[] {
  return lists.map((list, index) => {
    const canonicalList = getCanonicalArmyListForIntelligenceSource(list, canonicalArmyLists)

    return {
      id: canonicalList?.id ?? getStableExplorerRowId(list, index),
      armyCode: canonicalList?.armyCode ?? '',
      armyLink: canonicalList?.armyLink ?? '',
      armyName: canonicalList?.armyName || list.decoded?.listName || 'Untitled Army List',
      faction: canonicalList?.faction || getIntelligenceParentFaction(list),
      player: canonicalList?.player || list.player || list.sourcePlayer,
      playerDisplayName:
        canonicalList?.playerDisplayName ||
        canonicalList?.player ||
        list.player ||
        list.sourcePlayer ||
        'Unknown Player',
      points: canonicalList?.points ?? list.decoded?.totals.points ?? 0,
      sectorial: canonicalList?.sectorial || getDecodedSectorial(list),
      source: canonicalList?.source || formatIntelligenceSource(list),
      submissionDate: canonicalList?.submissionDate || list.date || list.decodedAt,
      swc: canonicalList?.swc ?? list.decoded?.totals.swc ?? 0,
    }
  })
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

function ArmyIntelligenceOpenList({ armyCode }: { armyCode: string }) {
  const target = getInfinityArmyTarget(armyCode)

  if (target.status === 'available') {
    return (
      <a href={target.href} rel="noreferrer" target="_blank">
        Open List
      </a>
    )
  }

  return (
    <button
      aria-label={`Open List unavailable: ${target.reason}`}
      disabled
      title={target.reason}
      type="button"
    >
      Open List
    </button>
  )
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

function buildIntelligenceBrief(
  lists: ArmyIntelligenceList[],
  analysis: ArmyAnalysis,
  selectedScope: string,
): IntelligenceBriefObservation[] {
  const decodedListCount = analysis.listCount

  if (decodedListCount < 2) {
    return []
  }

  const observations: IntelligenceBriefObservation[] = []
  const scopeName = selectedScope || 'the selected force'
  const troopGroups = buildIntelligenceBriefTroopGroups(lists)
  const usageGroups = buildUsageGroups(analysis.modelUsage)
  const topGroup = troopGroups[0]
  const topCoverageGroup = [...troopGroups].sort(compareUsageGroupsByCoverage)[0]

  if (topCoverageGroup && topCoverageGroup.percentage >= 100) {
    observations.push({
      heading: 'Core Unit',
      id: `coverage-total-${normalizeObservationId(topCoverageGroup.name)}`,
      priority: 10,
      text: `The ${topCoverageGroup.name} appears in every known ${scopeName} list, making it a defining element of this force.`,
    })
  } else if (topCoverageGroup && topCoverageGroup.percentage >= 75) {
    observations.push({
      heading: 'Widely Adopted',
      id: `coverage-high-${normalizeObservationId(topCoverageGroup.name)}`,
      priority: 20,
      text: `The ${topCoverageGroup.name} appears in ${formatPercentValue(topCoverageGroup.percentage)} of known ${scopeName} lists, indicating broad adoption across submitted forces.`,
    })
  }

  if (topGroup) {
    observations.push({
      heading: 'Common List Construction',
      id: `most-common-troop-${normalizeObservationId(topGroup.name)}`,
      priority: 30,
      text: `${topGroup.name} is the most common troop, with ${topGroup.totalSelections} decoded copies across ${formatListCount(topGroup.listCount)}.`,
    })
  }

  const topProfileGroup = usageGroups.find((group) => group.profiles.length > 1)
  const topProfile = topProfileGroup?.profiles[0]
  if (topProfileGroup && topProfile) {
    observations.push({
      heading: 'Popular Profile',
      id: `top-profile-${normalizeObservationId(topProfileGroup.name)}-${normalizeObservationId(getUsageProfileDisplayLabel(topProfile))}`,
      priority: 40,
      text: `The most common ${topProfileGroup.name} profile is ${getUsageProfileDisplayLabel(topProfile)}, marking it as the preferred decoded loadout for that troop.`,
    })
  }

  addRoleCoverageObservation(observations, 'hacker', 'Hackers', lists, (entry) => entry.hacker, 50)
  addRoleCoverageObservation(observations, 'engineer', 'Engineers', lists, (entry) => entry.engineer, 60)
  addRoleCoverageObservation(observations, 'specialist', 'Specialists', lists, (entry) => entry.specialist, 70)

  if (analysis.averageRegularOrders > 0) {
    observations.push({
      heading: analysis.averageRegularOrders >= 12 ? 'High Order Count' : 'Order Baseline',
      id: 'average-regular-orders',
      priority: 80,
      text: `Known lists average ${formatNumber(analysis.averageRegularOrders)} Regular Orders, indicating the baseline order efficiency of this force.`,
    })
  }

  if (analysis.averageTacticalAwarenessOrders > 0) {
    observations.push({
      heading: 'Tactical Awareness',
      id: 'average-tactical-awareness-orders',
      priority: 90,
      text: `Known lists average ${formatNumber(analysis.averageTacticalAwarenessOrders)} Tactical Awareness Orders, adding extra activation pressure beyond the regular order pool.`,
    })
  }

  if (analysis.averagePoints > 0) {
    observations.push({
      heading: 'Points Profile',
      id: 'average-points',
      priority: 100,
      text: `Submitted lists average ${formatNumber(analysis.averagePoints)} points, showing the typical list size represented in this intelligence sample.`,
    })
  }

  return deduplicateBriefObservations(observations)
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
    .slice(0, 5)
}

function addRoleCoverageObservation(
  observations: IntelligenceBriefObservation[],
  id: string,
  label: string,
  lists: ArmyIntelligenceList[],
  predicate: (entry: ArmyIntelligenceDecodedEntry) => boolean,
  priority: number,
) {
  const decodedLists = lists.filter((list) => Boolean(list.decoded))
  const total = decodedLists.length

  if (total < 2) {
    return
  }

  const listCount = decodedLists.filter((list) =>
    list.decoded?.combatGroups.some((group) => group.entries.some(predicate)),
  ).length
  const percentage = (listCount / total) * 100

  if (percentage === 0) {
    observations.push({
      heading: `No ${label}`,
      id: `${id}-absent`,
      priority,
      text: `No submitted lists include ${label.toLocaleLowerCase()}, leaving that battlefield role absent from the current intelligence sample.`,
    })
    return
  }

  if (percentage === 100) {
    observations.push({
      heading: getRoleCoverageHeading(id, percentage),
      id: `${id}-total`,
      priority,
      text: `${label} appear in every submitted list, making that role a consistent part of the force package.`,
    })
    return
  }

  if (percentage >= 75 || percentage <= 25) {
    observations.push({
      heading: getRoleCoverageHeading(id, percentage),
      id: `${id}-coverage-${Math.round(percentage)}`,
      priority,
      text: `${label} appear in ${formatPercentValue(percentage)} of submitted lists, ${percentage >= 75 ? 'showing strong role coverage across known forces' : 'indicating limited role support in the current sample'}.`,
    })
  }
}

function getRoleCoverageHeading(id: string, percentage: number) {
  if (id === 'hacker' && percentage >= 75) {
    return 'Heavy Hacker Presence'
  }

  if (id === 'engineer' && percentage <= 25) {
    return 'Limited Engineer Support'
  }

  if (id === 'specialist' && percentage >= 75) {
    return 'Specialist Coverage'
  }

  return percentage >= 75 ? 'Strong Role Coverage' : 'Low Coverage'
}

function buildIntelligenceBriefTroopGroups(lists: ArmyIntelligenceList[]): IntelligenceBriefTroopGroup[] {
  const decodedLists = lists.filter((list): list is ArmyIntelligenceList & { decoded: NonNullable<ArmyIntelligenceList['decoded']> } =>
    Boolean(list.decoded),
  )
  const groups = new Map<string, {
    listIndexes: Set<number>
    name: string
    totalSelections: number
  }>()

  decodedLists.forEach((list, listIndex) => {
    list.decoded.combatGroups.forEach((group) => {
      group.entries.forEach((entry) => {
        const name = getModelName(entry)
        if (!name) {
          return
        }

        const current = groups.get(name) ?? {
          listIndexes: new Set<number>(),
          name,
          totalSelections: 0,
        }
        current.listIndexes.add(listIndex)
        current.totalSelections += 1
        groups.set(name, current)
      })
    })
  })

  return Array.from(groups.values())
    .map((group) => ({
      listCount: group.listIndexes.size,
      name: group.name,
      percentage: decodedLists.length ? (group.listIndexes.size / decodedLists.length) * 100 : 0,
      totalSelections: group.totalSelections,
    }))
    .sort(
      (left, right) =>
        right.totalSelections - left.totalSelections ||
        right.listCount - left.listCount ||
        left.name.localeCompare(right.name),
    )
}

function compareUsageGroupsByCoverage(left: IntelligenceBriefTroopGroup, right: IntelligenceBriefTroopGroup) {
  return right.percentage - left.percentage ||
    right.listCount - left.listCount ||
    right.totalSelections - left.totalSelections ||
    left.name.localeCompare(right.name)
}

function deduplicateBriefObservations(observations: IntelligenceBriefObservation[]) {
  const seen = new Set<string>()

  return observations.filter((observation) => {
    const key = normalizeSearchToken(observation.text)
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function normalizeObservationId(value: string) {
  return normalizeSearchToken(value).replace(/\s+/g, '-')
}

function formatPercentValue(value: number) {
  return `${formatNumber(value)}%`
}

function formatListCount(value: number) {
  return `${value} ${value === 1 ? 'list' : 'lists'}`
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
    search?: string
    skill: string
    sort: ModelUsageSort
    troopType: string
    weapon: string
  },
) {
  const query = normalizeSearchToken(filters.search ?? '')

  return rows
    .filter((row) => !filters.troopType || row.troopType === filters.troopType)
    .filter((row) => !filters.skill || rowSkills(row).includes(filters.skill))
    .filter((row) => !filters.weapon || rowWeapons(row).includes(filters.weapon))
    .filter((row) => !filters.equipment || rowEquipment(row).includes(filters.equipment))
    .filter((row) => !query || doesUsageRowMatchSearch(row, query))
    .sort((left, right) => compareModelUsageRows(left, right, filters.sort))
}

function buildModelUsageRows(entriesByList: ArmyIntelligenceDecodedEntry[][]): UsageRow[] {
  const rowsByKey = new Map<string, ModelUsageAccumulator>()
  const listAppearances = new Map<string, Set<number>>()

  entriesByList.forEach((entries, listIndex) => {
    entries.forEach((entry) => {
      const name = getModelName(entry)
      const profileKey = getProfileAggregationKey(entry)

      if (!name || !profileKey) {
        return
      }

      const key = [profileKey, entry.points, entry.troopType].join('|')
      const row = rowsByKey.get(key) ?? {
        equipment: new Set<string>(),
        listCount: 0,
        name,
        percentage: 0,
        points: entry.points,
        profile: entry.profile,
        profileDisplayLabel: getProfileDisplayLabel(entry),
        profileKey,
        profileLabel: getProfileDisplayLabel(entry),
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
      profileDisplayLabel: row.profileDisplayLabel,
      profileKey: row.profileKey,
      profileLabel: row.profileLabel,
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
  const rowsByKey = new Map<string, ModelUsageAccumulator>()
  const listAppearances = new Map<string, Set<number>>()

  entriesByList.forEach((entries, listIndex) => {
    const seenInList = new Set<string>()

    entries.filter(predicate).forEach((entry) => {
      const name = getModelName(entry)
      const profileKey = getProfileAggregationKey(entry)

      if (!name || !profileKey) {
        return
      }

      const row = rowsByKey.get(profileKey) ?? {
        equipment: new Set<string>(),
        listCount: 0,
        name,
        percentage: 0,
        points: entry.points,
        profile: entry.profile,
        profileDisplayLabel: getProfileDisplayLabel(entry),
        profileKey,
        profileLabel: getProfileDisplayLabel(entry),
        skills: new Set<string>(),
        totalSelections: 0,
        troopType: entry.troopType,
        weapons: new Set<string>(),
      }

      row.totalSelections += 1
      rowsByKey.set(profileKey, row)
      seenInList.add(profileKey)
    })

    seenInList.forEach((profileKey) => {
      const appearances = listAppearances.get(profileKey) ?? new Set<number>()
      appearances.add(listIndex)
      listAppearances.set(profileKey, appearances)
    })
  })

  return Array.from(rowsByKey.entries())
    .map(([profileKey, row]) => {
      const listCount = listAppearances.get(profileKey)?.size ?? 0

      return {
        equipment: Array.from(row.equipment),
        listCount,
        name: row.name,
        percentage: entriesByList.length ? (listCount / entriesByList.length) * 100 : 0,
        points: row.points,
        profile: row.profile,
        profileDisplayLabel: row.profileDisplayLabel,
        profileKey,
        profileLabel: row.profileLabel,
        skills: Array.from(row.skills),
        totalSelections: row.totalSelections,
        troopType: row.troopType,
        weapons: Array.from(row.weapons),
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

function getProfileAggregationKey(entry: ArmyIntelligenceDecodedEntry) {
  return (entry.profile || entry.unit).trim()
}

function getProfileDisplayLabel(entry: ArmyIntelligenceDecodedEntry) {
  const name = getModelName(entry)
  const profile = (entry.profile || name).trim()
  return removeTroopNamePrefix(profile, name)
}

function removeTroopNamePrefix(profile: string, troopName: string) {
  const trimmedProfile = profile.trim()
  const trimmedTroopName = troopName.trim()

  if (!trimmedProfile || !trimmedTroopName || trimmedProfile === trimmedTroopName) {
    return trimmedProfile || trimmedTroopName
  }

  const normalizedName = trimmedTroopName.toLocaleLowerCase()
  const normalizedProfile = trimmedProfile.toLocaleLowerCase()

  if (normalizedProfile.startsWith(normalizedName)) {
    return trimProfileLabelSeparator(trimmedProfile.slice(trimmedTroopName.length)) || trimmedTroopName
  }

  return trimmedProfile
}

function trimProfileLabelSeparator(value: string) {
  let start = 0
  let end = value.length

  while (start < end && isProfileLabelSeparator(value[start])) {
    start += 1
  }

  while (end > start && isProfileLabelSeparator(value[end - 1])) {
    end -= 1
  }

  return value.slice(start, end)
}

function isProfileLabelSeparator(value: string) {
  return value === ' ' || value === '-' || value === ':' || value === '/'
}

function buildUsageGroups(rows: UsageRow[]): UsageGroup[] {
  const groups = new Map<string, UsageGroup>()

  rows.forEach((row) => {
    const current = groups.get(row.name) ?? {
      listCount: 0,
      name: row.name,
      percentage: 0,
      profiles: [],
      totalSelections: 0,
    }

    current.profiles.push(row)
    current.totalSelections += row.totalSelections
    current.listCount = Math.max(current.listCount, row.listCount)
    current.percentage = Math.max(current.percentage, row.percentage)
    groups.set(row.name, current)
  })

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      profiles: resolveUniqueProfileDisplayLabels(group.profiles, group.name).sort(compareUsageGroupProfiles),
    }))
    .sort(
      (left, right) =>
        right.totalSelections - left.totalSelections ||
        right.listCount - left.listCount ||
        left.name.localeCompare(right.name),
    )
}

function compareUsageGroupProfiles(left: UsageRow, right: UsageRow) {
  return right.totalSelections - left.totalSelections ||
    right.listCount - left.listCount ||
    getUsageProfileDisplayLabel(left).localeCompare(getUsageProfileDisplayLabel(right))
}

function resolveUniqueProfileDisplayLabels(rows: UsageRow[], troopName: string) {
  const rowsWithBaseLabels = rows.map((row) => ({
    baseLabel: getUsageProfileBaseLabel(row, troopName),
    row,
  }))
  const duplicateCounts = countNormalizedLabels(rowsWithBaseLabels.map((item) => item.baseLabel))

  return rowsWithBaseLabels.map(({ baseLabel, row }) => {
    if ((duplicateCounts.get(normalizeSearchToken(baseLabel)) ?? 0) <= 1) {
      return {
        ...row,
        profileDisplayLabel: baseLabel,
      }
    }

    return {
      ...row,
      profileDisplayLabel: getShortestUniqueProfileDisplayLabel(row, rows, troopName, baseLabel),
    }
  })
}

function countNormalizedLabels(labels: string[]) {
  const counts = new Map<string, number>()

  labels.forEach((label) => {
    const key = normalizeSearchToken(label)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })

  return counts
}

function getUsageProfileBaseLabel(row: UsageRow, troopName: string) {
  const canonicalProfile = (row.profileKey || row.profile || row.profileLabel || row.name).trim()
  const designation = getUsageProfileDesignation(canonicalProfile, troopName)
  return buildCanonicalProfileDisplayLabel(designation, row)
}

function getUsageProfileDesignation(profile: string, troopName: string) {
  const designation = removeTroopNamePrefix(profile, troopName)

  return normalizeProfileIdentityToken(designation) === normalizeProfileIdentityToken(troopName)
    ? ''
    : designation
}

function getShortestUniqueProfileDisplayLabel(
  row: UsageRow,
  rows: UsageRow[],
  troopName: string,
  baseLabel: string,
) {
  const candidates = buildProfileDisplayLabelCandidates(row, troopName, baseLabel)

  return candidates.find((candidate) =>
    rows.every((other) =>
      other === row ||
      !buildProfileDisplayLabelCandidates(other, troopName, getUsageProfileBaseLabel(other, troopName))
        .some((otherCandidate) => normalizeSearchToken(otherCandidate) === normalizeSearchToken(candidate)),
    ),
  ) ?? candidates[candidates.length - 1] ?? baseLabel
}

function buildProfileDisplayLabelCandidates(row: UsageRow, troopName: string, baseLabel: string) {
  const labels: string[] = [baseLabel]
  const designation = getUsageProfileDesignation((row.profileKey || row.profile || row.profileLabel || '').trim(), troopName)
  const primaryWeapon = getPrimaryProfileWeapon(row)
  const metadataTokens = getProfileDisambiguationTokens(row, designation || baseLabel, primaryWeapon)

  metadataTokens.forEach((_, index) => {
    labels.push(buildCanonicalProfileDisplayLabel(
      formatProfileDesignationWithMetadata(designation || baseLabel, metadataTokens.slice(0, index + 1)),
      row,
      primaryWeapon,
    ))
  })

  const canonicalProfile = removeTroopNamePrefix((row.profileKey || row.profile || '').trim(), troopName)
  if (canonicalProfile && !labels.some((label) => normalizeSearchToken(label) === normalizeSearchToken(canonicalProfile))) {
    labels.push(canonicalProfile)
  }

  if (typeof row.points === 'number') {
    labels.push(`${baseLabel} (${row.points} pts)`)
  }

  if (row.troopType) {
    labels.push(`${baseLabel} (${row.troopType})`)
  }

  const stableKeyParts = [row.profileKey, row.points, row.troopType]
    .filter((value) => value !== undefined && value !== '')

  if (stableKeyParts.length > 0) {
    labels.push(`${baseLabel} (${stableKeyParts.join(', ')})`)
  }

  return labels
}

function buildCanonicalProfileDisplayLabel(
  designation: string,
  row: UsageRow,
  primaryWeapon = getPrimaryProfileWeapon(row),
) {
  const cleanDesignation = removePrimaryWeaponFromDesignation(designation, primaryWeapon)

  if (!primaryWeapon) {
    return cleanDesignation || designation.trim() || row.profileLabel || row.name
  }

  if (!cleanDesignation) {
    return primaryWeapon
  }

  return `${cleanDesignation} — ${primaryWeapon}`
}

function formatProfileDesignationWithMetadata(designation: string, metadataTokens: string[]) {
  const cleanDesignation = designation.trim()
  const uniqueMetadata = metadataTokens
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => normalizeSearchToken(token) !== normalizeSearchToken(cleanDesignation))

  if (uniqueMetadata.length === 0) {
    return cleanDesignation
  }

  return `${cleanDesignation} (${uniqueMetadata.join(', ')})`
}

function removePrimaryWeaponFromDesignation(designation: string, primaryWeapon: string) {
  const cleanDesignation = designation.trim()

  if (!cleanDesignation || !primaryWeapon) {
    return cleanDesignation
  }

  const normalizedDesignation = normalizeProfileIdentityToken(cleanDesignation)
  const normalizedWeapon = normalizeProfileIdentityToken(primaryWeapon)

  if (normalizedDesignation === normalizedWeapon || normalizedWeapon.includes(normalizedDesignation)) {
    return ''
  }

  if (!normalizedDesignation.includes(normalizedWeapon)) {
    return cleanDesignation
  }

  return cleanDesignation
    .split(/\s+/)
    .filter((part) => !normalizedWeapon.split(' ').includes(normalizeProfileIdentityToken(part)))
    .join(' ')
    .trim()
}

function getPrimaryProfileWeapon(row: UsageRow) {
  return rowWeapons(row)
    .map((weapon) => weapon.trim())
    .filter(Boolean)
    .find((weapon) => !isGenericProfileWeapon(weapon)) || ''
}

function isGenericProfileWeapon(weapon: string) {
  const normalizedWeapon = normalizeProfileIdentityToken(weapon)

  return normalizedWeapon === '' ||
    normalizedWeapon === 'cc weapon' ||
    normalizedWeapon.endsWith(' cc weapon') ||
    normalizedWeapon === 'knife' ||
    normalizedWeapon === 'pistol' ||
    normalizedWeapon === 'flash pulse' ||
    normalizedWeapon === 'gizmokit'
}

function normalizeProfileIdentityToken(value: string) {
  return normalizeSearchToken(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getProfileMetadataTokens(row: UsageRow) {
  const tokens = new Set<string>()

  ;[row.weapons ?? [], row.equipment ?? [], row.skills ?? []].forEach((group) => {
    group
      .map((token) => token.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .forEach((token) => tokens.add(token))
  })

  return Array.from(tokens)
}

function getProfileDisambiguationTokens(row: UsageRow, designation: string, primaryWeapon: string) {
  const normalizedDesignation = normalizeProfileIdentityToken(designation)
  const normalizedPrimaryWeapon = normalizeProfileIdentityToken(primaryWeapon)

  return getProfileMetadataTokens(row).filter((token) => {
    const normalizedToken = normalizeProfileIdentityToken(token)

    return normalizedToken &&
      normalizedToken !== normalizedDesignation &&
      normalizedToken !== normalizedPrimaryWeapon &&
      !isGenericProfileWeapon(token)
  })
}

function getUsageProfileDisplayLabel(row: UsageRow) {
  return row.profileDisplayLabel || row.profileLabel || formatModelUsageName(row)
}

function isUsageGroupOpen(
  group: UsageGroup,
  expandedGroups: Set<string>,
  normalizedSearch: string,
) {
  return expandedGroups.has(group.name) ||
    (Boolean(normalizedSearch) && group.profiles.some((row) => doesProfileRowMatchSearch(row, normalizedSearch)))
}

function doesUsageRowMatchSearch(row: UsageRow, normalizedSearch: string) {
  return normalizeSearchToken(row.name).includes(normalizedSearch) ||
    doesProfileRowMatchSearch(row, normalizedSearch)
}

function doesProfileRowMatchSearch(row: UsageRow, normalizedSearch: string) {
  return normalizeSearchToken(row.profileDisplayLabel ?? '').includes(normalizedSearch) ||
    normalizeSearchToken(row.profileLabel ?? '').includes(normalizedSearch) ||
    normalizeSearchToken(row.profile ?? '').includes(normalizedSearch) ||
    normalizeSearchToken(formatModelUsageName(row)).includes(normalizedSearch) ||
    getProfileMetadataTokens(row).some((token) => normalizeSearchToken(token).includes(normalizedSearch))
}

function doesGroupNameMatchSearch(group: UsageGroup, normalizedSearch: string) {
  return Boolean(normalizedSearch) && normalizeSearchToken(group.name).includes(normalizedSearch)
}

function normalizeSearchToken(value: string) {
  return value.trim().toLocaleLowerCase()
}

function handleUsageGroupKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.army-intelligence-usage-group-summary'),
  )
  const currentIndex = buttons.indexOf(event.currentTarget)

  if (currentIndex === -1) {
    return
  }

  event.preventDefault()
  const offset = event.key === 'ArrowDown' ? 1 : -1
  const nextIndex = (currentIndex + offset + buttons.length) % buttons.length
  buttons[nextIndex]?.focus()
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

function calculateAverageCopiesPerContainingList(copies: number, lists: number) {
  return lists > 0 ? copies / lists : 0
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export default ArmyIntelligence
