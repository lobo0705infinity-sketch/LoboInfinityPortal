import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import {
  apiClient,
  type ArmyList,
  type EventLifecycleData,
  type OperationsDashboardData,
  type OperationsIdentityRecord,
  type OperationsNewsItem,
  type PortalSettings,
  type StreamedGame,
} from '../services/api'
import { formatPlayerName } from '../services/formatting'

type OperationsState =
  | {
      status: 'loading'
    }
  | {
      data: OperationsDashboardData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

type OperationsAction = (
  action: string,
  params?: Record<string, string | number | boolean>,
) => Promise<void>

const defaultStream: StreamedGame = {
  id: 0,
  date: '',
  division: '',
  mission: '',
  player1: '',
  player1Faction: '',
  player2: '',
  player2Faction: '',
  youtubeUrl: '',
  featured: false,
}

const defaultNews: OperationsNewsItem = {
  id: 0,
  body: '',
  date: '',
  link: '',
  relatedFaction: '',
  relatedMission: '',
  relatedPlayer: '',
  title: '',
  pinned: false,
  archived: false,
}

const permissionRows = [
  ['View operations', 'Assistant Commissioner', 'Assistant Commissioner and Commissioner'],
  ['News', 'Assistant Commissioner', 'Create, edit, archive, and delete news'],
  ['Streams', 'Assistant Commissioner', 'Create, edit, feature, and delete streams'],
  ['Player audit', 'Commissioner', 'Run full league data audit'],
  ['Identity audit', 'Commissioner', 'Audit Google Email to Players sheet mapping'],
  ['Season reset', 'Commissioner', 'Record reset operation and refresh caches'],
  ['Promotion', 'Commissioner', 'Record promotion operation'],
  ['Relegation', 'Commissioner', 'Record relegation operation'],
  ['Cache clear', 'Commissioner', 'Clear all Apps Script cache groups'],
  ['Statistics rebuild', 'Commissioner', 'Run backend statistics rebuild'],
  ['Import', 'Commissioner', 'Record import operation'],
  ['Export', 'Commissioner', 'Generate operations export payload'],
  ['Backup', 'Commissioner', 'Generate backup payload'],
  ['Restore', 'Commissioner', 'Record restore operation'],
  ['Discord settings', 'Commissioner', 'Configure webhook and automation limits'],
  ['Discord announcements', 'Assistant Commissioner', 'Preview, send, and resend announcements'],
  ['Event lifecycle', 'Commissioner', 'Advance or rollback Event lifecycle stages'],
] as const

function CommissionerDashboard() {
  const auth = useAuth()
  const [state, setState] = useState<OperationsState>({
    status: 'loading',
  })
  const [workingAction, setWorkingAction] = useState('')
  const canViewOperations = auth.isAtLeastRole('Assistant Commissioner')

  async function loadOperations(signal?: AbortSignal) {
    try {
      const data = await apiClient.getOperations({ signal })
      setState({
        data,
        status: 'success',
      })
    } catch (error) {
      if (!signal?.aborted) {
        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Commissioner operations could not be loaded.',
          status: 'error',
        })
      }
    }
  }

  useEffect(() => {
    if (
      auth.status !== 'ready' ||
      !auth.authenticated ||
      !canViewOperations
    ) {
      return
    }

    const controller = new AbortController()
    void Promise.resolve().then(() => loadOperations(controller.signal))

    return () => {
      controller.abort()
    }
  }, [auth.authenticated, auth.status, canViewOperations])

  async function runAction(
    action: string,
    params: Record<string, string | number | boolean> = {},
  ) {
    setWorkingAction(action)
    try {
      await apiClient.operationsAction(action, params)
      await loadOperations()
    } finally {
      setWorkingAction('')
    }
  }

  if (auth.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Operations loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (!auth.authenticated || !canViewOperations) {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h2>Authorized League Staff Only</h2>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to use operations tools. Apps Script enforces the same role
            checks server-side.
          </p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Operations loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Operations error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  const { data } = state

  return (
    <main className="portal-shell">
      <PageHeader />
      <OperationsSummary data={data} />
      <section className="operations-grid" aria-label="Operations status">
        <LeagueHealthPanel data={data} />
        <SeasonStatusPanel data={data} />
        <IdentityStatusPanel data={data} />
        <NotificationStatusPanel data={data} />
        <DiscordStatusPanel data={data} />
        <StatisticsPanel data={data} />
        <DeploymentPanel data={data} />
      </section>
      <section className="operations-grid" aria-label="Commissioner workflows">
        <IdentityManagementPanel
          canManage={auth.hasPermission('manageSettings')}
          data={data}
          onAction={runAction}
          workingAction={workingAction}
        />
        <NewsManager news={data.news} onAction={runAction} />
        <StreamManager streams={data.streams} onAction={runAction} />
        <ArmyListApproval lists={data.pendingArmyLists} onAction={runAction} />
        <PlayerManagementPanel data={data} />
        <EventLifecyclePanel
          canManage={auth.hasPermission('runSeasonControl')}
          lifecycle={data.eventLifecycle}
          onAction={runAction}
          workingAction={workingAction}
        />
        <PromotionRelegationPanel
          canRun={auth.hasPermission('runSeasonControl')}
          onAction={runAction}
          workingAction={workingAction}
        />
        <CachePanel
          cache={data.summary.cacheStatus}
          canManage={auth.hasPermission('manageCache')}
          onAction={runAction}
          workingAction={workingAction}
        />
        <DiscordAutomationPanel
          canManage={auth.hasPermission('manageSettings')}
          canSend={auth.hasPermission('manageNews')}
          data={data}
          onAction={runAction}
          workingAction={workingAction}
        />
      </section>
      <section className="operations-grid two-column" aria-label="Audit and one-click operations">
        <AuditPanel
          audit={data.audit}
          canRun={auth.hasPermission('runLeagueAudit')}
          onAction={runAction}
          workingAction={workingAction}
        />
        <OperationsCommandPanel
          canRun={auth.hasPermission('runSeasonControl')}
          onAction={runAction}
          workingAction={workingAction}
        />
      </section>
      <section className="operations-grid two-column" aria-label="Settings and permissions">
        <SettingsPanel
          canManage={auth.hasPermission('manageSettings')}
          onAction={runAction}
          settings={data.settings}
        />
        <PermissionMatrix />
      </section>
    </main>
  )
}

function EventLifecyclePanel({
  canManage,
  lifecycle,
  onAction,
  workingAction,
}: {
  canManage: boolean
  lifecycle: EventLifecycleData
  onAction: OperationsAction
  workingAction: string
}) {
  const transition = lifecycle.nextTransition
  const rollback = lifecycle.rollback

  return (
    <section className="panel operations-panel event-lifecycle-panel">
      <PanelTitle eyebrow="Event Management" title="Event Lifecycle" />
      <div className="event-lifecycle-heading">
        <div>
          <span>{lifecycle.event.type}</span>
          <h3>{lifecycle.event.name}</h3>
          <p>{lifecycle.event.description}</p>
        </div>
        <strong>{lifecycle.currentStage}</strong>
      </div>
      <dl className="operations-metrics compact">
        <Metric label="Status" value={lifecycle.status} />
        <Metric label="Participants" value={lifecycle.participants} />
        <Metric label="Registration" value={lifecycle.registration} />
        <Metric label="Rounds" value={lifecycle.rounds} />
        <Metric label="Automation" value={lifecycle.health.automationHealth} />
        <Metric label="Discord" value={lifecycle.discord.status} />
        <Metric label="Start" value={lifecycle.startDate || 'Not set'} />
        <Metric label="End" value={lifecycle.endDate || 'Not set'} />
        <Metric label="Current Season" value={lifecycle.currentSeason || 'Not set'} />
        <Metric label="Current Round" value={lifecycle.currentRound || 'Not set'} />
      </dl>
      <EventLifecycleStageTrack lifecycle={lifecycle} />
      <div className="operations-actions wrap">
        <button
          disabled={!canManage || !transition.available || workingAction !== ''}
          onClick={() => void confirmEventLifecycleTransition(lifecycle, onAction)}
          type="button"
        >
          {transition.label}
        </button>
        <button
          disabled={!canManage || !rollback.available || workingAction !== ''}
          onClick={() => void confirmEventLifecycleRollback(lifecycle, onAction)}
          type="button"
        >
          {rollback.label}
        </button>
      </div>
      <div className="operations-grid two-column event-lifecycle-subgrid">
        <section className="operations-record">
          <span>Event Health</span>
          <h3>{lifecycle.health.registrationProgress}</h3>
          <p>
            {lifecycle.health.gamesCompleted} games completed,{' '}
            {lifecycle.health.gamesRemaining} remaining,{' '}
            {lifecycle.health.missingPairings} missing pairings.
          </p>
          <small>
            {lifecycle.health.playersWithoutIdentity} identity warnings -{' '}
            {lifecycle.health.latePlayers.length} late players
          </small>
        </section>
        <section className="operations-record">
          <span>Automation Preview</span>
          <h3>{lifecycle.automation.template.title || 'Event lifecycle updated'}</h3>
          <p>{lifecycle.automation.template.body || '{{message}}'}</p>
          <small>
            Destinations: {lifecycle.automation.destinations.join(', ') || 'None configured'}
          </small>
        </section>
      </div>
      <div className="operations-stack">
        {lifecycle.warnings.length === 0 ? (
          <EmptyState text="No event lifecycle warnings." />
        ) : (
          lifecycle.warnings.map((warning) => (
            <article
              className={`operations-record ${warning.severity}`}
              key={`${warning.severity}-${warning.message}`}
            >
              <span>{warning.severity}</span>
              <h3>{warning.message}</h3>
              <p>{warning.suggestedFix}</p>
            </article>
          ))
        )}
      </div>
      <div className="operations-stack">
        {lifecycle.auditLog.length === 0 ? (
          <EmptyState text="No lifecycle transitions have been recorded yet." />
        ) : (
          lifecycle.auditLog.slice(0, 5).map((entry) => (
            <article className="operations-record" key={`${entry.timestamp}-${entry.newStage}`}>
              <span>{entry.timestamp}</span>
              <h3>{entry.previousStage} to {entry.newStage}</h3>
              <p>{entry.reason || 'Lifecycle transition recorded.'}</p>
              <small>{entry.commissioner || 'Unknown commissioner'}</small>
            </article>
          ))
        )}
      </div>
      {!rollback.available && rollback.reason ? (
        <p className="operations-empty">{rollback.reason}</p>
      ) : null}
    </section>
  )
}

function EventLifecycleStageTrack({
  lifecycle,
}: {
  lifecycle: EventLifecycleData
}) {
  return (
    <ol className="event-lifecycle-track" aria-label="Event lifecycle stages">
      {lifecycle.supportedStages.map((stage) => (
        <li
          className={stage === lifecycle.currentStage ? 'active' : ''}
          key={stage}
        >
          {stage}
        </li>
      ))}
    </ol>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="commissioner-title">
      <p className="eyebrow">League Operations</p>
      <h1 id="commissioner-title">Commissioner Dashboard</h1>
      <p>Operations console for identity, content, season control, cache, audit, and deployment status.</p>
    </section>
  )
}

function OperationsSummary({ data }: { data: OperationsDashboardData }) {
  const cards = [
    ['League Health', healthLabel(data)],
    ['Season', data.summary.seasonStatus.currentSeasonName],
    ['Linked Users', data.summary.identityStatus.linkedUsers],
    ['Notifications', data.summary.notificationStatus.total],
    ['Streams', data.streams.length],
    ['News', data.news.length],
    ['Players', data.players.length],
    ['Audit Issues', data.audit.issues.length],
  ] as const

  return (
    <section className="operations-summary" aria-label="Operations summary">
      {cards.map(([label, value]) => (
        <article className="stat-card operations-stat" key={label}>
          <div className="stat-card-header">
            <span className="stat-card-icon">OPS</span>
            <span className="stat-card-label">{label}</span>
          </div>
          <strong>{value}</strong>
          <p>Live operations signal</p>
        </article>
      ))}
    </section>
  )
}

function LeagueHealthPanel({ data }: { data: OperationsDashboardData }) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="League Health" title="Operational Status" />
      <dl className="operations-metrics">
        <Metric label="Overall" value={healthLabel(data)} />
        <Metric label="Critical Issues" value={data.audit.summary.critical} />
        <Metric label="Warnings" value={data.audit.summary.warning} />
        <Metric label="Apps Script" value={data.summary.systemHealth.appsScript || 'Unknown'} />
        <Metric label="Sheets" value={data.summary.systemHealth.sheets || 'Unknown'} />
        <Metric label="Endpoints" value={data.summary.systemHealth.endpoints || 'Unknown'} />
      </dl>
      <div className="operations-actions">
        <Link to="/integrity">Open Integrity System</Link>
      </div>
    </section>
  )
}

