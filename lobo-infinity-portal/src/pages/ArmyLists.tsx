import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import OperatorBadge from '../components/OperatorBadge'
import Skeleton from '../components/Skeleton'
import { normalizeArmyForDisplay } from '../services/armyIdentity'
import {
  apiClient,
  type ArmyDiagnosticReport,
  type ArmyList,
  type SubmittedArmyListEntry,
} from '../services/api'
import { formatPlayerName } from '../services/formatting'
import { getInfinityArmyTarget } from '../services/infinityArmyLinks'
import { resolvePlayerFactionIdentity } from '../services/playerFactionIdentity'

type ArmyListFilter = {
  event: string
  faction: string
  gameType: string
  player: string
  result: string
}

type ArmyListsState =
  | {
      status: 'loading'
    }
  | {
      lists: SubmittedArmyListEntry[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

const defaultFilters: ArmyListFilter = {
  event: 'all',
  faction: 'all',
  gameType: 'all',
  player: 'all',
  result: 'all',
}

function ArmyLists() {
  const auth = useAuth()
  const canDiagnose =
    auth.hasPermission('viewOperations') ||
    auth.isAtLeastRole('Assistant Commissioner')
  const [state, setState] = useState<ArmyListsState>({
    status: 'loading',
  })
  const [filters, setFilters] = useState<ArmyListFilter>(defaultFilters)
  const [diagnosticSources, setDiagnosticSources] = useState<Map<string, ArmyList>>(
    () => new Map(),
  )
  const [diagnosticState, setDiagnosticState] = useState<{
    error: string
    loadingId: string
    report: ArmyDiagnosticReport | null
  }>({
    error: '',
    loadingId: '',
    report: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getSubmittedArmyListLibrary({
        signal: controller.signal,
      })
      .then((lists) => {
        setState({
          lists,
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
              : 'Submitted army lists could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!canDiagnose) {
      setDiagnosticSources(new Map())
      return
    }

    const controller = new AbortController()

    apiClient
      .getArmyLists({
        signal: controller.signal,
      })
      .then((data) => {
        setDiagnosticSources(
          new Map(
            data.lists.map((list) => [getArmyCodeDiagnosticKey(list.armyCode), list]),
          ),
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDiagnosticSources(new Map())
        }
      })

    return () => {
      controller.abort()
    }
  }, [canDiagnose])

  const filterOptions = useMemo(() => {
    if (state.status !== 'success') {
      return {
        events: [],
        factions: [],
        gameTypes: [],
        players: [],
        results: [],
      }
    }

    return {
      events: getUniqueOptions(state.lists.map((list) => list.eventName)),
      factions: getUniqueOptions(state.lists.map((list) => getArmyListFilterIdentity(list))),
      gameTypes: getUniqueOptions(state.lists.map((list) => list.gameType)),
      players: getUniqueOptions(state.lists.map((list) => getDisplayPlayer(list))),
      results: getUniqueOptions(state.lists.map((list) => list.result)),
    }
  }, [state])

  const visibleLists = useMemo(() => {
    if (state.status !== 'success') {
      return []
    }

    return state.lists
      .filter((list) => matchesFilter(getDisplayPlayer(list), filters.player))
      .filter((list) => matchesFilter(getArmyListFilterIdentity(list), filters.faction))
      .filter((list) => matchesFilter(list.gameType, filters.gameType))
      .filter((list) => matchesFilter(list.eventName, filters.event))
      .filter((list) => matchesFilter(list.result, filters.result))
  }, [filters, state])

  function updateFilter(name: keyof ArmyListFilter, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleDiagnose(list: SubmittedArmyListEntry) {
    const source = diagnosticSources.get(getArmyCodeDiagnosticKey(list.armyCode))

    if (!source) {
      setDiagnosticState({
        error: 'This displayed army row is not linked to a persisted Army List submission.',
        loadingId: '',
        report: null,
      })
      return
    }

    setDiagnosticState({
      error: '',
      loadingId: list.id,
      report: null,
    })

    try {
      const report = await apiClient.diagnoseArmyList(
        source.id,
        getDisplayedArmyUnits(list),
      )
      setDiagnosticState({
        error: '',
        loadingId: '',
        report,
      })
    } catch (error) {
      setDiagnosticState({
        error:
          error instanceof Error
            ? error.message
            : 'Army diagnostic could not be loaded.',
        loadingId: '',
        report: null,
      })
    }
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
      <section className="army-list-controls army-list-library-controls" aria-label="Army list filters loading">
          <select disabled><option>Player</option></select>
          <select disabled><option>Faction</option></select>
          <select disabled><option>Game Type</option></select>
          <select disabled><option>Event</option></select>
          <select disabled><option>Result</option></select>
        </section>
        <section className="army-list-grid" aria-label="Army lists loading">
          <Skeleton label="Submitted army lists loading" rows={8} />
          <Skeleton label="Submitted army lists loading" rows={8} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Army lists error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />

      <section className="army-list-controls army-list-library-controls" aria-label="Army list filters">
        <FilterSelect
          label="Player"
          onChange={(value) => updateFilter('player', value)}
          options={filterOptions.players}
          value={filters.player}
        />
        <FilterSelect
          label="Faction"
          onChange={(value) => updateFilter('faction', value)}
          options={filterOptions.factions}
          value={filters.faction}
        />
        <FilterSelect
          label="Game Type"
          onChange={(value) => updateFilter('gameType', value)}
          options={filterOptions.gameTypes}
          value={filters.gameType}
        />
        <FilterSelect
          label="Event"
          onChange={(value) => updateFilter('event', value)}
          options={filterOptions.events}
          value={filters.event}
        />
        <FilterSelect
          label="Result"
          onChange={(value) => updateFilter('result', value)}
          options={filterOptions.results}
          value={filters.result}
        />
      </section>

      {visibleLists.length === 0 ? (
        <section className="dashboard-state" aria-label="No army lists">
          <p>No submitted army lists match the current filters.</p>
        </section>
      ) : (
        <section className="army-list-grid army-list-library-grid" aria-label="Army List Library">
          {visibleLists.map((list) => (
            <ArmyListCard
              canDiagnose={
                canDiagnose &&
                diagnosticSources.has(getArmyCodeDiagnosticKey(list.armyCode))
              }
              diagnosing={diagnosticState.loadingId === list.id}
              key={list.id}
              list={list}
              onDiagnose={handleDiagnose}
            />
          ))}
        </section>
      )}
      <ArmyDiagnosticModal
        error={diagnosticState.error}
        onClose={() =>
          setDiagnosticState({
            error: '',
            loadingId: '',
            report: null,
          })
        }
        report={diagnosticState.report}
      />
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="army-lists-title">
      <p className="eyebrow">Community</p>
      <h1 id="army-lists-title">Army List Library</h1>
      <p>Submitted game lists from League, Casual, and Tournament battle reports</p>
    </section>
  )
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: string[]
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function ArmyListCard({
  canDiagnose,
  diagnosing,
  list,
  onDiagnose,
}: {
  canDiagnose: boolean
  diagnosing: boolean
  list: SubmittedArmyListEntry
  onDiagnose: (list: SubmittedArmyListEntry) => void
}) {
  const factionIdentity = resolvePlayerFactionIdentity({
    favoriteFaction: list.faction,
  })
  const portraitPath = factionIdentity.portraitPath
  const displayFaction = factionIdentity.normalizedFaction || getDisplayFaction(list)

  return (
    <article className={`army-list-card army-list-library-card is-${list.result.toLowerCase()}`}>
      {portraitPath ? (
        <span className="army-list-library-portrait" aria-label={`${displayFaction} portrait`}>
          <img
            alt={`${displayFaction} portrait`}
            decoding="async"
            loading="lazy"
            src={portraitPath}
          />
        </span>
      ) : null}
      <div className="army-list-library-badge">
        <OperatorBadge
          player={{
            displayName: getDisplayPlayer(list),
            favoriteFaction: displayFaction,
            name: list.player,
          }}
          preferredFaction={displayFaction}
          showBadges={false}
        />
      </div>
      <div className="army-list-library-body">
        <div className="army-list-card-heading">
          <div>
            <p className="eyebrow">{list.gameType}</p>
            <h2>{getDisplayPlayer(list)}</h2>
          </div>
          <strong>{list.result}</strong>
        </div>
        <p className="army-list-library-faction">{displayFaction || 'Faction not recorded'}</p>
        <dl className="army-list-meta army-list-library-meta">
          <div>
            <dt>Event</dt>
            <dd>{list.eventName || 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Opponent</dt>
            <dd>{formatPlayerName(list.opponent, list.opponentDisplayName)}</dd>
          </div>
          <div>
            <dt>Mission</dt>
            <dd>{list.mission || 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{list.date || 'Not recorded'}</dd>
          </div>
        </dl>
        <div className="army-list-actions army-list-library-actions">
          <ArmyListExternalLink armyCode={list.armyCode} />
          <Link to={list.battleReportPath}>View Battle Report</Link>
          {canDiagnose ? (
            <button
              disabled={diagnosing}
              onClick={() => void onDiagnose(list)}
              type="button"
            >
              {diagnosing ? 'Diagnosing' : 'Diagnose Army'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function ArmyDiagnosticModal({
  error,
  onClose,
  report,
}: {
  error: string
  onClose: () => void
  report: ArmyDiagnosticReport | null
}) {
  if (!report && !error) {
    return null
  }

  return (
    <section
      aria-label="Army diagnostic report"
      className="army-diagnostic-backdrop"
      role="dialog"
    >
      <div className="army-diagnostic-panel">
        <div className="army-diagnostic-header">
          <div>
            <p className="eyebrow">Commissioner Diagnostic</p>
            <h2>Diagnose Army</h2>
          </div>
          <button onClick={onClose} type="button">Close</button>
        </div>
        {error ? (
          <p role="alert">{error}</p>
        ) : report ? (
          <div className="army-diagnostic-body">
            <dl className="army-diagnostic-summary">
              <DiagnosticField label="Player" value={formatPlayerName(report.player, report.playerDisplayName)} />
              <DiagnosticField label="Event" value={report.event || 'Not recorded'} />
              <DiagnosticField label="Submitted" value={report.submitted || 'Not recorded'} />
              <DiagnosticField label="Snapshot" value={`${report.snapshotId} / ${report.snapshotTimestamp}`} />
              <DiagnosticField label="Decoder" value={report.decoderVersion || 'Not recorded'} />
              <DiagnosticField label="Cache Status" value={`${report.cache.classification} / ${report.cache.status}`} />
              <DiagnosticField label="Army Code" value={report.validation.valid ? 'Valid' : 'Invalid'} />
              <DiagnosticField label="Decode" value={report.decode.success ? 'Success' : 'Failed'} />
              <DiagnosticField label="Units Found" value={String(report.expectedUnitCount)} />
              <DiagnosticField label="Units Displayed" value={String(report.displayedUnitCount)} />
              <DiagnosticField label="Root Cause" value={report.rootCause} />
              <DiagnosticField label="Confidence" value={report.confidence || 'Not recorded'} />
            </dl>

            {report.comparison.missingUnits.length > 0 ? (
              <DiagnosticList title="Missing" values={report.comparison.missingUnits} />
            ) : null}
            {report.comparison.unexpectedUnits.length > 0 ? (
              <DiagnosticList title="Unexpected" values={report.comparison.unexpectedUnits} />
            ) : null}
            {report.decode.parserFailure ? (
              <section className="army-diagnostic-section">
                <h3>Parser stopped at</h3>
                <p><strong>Location:</strong> {report.decode.parserFailure.location}</p>
                <p><strong>Token:</strong> {report.decode.parserFailure.token}</p>
                <p><strong>Reason:</strong> {report.decode.parserFailure.reason}</p>
              </section>
            ) : null}
            {report.validation.issues.length > 0 ? (
              <DiagnosticList title="Validation Issues" values={report.validation.issues} />
            ) : null}
            <section className="army-diagnostic-section">
              <h3>Pipeline</h3>
              <div className="army-diagnostic-pipeline">
                {report.pipeline.map((stage) => (
                  <span key={stage.stage}>
                    {stage.stage}: {stage.received ? 'received' : 'missing'} / {stage.served ? 'served' : 'not served'}
                  </span>
                ))}
              </div>
            </section>
            <section className="army-diagnostic-section">
              <h3>Recommendation</h3>
              <p>{report.recommendation}</p>
              <div className="army-diagnostic-actions">
                <button type="button">Rebuild Snapshot</button>
                <button type="button">Clear Cache</button>
                <button type="button">Re-run Decode</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function DiagnosticField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function DiagnosticList({ title, values }: { title: string; values: string[] }) {
  return (
    <section className="army-diagnostic-section">
      <h3>{title}</h3>
      <ul>
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </section>
  )
}

function ArmyListExternalLink({ armyCode }: { armyCode: string }) {
  const target = getInfinityArmyTarget(armyCode)

  if (target.status === 'available') {
    return (
      <a href={target.href} rel="noreferrer" target="_blank">
        View in Infinity Army
      </a>
    )
  }

  return (
    <button
      aria-label={`View in Infinity Army unavailable: ${target.reason}`}
      className={`army-list-unavailable-link is-${target.status}`}
      disabled
      title={target.reason}
      type="button"
    >
      <span>View in Infinity Army</span>
      <small>{target.reason}</small>
    </button>
  )
}

function matchesFilter(value: string, filter: string) {
  return filter === 'all' || value === filter
}

function getUniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}

function getDisplayFaction(list: SubmittedArmyListEntry) {
  return normalizeArmyForDisplay(list.faction)
}

function getArmyListFilterIdentity(list: SubmittedArmyListEntry) {
  return normalizeArmyForDisplay(list.faction)
}

function getDisplayPlayer(list: SubmittedArmyListEntry) {
  return formatPlayerName(list.player, list.playerDisplayName)
}

function getDisplayedArmyUnits(list: SubmittedArmyListEntry) {
  return [
    list.armyCode,
  ].filter(Boolean)
}

function getArmyCodeDiagnosticKey(value: string) {
  return value.trim().toLowerCase()
}

export default ArmyLists