function SeasonStatusPanel({ data }: { data: OperationsDashboardData }) {
  const season = data.summary.seasonStatus

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Season Status" title={season.currentSeasonName} />
      <dl className="operations-metrics">
        <Metric label="Start" value={season.startDate || 'Not set'} />
        <Metric label="End" value={season.endDate || 'Not set'} />
        <Metric label="Weeks Completed" value={season.weeksCompleted} />
        <Metric label="Matches Played" value={season.matchesPlayed} />
        <Metric label="Remaining Matches" value={season.remainingMatches} />
        <Metric label="Registration" value={season.registrationOpen ? 'Open' : 'Closed'} />
      </dl>
    </section>
  )
}

function IdentityStatusPanel({ data }: { data: OperationsDashboardData }) {
  const identity = data.summary.identityStatus

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Identity Status" title="Portal to League Mapping" />
      <dl className="operations-metrics">
        <Metric label="Portal Users" value={identity.totalUsers} />
        <Metric label="Enabled Users" value={identity.enabledUsers} />
        <Metric label="Disabled Users" value={identity.disabledUsers} />
        <Metric label="Linked Users" value={identity.linkedUsers} />
        <Metric label="Unlinked Users" value={identity.unlinkedUsers} />
        <Metric label="Players Without Email" value={identity.playersWithoutEmail} />
        <Metric label="Players Without User" value={identity.playersWithoutUser} />
        <Metric label="Staff Users" value={identity.commissionerUsers + identity.assistantUsers} />
      </dl>
    </section>
  )
}

function IdentityManagementPanel({
  canManage,
  data,
  onAction,
  workingAction,
}: {
  canManage: boolean
  data: OperationsDashboardData
  onAction: OperationsAction
  workingAction: string
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const records = data.identity.records.filter((record) =>
    identityRecordMatches(record, query, filter),
  )
  const selectedEmails = data.identity.records
    .filter((record) => selectedIds.includes(record.id) && record.googleEmail)
    .map((record) => record.googleEmail)
  const allVisibleSelected =
    records.length > 0 &&
    records.every((record) => selectedIds.includes(record.id))

  function toggleRecord(record: OperationsIdentityRecord) {
    setSelectedIds((current) =>
      current.includes(record.id)
        ? current.filter((id) => id !== record.id)
        : [...current, record.id],
    )
  }

  function toggleVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !records.some((record) => record.id === id)),
      )
      return
    }

    setSelectedIds((current) =>
      Array.from(new Set([...current, ...records.map((record) => record.id)])),
    )
  }

  function bulkEmail() {
    if (selectedEmails.length === 0) {
      return
    }

    window.location.href = `mailto:${selectedEmails.join(',')}`
  }

  async function runBulk(action: string) {
    await onAction(action, {
      emails: selectedEmails.join(','),
    })
    setSelectedIds([])
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Identity Management" title="Google Email Mapping" />
      <div className="operations-form">
        <Input label="Search" onChange={setQuery} type="search" value={query} />
        <label>
          <span>Filter</span>
          <select onChange={(event) => setFilter(event.target.value)} value={filter}>
            <option value="all">All identities</option>
            <option value="linked">Linked</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="missingEmail">Missing Email</option>
            <option value="duplicateEmail">Duplicate Email</option>
            <option value="duplicatePlayer">Duplicate Player</option>
            <option value="neverLoggedIn">Never Logged In</option>
            <option value="brokenMapping">Broken Mapping</option>
          </select>
        </label>
      </div>
      <div className="operations-actions wrap">
        <button
          disabled={!canManage || selectedEmails.length === 0 || workingAction !== ''}
          onClick={() => void runBulk('identityBulkEnable')}
          type="button"
        >
          Bulk Enable
        </button>
        <button
          disabled={!canManage || selectedEmails.length === 0 || workingAction !== ''}
          onClick={() => void runBulk('identityBulkDisable')}
          type="button"
        >
          Bulk Disable
        </button>
        <button disabled={selectedEmails.length === 0} onClick={bulkEmail} type="button">
          Bulk Email
        </button>
        <button
          disabled={!canManage || workingAction !== ''}
          onClick={() => void onAction('repairIdentity')}
          type="button"
        >
          Repair Identity
        </button>
        <button
          disabled={!canManage || workingAction !== ''}
          onClick={() => void onAction('repairUsersSheet')}
          type="button"
        >
          Repair Users Sheet
        </button>
        <button
          disabled={!canManage || workingAction !== ''}
          onClick={() => void onAction('repairMissingAccounts')}
          type="button"
        >
          Repair Missing Accounts
        </button>
      </div>
      <dl className="operations-metrics compact">
        <Metric label="Records" value={records.length} />
        <Metric label="Selected" value={selectedEmails.length} />
        <Metric label="Audits" value={data.identity.audits.length} />
      </dl>
      <div className="standings-table" role="table" aria-label="Identity management">
        <div className="table-row table-head" role="row">
          <span>
            <input
              checked={allVisibleSelected}
              onChange={toggleVisible}
              type="checkbox"
            />
          </span>
          <span>League Player</span>
          <span>Display Name</span>
          <span>Division</span>
          <span>Google Email</span>
          <span>Portal User</span>
          <span>Role</span>
          <span>Last Login</span>
          <span>Last Seen</span>
          <span>Linked</span>
          <span>Enabled</span>
          <span>Flags</span>
        </div>
        {records.map((record) => (
          <div className="table-row" key={record.id} role="row">
            <span>
              <input
                checked={selectedIds.includes(record.id)}
                disabled={!record.googleEmail}
                onChange={() => toggleRecord(record)}
                type="checkbox"
              />
            </span>
            <strong>{record.player || 'Missing player'}</strong>
            <span>{formatPlayerName(record.player, record.displayName) || 'Missing display name'}</span>
            <span>{record.division || 'No division'}</span>
            <span>{record.googleEmail || 'Missing email'}</span>
            <span>{record.portalUser || 'Never logged in'}</span>
            <span>{record.role || 'No role'}</span>
            <span>{record.lastLogin || 'Never'}</span>
            <span>{record.lastSeen || 'Never'}</span>
            <span>{record.linked ? 'Yes' : 'No'}</span>
            <span>{record.enabled ? 'Yes' : 'No'}</span>
            <span>{identityFlags(record).join(', ') || 'Clean'}</span>
          </div>
        ))}
      </div>
      <div className="operations-stack">
        {data.identity.audits.slice(0, 10).map((audit) => (
          <article className={`operations-record ${audit.severity}`} key={`${audit.type}-${audit.player}-${audit.googleEmail}`}>
            <span>{audit.severity}</span>
            <h3>{audit.type}</h3>
            <p>{audit.message}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function NotificationStatusPanel({ data }: { data: OperationsDashboardData }) {
  const notifications = data.summary.notificationStatus

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Notifications" title="League Alert Status" />
      <dl className="operations-metrics">
        <Metric label="Generated Alerts" value={notifications.total} />
        <Metric label="High Priority" value={notifications.highPriority} />
        <Metric label="Normal Priority" value={notifications.normalPriority} />
        <Metric label="Unread For You" value={data.summary.notificationStatus.total} />
      </dl>
      <div className="operations-actions">
        <Link to="/notifications">Open Notifications</Link>
      </div>
    </section>
  )
}

function DiscordStatusPanel({ data }: { data: OperationsDashboardData }) {
  const discord = data.discord

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Discord" title="Automation Status" />
      <dl className="operations-metrics">
        <Metric label="Enabled" value={discord.enabled ? 'Yes' : 'No'} />
        <Metric label="Webhook" value={discord.configured ? discord.webhookMasked : 'Not configured'} />
        <Metric label="Queue" value={discord.queueDepth} />
        <Metric label="Failures" value={discord.failures} />
        <Metric label="Rate Limit" value={`${discord.rateLimitPerHour}/hour`} />
        <Metric label="Last Run" value={discord.lastAutomationRun || 'Never'} />
      </dl>
    </section>
  )
}

function StatisticsPanel({ data }: { data: OperationsDashboardData }) {
  const stats = data.summary.leagueStatistics

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Statistics" title="League Data Volume" />
      <dl className="operations-metrics">
        <Metric label="Games" value={stats.games} />
        <Metric label="Active Players" value={stats.activePlayers} />
        <Metric label="Players" value={data.players.length} />
        <Metric label="Factions" value={stats.factions} />
        <Metric label="Missions" value={stats.missions} />
        <Metric label="Recent Matches" value={data.summary.recentMatchSubmissions.length} />
      </dl>
    </section>
  )
}

function DeploymentPanel({ data }: { data: OperationsDashboardData }) {
  const deployment = data.summary.deploymentStatus

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Deployment" title="Release Status" />
      <dl className="operations-metrics">
        <Metric label="Portal Version" value={deployment.portalVersion} />
        <Metric label="Apps Script" value={deployment.appsScriptVersion} />
        <Metric label="Git Commit" value={deployment.gitCommit} />
        <Metric label="Checked At" value={deployment.checkedAt} />
        <Metric label="Deployment URL" value={deployment.deploymentUrl || 'Not recorded'} />
      </dl>
    </section>
  )
}

function ArmyListApproval({
  lists,
  onAction,
}: {
  lists: ArmyList[]
  onAction: OperationsAction
}) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Approval Queue" title="Army List Approval" />
      {lists.length === 0 ? (
        <EmptyState text="No pending army lists." />
      ) : (
        <div className="operations-stack">
          {lists.map((list) => (
            <article className="operations-record" key={list.id}>
              <span>{list.faction}</span>
              <h3>{list.armyName}</h3>
              <p>
                {formatPlayerName(list.player, list.playerDisplayName)} -{' '}
                {list.mission || 'Mission not recorded'}
              </p>
              <small>{list.description || 'No description submitted.'}</small>
              <div className="operations-actions">
                <button onClick={() => void onAction('approveArmyList', { id: list.id })} type="button">
                  Approve
                </button>
                <button onClick={() => void onAction('rejectArmyList', { id: list.id })} type="button">
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function StreamManager({
  onAction,
  streams,
}: {
  onAction: OperationsAction
  streams: StreamedGame[]
}) {
  const [draft, setDraft] = useState(defaultStream)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('saveStream', draft).then(() => setDraft(defaultStream))
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Streams" title="Stream Manager" />
      <form className="operations-form" onSubmit={submit}>
        <Input label="Mission" onChange={(value) => setDraft({ ...draft, mission: value })} value={draft.mission} />
        <Input label="Division" onChange={(value) => setDraft({ ...draft, division: value })} value={draft.division} />
        <Input label="Player 1" onChange={(value) => setDraft({ ...draft, player1: value })} value={draft.player1} />
        <Input label="Player 1 Faction" onChange={(value) => setDraft({ ...draft, player1Faction: value })} value={draft.player1Faction} />
        <Input label="Player 2" onChange={(value) => setDraft({ ...draft, player2: value })} value={draft.player2} />
        <Input label="Player 2 Faction" onChange={(value) => setDraft({ ...draft, player2Faction: value })} value={draft.player2Faction} />
        <Input label="YouTube URL" onChange={(value) => setDraft({ ...draft, youtubeUrl: value })} value={draft.youtubeUrl} />
        <Input label="Date" onChange={(value) => setDraft({ ...draft, date: value })} type="date" value={draft.date} />
        <label className="operations-check">
          <input
            checked={draft.featured}
            onChange={(event) => setDraft({ ...draft, featured: event.target.checked })}
            type="checkbox"
          />
          Featured
        </label>
        <button type="submit">Save Stream</button>
      </form>
      <RecordList
        empty="No streams configured."
        items={streams.map((stream) => ({
          id: stream.id,
          title: stream.mission || 'Untitled stream',
          meta: `${stream.player1} vs ${stream.player2}`,
          detail: stream.youtubeUrl,
          onDelete: () => void onAction('deleteStream', { id: stream.id }),
          onEdit: () => setDraft(stream),
        }))}
      />
    </section>
  )
}

function NewsManager({
  news,
  onAction,
}: {
  news: OperationsNewsItem[]
  onAction: OperationsAction
}) {
  const [draft, setDraft] = useState(defaultNews)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('saveNews', draft).then(() => setDraft(defaultNews))
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="News" title="Commissioner News" />
      <form className="operations-form" onSubmit={submit}>
        <Input label="Title" onChange={(value) => setDraft({ ...draft, title: value })} value={draft.title} />
        <Input label="Date" onChange={(value) => setDraft({ ...draft, date: value })} type="date" value={draft.date} />
        <Input label="Link" onChange={(value) => setDraft({ ...draft, link: value })} value={draft.link} />
        <label className="operations-form-wide">
          <span>Body</span>
          <textarea
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            rows={4}
            value={draft.body}
          />
        </label>
        <label className="operations-check">
          <input checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} type="checkbox" />
          Pin
        </label>
        <label className="operations-check">
          <input checked={draft.archived} onChange={(event) => setDraft({ ...draft, archived: event.target.checked })} type="checkbox" />
          Archive
        </label>
        <button type="submit">Save News</button>
      </form>
      <RecordList
        empty="No manual news configured."
        items={news.map((item) => ({
          id: item.id,
          title: item.title || 'Untitled news',
          meta: item.date,
          detail: item.body,
          onDelete: () => void onAction('deleteNews', { id: item.id }),
          onEdit: () => setDraft(item),
        }))}
      />
    </section>
  )
}

function PlayerManagementPanel({ data }: { data: OperationsDashboardData }) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Player Management" title="Roster Operations" />
      <dl className="operations-metrics compact">
        <Metric label="Players" value={data.players.length} />
        <Metric label="Active" value={data.summary.leagueStatistics.activePlayers} />
        <Metric label="Linked Users" value={data.summary.identityStatus.linkedUsers} />
      </dl>
      <div className="operations-stack">
        {data.players.slice(0, 12).map((player) => (
          <Link
            className="operations-record"
            key={`${player.division}-${player.player}`}
            to={`/players/${encodeURIComponent(player.player)}`}
          >
            <span>{player.division}</span>
            <h3>{formatPlayerName(player.player, player.displayName)}</h3>
            <p>Rank #{player.rank} - {player.games} games</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function PromotionRelegationPanel({
  canRun,
  onAction,
  workingAction,
}: {
  canRun: boolean
  onAction: OperationsAction
  workingAction: string
}) {
  const actions = [
    ['Promotion', 'Promotion'],
    ['Relegation', 'Relegation'],
    ['Season Reset', 'Season Reset'],
  ] as const

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Promotion/Relegation" title="Season Movement" />
      <p className="operations-empty">
        These controls record commissioner season operations and refresh league caches.
      </p>
      <div className="operations-actions wrap">
        {actions.map(([label, operation]) => (
          <button
            disabled={!canRun || workingAction !== ''}
            key={operation}
            onClick={() => void confirmSeasonOperation(operation, onAction)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}

function CachePanel({
  cache,
  canManage,
  onAction,
  workingAction,
}: {
  cache: OperationsDashboardData['summary']['cacheStatus']
  canManage: boolean
  onAction: OperationsAction
  workingAction: string
}) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Cache" title="Cache and Rebuild" />
      <dl className="operations-metrics">
        <Metric label="Status" value={cache.status} />
        <Metric label="Version" value={cache.version} />
        <Metric label="Last Refresh" value={cache.lastRefresh || 'Not recorded'} />
        <Metric label="Cache Age" value={cache.cacheAge} />
        <Metric label="Avg API Response" value={cache.performance.averageApiResponse || '0ms'} />
        <Metric label="Cache Hit Rate" value={`${cache.performance.cacheHitRate}%`} />
      </dl>
      <div className="operations-actions wrap">
        <button disabled={!canManage || workingAction !== ''} onClick={() => void onAction('clearCache')} type="button">
          Cache Clear
        </button>
        <button disabled={!canManage || workingAction !== ''} onClick={() => void onAction('refreshCache', { group: 'all' })} type="button">
          Refresh All Cache
        </button>
        <button disabled={!canManage || workingAction !== ''} onClick={() => void onAction('rebuildStatistics')} type="button">
          Statistics Rebuild
        </button>
      </div>
      <div className="operations-stack">
        {cache.entries.length > 0 ? (
          cache.entries.slice(0, 8).map((entry) => (
            <article className="operations-record" key={`${entry.action}-${entry.version}`}>
              <span>{entry.group}</span>
              <h3>{entry.action}</h3>
              <p>{entry.health} - age {entry.ageSeconds}s - expires in {entry.timeRemainingSeconds}s</p>
            </article>
          ))
        ) : (
          <p className="operations-empty">Cache is cold. It will warm as pages are requested.</p>
        )}
      </div>
    </section>
  )
}

function AuditPanel({
  audit,
  canRun,
  onAction,
  workingAction,
}: {
  audit: OperationsDashboardData['audit']
  canRun: boolean
  onAction: OperationsAction
  workingAction: string
}) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Audit" title="League Audit" />
      <dl className="operations-metrics compact">
        <Metric label="Critical" value={audit.summary.critical} />
        <Metric label="Warnings" value={audit.summary.warning} />
        <Metric label="Info" value={audit.summary.informational} />
      </dl>
      <div className="operations-actions wrap">
        <button disabled={!canRun || workingAction !== ''} onClick={() => void runOperationsCommand('Player Audit', onAction)} type="button">
          Player Audit
        </button>
        <button disabled={!canRun || workingAction !== ''} onClick={() => void runOperationsCommand('Identity Audit', onAction)} type="button">
          Identity Audit
        </button>
      </div>
      <div className="operations-stack">
        {audit.issues.slice(0, 10).map((issue) => (
          <Link className={`operations-record ${issue.severity}`} key={`${issue.severity}-${issue.description}`} to={issue.link || '/commissioner'}>
            <span>{issue.severity}</span>
            <h3>{issue.description}</h3>
            <p>{issue.suggestedFix}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function OperationsCommandPanel({
  canRun,
  onAction,
  workingAction,
}: {
  canRun: boolean
  onAction: OperationsAction
  workingAction: string
}) {
  const commands = ['Import', 'Export', 'Backup', 'Restore'] as const

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Operations" title="Data Operations" />
      <p className="operations-empty">
        Data operations are commissioner-only and are recorded to the season archive.
      </p>
      <div className="operations-actions wrap">
        {commands.map((command) => (
          <button
            disabled={!canRun || workingAction !== ''}
            key={command}
            onClick={() => void runOperationsCommand(command, onAction)}
            type="button"
          >
            {command}
          </button>
        ))}
      </div>
    </section>
  )
}

function DiscordAutomationPanel({
  canManage,
  canSend,
  data,
  onAction,
  workingAction,
}: {
  canManage: boolean
  canSend: boolean
  data: OperationsDashboardData
  onAction: OperationsAction
  workingAction: string
}) {
  const discord = data.discord
  const [settingsDraft, setSettingsDraft] = useState({
    adminChannel: discord.adminChannel,
    announcementChannel: discord.announcementChannel,
    automationEvents: discord.automationEvents.join(','),
    enabled: discord.enabled,
    rateLimitPerHour: String(discord.rateLimitPerHour || 12),
    retryLimit: String(discord.retryLimit || 3),
    webhookUrl: '',
  })
  const [announcementDraft, setAnnouncementDraft] = useState({
    content: '',
    event: 'manual',
    message: '',
    title: '',
  })

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('updateDiscordSettings', {
      ...settingsDraft,
      enabled: settingsDraft.enabled,
    })
  }

  function sendAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('sendDiscordAnnouncement', announcementDraft)
  }

  const preview = discord.preview.embeds[0]
  const failedEntries = discord.log.filter((entry) => !entry.success)

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Discord" title="League Automation" />
      <dl className="operations-metrics compact">
        <Metric label="Enabled" value={discord.enabled ? 'Yes' : 'No'} />
        <Metric label="Webhook" value={discord.configured ? discord.webhookMasked : 'Not configured'} />
        <Metric label="Announcements" value={discord.announcementChannel || 'Not set'} />
        <Metric label="Admin" value={discord.adminChannel || 'Not set'} />
        <Metric label="Queued" value={discord.queueDepth} />
        <Metric label="Failures" value={discord.failures} />
      </dl>
      <form className="operations-form" onSubmit={saveSettings}>
        <Input disabled={!canManage} label="Webhook URL" onChange={(value) => setSettingsDraft({ ...settingsDraft, webhookUrl: value })} value={settingsDraft.webhookUrl} />
        <Input disabled={!canManage} label="Announcement Channel" onChange={(value) => setSettingsDraft({ ...settingsDraft, announcementChannel: value })} value={settingsDraft.announcementChannel} />
        <Input disabled={!canManage} label="Admin Channel" onChange={(value) => setSettingsDraft({ ...settingsDraft, adminChannel: value })} value={settingsDraft.adminChannel} />
        <Input disabled={!canManage} label="Rate Limit Per Hour" onChange={(value) => setSettingsDraft({ ...settingsDraft, rateLimitPerHour: value })} type="number" value={settingsDraft.rateLimitPerHour} />
        <Input disabled={!canManage} label="Retry Limit" onChange={(value) => setSettingsDraft({ ...settingsDraft, retryLimit: value })} type="number" value={settingsDraft.retryLimit} />
        <label className="operations-form-wide">
          <span>Automation Events</span>
          <textarea
            disabled={!canManage}
            onChange={(event) => setSettingsDraft({ ...settingsDraft, automationEvents: event.target.value })}
            rows={3}
            value={settingsDraft.automationEvents}
          />
        </label>
        <label className="operations-check">
          <input
            checked={settingsDraft.enabled}
            disabled={!canManage}
            onChange={(event) => setSettingsDraft({ ...settingsDraft, enabled: event.target.checked })}
            type="checkbox"
          />
          Enable automation
        </label>
        <button disabled={!canManage || workingAction !== ''} type="submit">Save Discord Settings</button>
      </form>
      <form className="operations-form" onSubmit={sendAnnouncement}>
        <label>
          <span>Announcement Type</span>
          <select
            disabled={!canSend}
            onChange={(event) => setAnnouncementDraft({ ...announcementDraft, event: event.target.value })}
            value={announcementDraft.event}
          >
            <option value="manual">Manual</option>
            <option value="weeklyStandings">Weekly Standings</option>
            <option value="playerOfTheWeek">Player of the Week</option>
            <option value="leagueRecordsBroken">Records Broken</option>
            <option value="gameSubmitted">Latest Game</option>
            <option value="achievementUnlocked">Achievement</option>
            <option value="hallOfFameInduction">Hall of Fame</option>
          </select>
        </label>
        <Input disabled={!canSend} label="Title" onChange={(value) => setAnnouncementDraft({ ...announcementDraft, title: value })} value={announcementDraft.title} />
        <label className="operations-form-wide">
          <span>Message</span>
          <textarea
            disabled={!canSend}
            onChange={(event) => setAnnouncementDraft({ ...announcementDraft, message: event.target.value, content: event.target.value })}
            rows={4}
            value={announcementDraft.message}
          />
        </label>
        <button disabled={!canSend || workingAction !== ''} type="submit">Send Announcement</button>
      </form>
      <div className="operations-actions wrap">
        <button disabled={!canManage || workingAction !== ''} onClick={() => void onAction('testDiscordWebhook', { message: 'Discord automation test from Commissioner Dashboard.' })} type="button">
          Test Webhook
        </button>
        <button disabled={!canSend || workingAction !== ''} onClick={() => void onAction('runDiscordAutomationJob', { cadence: 'weekly' })} type="button">
          Run Weekly Automation
        </button>
        <button disabled={!canManage || workingAction !== ''} onClick={() => void onAction('disableDiscordAutomation')} type="button">
          Disable Automation
        </button>
      </div>
      {preview ? (
        <article className="operations-record">
          <span>{discord.preview.label || 'Preview'}</span>
          <h3>{preview.title || discord.preview.content || 'Discord preview'}</h3>
          <p>{preview.description || 'Preview updates from current league data.'}</p>
          <small>{preview.fields.map((field) => `${field.name}: ${field.value}`).join(' | ')}</small>
        </article>
      ) : (
        <EmptyState text="No Discord preview is available yet." />
      )}
      <div className="operations-stack">
        {discord.log.length === 0 ? (
          <EmptyState text="No Discord automation log entries." />
        ) : (
          discord.log.slice(0, 8).map((entry) => (
            <article className={`operations-record ${entry.success ? '' : 'warning'}`} key={`${entry.rowNumber}-${entry.timestamp}`}>
              <span>{entry.status || (entry.success ? 'Sent' : 'Retry')}</span>
              <h3>{entry.title || entry.event}</h3>
              <p>{entry.timestamp || 'No timestamp'} - {entry.failure || 'Delivered'}</p>
              {!entry.success && (
                <button
                  disabled={!canSend || workingAction !== ''}
                  onClick={() => void onAction('resendDiscordAnnouncement', { rowNumber: entry.rowNumber })}
                  type="button"
                >
                  Resend
                </button>
              )}
            </article>
          ))
        )}
      </div>
      {failedEntries.length > 0 && (
        <p className="operations-empty">
          {failedEntries.length} Discord messages need attention.
        </p>
      )}
    </section>
  )
}

function SettingsPanel({
  canManage,
  onAction,
  settings,
}: {
  canManage: boolean
  onAction: OperationsAction
  settings: PortalSettings
}) {
  const [draft, setDraft] = useState(settings)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('updateSettings', draft)
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Configuration" title="League Settings" />
      <form className="operations-form" onSubmit={submit}>
        <Input disabled={!canManage} label="League Name" onChange={(value) => setDraft({ ...draft, leagueName: value })} value={draft.leagueName} />
        <Input disabled={!canManage} label="Current Season" onChange={(value) => setDraft({ ...draft, currentSeason: value })} value={draft.currentSeason} />
        <Input disabled={!canManage} label="Google Form URL" onChange={(value) => setDraft({ ...draft, googleFormUrl: value })} value={draft.googleFormUrl} />
        <Input disabled={!canManage} label="Portal Version" onChange={(value) => setDraft({ ...draft, portalVersion: value })} value={draft.portalVersion} />
        <Input disabled={!canManage} label="Git Commit" onChange={(value) => setDraft({ ...draft, gitCommit: value })} value={draft.gitCommit} />
        <Input disabled={!canManage} label="Deployment URL" onChange={(value) => setDraft({ ...draft, deploymentUrl: value })} value={draft.deploymentUrl} />
        <label className="operations-check">
          <input checked={draft.registrationOpen === 'true'} disabled={!canManage} onChange={(event) => setDraft({ ...draft, registrationOpen: String(event.target.checked) })} type="checkbox" />
          Registration open
        </label>
        <button disabled={!canManage} type="submit">Save Settings</button>
      </form>
    </section>
  )
}

function PermissionMatrix() {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Security" title="Permission Matrix" />
      <div className="standings-table" role="table" aria-label="Permission matrix">
        <div className="table-row table-head" role="row">
          <span>Operation</span>
          <span>Minimum Role</span>
          <span>Access</span>
        </div>
        {permissionRows.map(([operation, role, access]) => (
          <div className="table-row" key={operation} role="row">
            <strong>{operation}</strong>
            <span>{role}</span>
            <span>{access}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="operations-empty">{text}</p>
}

function Input({
  disabled = false,
  label,
  onChange,
  type = 'text',
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  type?: string
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <input disabled={disabled} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  )
}

function RecordList({
  empty,
  items,
}: {
  empty: string
  items: Array<{
    detail: string
    id: number
    meta: string
    onDelete: () => void
    onEdit: () => void
    title: string
  }>
}) {
  if (items.length === 0) {
    return <EmptyState text={empty} />
  }

  return (
    <div className="operations-stack">
      {items.slice(0, 8).map((item) => (
        <article className="operations-record" key={item.id}>
          <span>{item.meta || 'Live record'}</span>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
          <div className="operations-actions">
            <button onClick={item.onEdit} type="button">Edit</button>
            <button onClick={item.onDelete} type="button">Delete</button>
          </div>
        </article>
      ))}
    </div>
  )
}

function Metric({ label, value }: { label: number | string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function healthLabel(data: OperationsDashboardData) {
  if (data.audit.summary.critical > 0) {
    return 'Critical'
  }

  if (data.audit.summary.warning > 0 || data.summary.identityStatus.unlinkedUsers > 0) {
    return 'Needs Review'
  }

  return 'Healthy'
}

function identityRecordMatches(
  record: OperationsIdentityRecord,
  query: string,
  filter: string,
) {
  const searchText = [
    record.player,
    record.division,
    record.googleEmail,
    record.portalUser,
    record.role,
  ]
    .join(' ')
    .toLowerCase()
  const normalizedQuery = query.trim().toLowerCase()
  const matchesSearch =
    normalizedQuery === '' || searchText.includes(normalizedQuery)

  if (!matchesSearch) {
    return false
  }

  switch (filter) {
    case 'linked':
      return record.linked
    case 'enabled':
      return record.enabled
    case 'disabled':
      return !record.enabled
    case 'missingEmail':
      return record.missingEmail
    case 'duplicateEmail':
      return record.duplicateEmail
    case 'duplicatePlayer':
      return record.duplicatePlayer
    case 'neverLoggedIn':
      return record.neverLoggedIn
    case 'brokenMapping':
      return record.brokenMapping
    default:
      return true
  }
}

function identityFlags(record: OperationsIdentityRecord) {
  const flags: string[] = []

  if (record.missingEmail) {
    flags.push('Missing Email')
  }

  if (record.duplicateEmail) {
    flags.push('Duplicate Email')
  }

  if (record.duplicatePlayer) {
    flags.push('Duplicate Player')
  }

  if (record.neverLoggedIn) {
    flags.push('Never Logged In')
  }

  if (record.brokenMapping) {
    flags.push('Broken Mapping')
  }

  return flags
}

function confirmSeasonOperation(operation: string, onAction: OperationsAction) {
  const accepted = window.confirm(
    `${operation}\n\nThis is a commissioner-only operation and will be recorded in the season archive.`,
  )

  if (accepted) {
    return onAction('seasonOperation', { operation })
  }

  return Promise.resolve()
}

function confirmEventLifecycleTransition(
  lifecycle: EventLifecycleData,
  onAction: OperationsAction,
) {
  const transition = lifecycle.nextTransition
  const accepted = window.confirm(
    `${transition.confirmationTitle || transition.label}\n\nThis will:\n${transition.confirmationBody
      .map((item) => `- ${item}`)
      .join('\n')}\n\nContinue?`,
  )

  if (accepted) {
    return onAction('eventLifecycleTransition', {
      direction: 'advance',
      eventId: lifecycle.event.id,
      reason: transition.label,
    })
  }

  return Promise.resolve()
}

function confirmEventLifecycleRollback(
  lifecycle: EventLifecycleData,
  onAction: OperationsAction,
) {
  const rollback = lifecycle.rollback
  const accepted = window.confirm(
    `${rollback.label}?\n\n${rollback.reason}\n\nThis will create an audit entry and trigger configured lifecycle automation.\n\nContinue?`,
  )

  if (accepted) {
    return onAction('eventLifecycleTransition', {
      direction: 'rollback',
      eventId: lifecycle.event.id,
      reason: rollback.label,
    })
  }

  return Promise.resolve()
}

function runOperationsCommand(command: string, onAction: OperationsAction) {
  return onAction('operationsCommand', { command })
}

export default CommissionerDashboard
