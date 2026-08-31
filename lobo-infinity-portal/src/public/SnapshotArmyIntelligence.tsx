import { type ReactNode, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import InteractiveMetricCard from '../components/InteractiveMetricCard'
import { useSnapshotData } from './useSnapshotData'
import './SnapshotArmyIntelligence.css'

type Summary = {
  available: boolean
  decodedLists: number
  failedLists: number
  options: string[]
  pendingLists: number
}

type ArmyList = {
  armyLink: string
  armyName: string
  faction: string
  id: string
  player: string
  playerDisplayName: string
  points: number
  sectorial: string
  source: string
  submissionDate: string
  swc: number
}

type Entry = {
  chainOfCommand: boolean
  doctor: boolean
  engineer: boolean
  equipment: string[]
  forwardObserver: boolean
  hacker: boolean
  lieutenant: boolean
  orderTypes: string[]
  points: number
  profile: string
  skills: string[]
  specialist: boolean
  structure: number | null
  swc: number
  troopType: string
  unit: string
  weapons: string[]
  wounds: number | null
}

type DecodedList = {
  date: string
  decoded?: {
    combatGroups: Array<{ combatGroup: number; entries: Entry[] }>
    faction: string
    listName: string
    orderCounts: Record<string, number>
    sectorial: string
    totals: { points?: number; swc?: number }
  }
  event: string
  faction: string
  gameType: string
  mission: string
  opponent: string
  player: string
  result: string
  results: string[]
  sectorial: string
  sourceId: string
  status: string
}

type DetailGroup = {
  armyLists: ArmyList[]
  faction: string
  lists: DecodedList[]
}

type ResultFilter = 'all' | 'winning' | 'losing'
type UsageSort = 'coverage' | 'selections' | 'points' | 'alphabetical'
type ExplorerSort = 'submissionDate' | 'player' | 'sectorial' | 'points'
type MetricIcon = 'impetuous' | 'irregular' | 'lieutenant' | 'lists' | 'points' | 'regular' | 'tactical' | 'wounds'

type UsageRow = {
  equipment: string[]
  listCount: number
  name: string
  points: number
  profiles: string[]
  roles: string[]
  selections: number
  skills: string[]
  troopType: string
  weapons: string[]
}

type RoleRow = {
  label: string
  profiles: UsageRow[]
}

export default function SnapshotArmyIntelligence() {
  const summary = useSnapshotData<Summary[]>('army-intelligence-summary')
  const [params, setParams] = useSearchParams()
  const selected = params.get('faction') ?? ''

  if (summary.error) return <PageState title="Army Intelligence unavailable" message={summary.error} error />
  if (!summary.data) return <PageState title="Loading Army Intelligence" message="Loading public coverage and faction options..." />

  const data = summary.data[0]
  if (!data?.available) return <PageState title="Army Intelligence unavailable" message="Persisted public intelligence is not available in this snapshot." error />

  return <main className="portal-shell snapshot-intelligence-page">
    <header className="snapshot-intelligence-hero">
      <div>
        <p className="eyebrow">Army Intelligence Explorer</p>
        <h1>Know the Field</h1>
        <p>Explore public submitted-list patterns, common profiles, specialist coverage, and force composition.</p>
      </div>
      <div className="snapshot-intelligence-coverage" aria-label="Snapshot intelligence coverage">
        <span><strong>{data.decodedLists}</strong> decoded lists</span>
        <span><strong>{data.options.length}</strong> armies indexed</span>
        <span><strong>{data.pendingLists}</strong> pending</span>
        <span><strong>{data.failedLists}</strong> failed</span>
      </div>
    </header>

    <section className="panel snapshot-intelligence-selector" aria-label="Army Intelligence analysis controls">
      <label>
        <span>Select sectorial</span>
        <select value={selected} onChange={(event) => {
          const next = new URLSearchParams(params)
          if (event.target.value) next.set('faction', event.target.value)
          else next.delete('faction')
          setParams(next)
        }}>
          <option value="">Choose a sectorial</option>
          {data.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <p>Select a faction or sectorial to load its persisted intelligence detail from this immutable public snapshot.</p>
    </section>

    {selected
      ? <ArmyIntelligenceDetail selected={selected} />
      : <PageState compact title="Select an army" message="Choose a faction or sectorial to view army-list analysis." />}
  </main>
}

function ArmyIntelligenceDetail({ selected }: { selected: string }) {
  const detail = useSnapshotData<DetailGroup[]>('army-intelligence-detail')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [search, setSearch] = useState('')
  const [troopType, setTroopType] = useState('')
  const [skill, setSkill] = useState('')
  const [weapon, setWeapon] = useState('')
  const [equipment, setEquipment] = useState('')
  const [sort, setSort] = useState<UsageSort>('alphabetical')
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [explorerSearch, setExplorerSearch] = useState('')
  const [explorerPlayer, setExplorerPlayer] = useState('')
  const [explorerSectorial, setExplorerSectorial] = useState('')
  const [explorerSort, setExplorerSort] = useState<ExplorerSort>('submissionDate')

  if (detail.error) return <PageState compact error title="Detail could not be loaded" message="The immutable Army Intelligence detail file is unavailable. No live fallback was attempted." />
  if (!detail.data) return <PageState compact title={`Loading ${selected}`} message="Loading persisted profiles, lists, and composition data..." />

  const scope = selectScope(detail.data, selected)
  if (!scope.length) return <PageState compact title="No intelligence" message={`${selected} has no persisted intelligence group in this snapshot.`} />

  const allLists = scope.flatMap((group) => group.lists).filter((list) => list.decoded)
  const lists = allLists.filter((list) => matchesResult(list, resultFilter))
  const publicLists = scope.flatMap((group) => group.armyLists)
  const usage = buildUsage(lists)
  const troopTypes = unique(usage.map((row) => row.troopType).filter(Boolean))
  const skills = unique(usage.flatMap((row) => row.skills))
  const weapons = unique(usage.flatMap((row) => row.weapons))
  const equipmentOptions = unique(usage.flatMap((row) => row.equipment))
  const visibleUsage = sortUsage(usage.filter((row) => {
    const query = search.trim().toLowerCase()
    return (!query || `${row.name} ${row.profiles.join(' ')}`.toLowerCase().includes(query))
      && (!troopType || row.troopType === troopType)
      && (!skill || row.skills.includes(skill))
      && (!weapon || row.weapons.includes(weapon))
      && (!equipment || row.equipment.includes(equipment))
  }), sort, lists.length)
  const entries = lists.flatMap(getEntries)
  const orderTotals = lists.map((list) => list.decoded?.orderCounts ?? {})
  const avg = (...keys: string[]) => round(average(orderTotals.map((orders) => keys.reduce((value, key) => value || Number(orders[key] ?? 0), 0))))
  const roleRows = buildRoles(usage)
  const missions = countValues(lists.map((list) => list.mission).filter(Boolean))
  const players = unique(publicLists.map((list) => list.playerDisplayName || list.player).filter(Boolean))
  const sectorials = unique(publicLists.map((list) => list.sectorial || list.faction).filter(Boolean))
  const visibleLists = sortExplorerLists(publicLists.filter((list) => {
    const query = explorerSearch.trim().toLowerCase()
    const player = list.playerDisplayName || list.player
    const sectorial = list.sectorial || list.faction
    return (!query || `${player} ${list.armyName} ${sectorial}`.toLowerCase().includes(query))
      && (!explorerPlayer || player === explorerPlayer)
      && (!explorerSectorial || sectorial === explorerSectorial)
  }), explorerSort)
  const averagePoints = round(average(lists.map((list) => Number(list.decoded?.totals.points ?? 0))))
  const averageDurability = round(average(entries.map((entry) => Number(entry.wounds ?? entry.structure ?? 0)).filter((value) => value > 0)))

  return <>
    <section className="panel snapshot-intelligence-controls" aria-label="Model Usage filters">
      <label><span>Analyze</span><select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as ResultFilter)}><option value="all">All Army Lists</option><option value="winning">Army Lists with a Winning Record</option><option value="losing">Army Lists with a Losing Record</option></select></label>
      <label><span>Type</span><select value={troopType} onChange={(event) => setTroopType(event.target.value)}><option value="">All Types</option>{troopTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as UsageSort)}><option value="alphabetical">Alphabetically</option><option value="coverage">List Coverage</option><option value="selections">Total Selections</option><option value="points">Points: High to Low</option></select></label>
      <label><span>Search</span><input type="search" placeholder="Troop or profile" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label><span>Skill</span><select value={skill} onChange={(event) => setSkill(event.target.value)}><option value="">All Skills</option>{skills.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Weapon</span><select value={weapon} onChange={(event) => setWeapon(event.target.value)}><option value="">All Weapons</option>{weapons.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Equipment</span><select value={equipment} onChange={(event) => setEquipment(event.target.value)}><option value="">All Equipment</option>{equipmentOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
    </section>

    {lists.length ? <>
      <IntelligenceBrief
        faction={selected}
        lists={lists.length}
        mission={missions[0]?.label ?? ''}
        primaryProfile={usage[0]?.name ?? ''}
        roles={roleRows}
      />

      <section className="snapshot-intelligence-metrics snapshot-intelligence-mature-metrics" aria-label={`${selected} intelligence summary`}>
        <IntelligenceMetric icon="lists" label="Known Army Lists" value={publicLists.length} helper="Browse submitted army lists" onActivate={() => setExplorerOpen(true)} />
        <IntelligenceMetric icon="regular" label="Average Regular Orders" value={avg('regular')} />
        <IntelligenceMetric icon="irregular" label="Average Irregular Orders" value={avg('irregular')} />
        <IntelligenceMetric icon="tactical" label="Average Tactical Awareness Orders" value={avg('tacticalAwareness', 'tactical')} />
        <IntelligenceMetric icon="impetuous" label="Average Impetuous Orders" value={avg('impetuous')} />
        <IntelligenceMetric icon="lieutenant" label="Average Lieutenant Orders" value={avg('lieutenant')} />
        <IntelligenceMetric icon="wounds" label="Average Wounds / Structure per Model" value={averageDurability} />
        <IntelligenceMetric icon="points" label="Average Points" value={averagePoints} />
      </section>

      <UsagePanel items={visibleUsage} listCount={lists.length} title="Model Usage" wide />

      <section className="snapshot-intelligence-role-grid" aria-label="Role usage breakdowns">
        {roleRows.map((row) => <RoleDisclosure key={row.label} row={row} listCount={lists.length} />)}
      </section>

      <ArmyListExplorer
        lists={visibleLists}
        open={explorerOpen}
        players={players}
        player={explorerPlayer}
        search={explorerSearch}
        sectorial={explorerSectorial}
        sectorials={sectorials}
        sort={explorerSort}
        onClose={() => setExplorerOpen(false)}
        onPlayerChange={setExplorerPlayer}
        onSearchChange={setExplorerSearch}
        onSectorialChange={setExplorerSectorial}
        onSortChange={setExplorerSort}
      />
    </> : <PageState compact title="No matching intelligence" message="No decoded lists match the selected sectorial and result filter." />}
  </>
}

function IntelligenceBrief({ faction, lists, mission, primaryProfile, roles }: { faction: string; lists: number; mission: string; primaryProfile: string; roles: RoleRow[] }) {
  const specialists = roles.find((row) => row.label === 'Specialist Operatives')?.profiles.length ?? 0
  const strongestRole = [...roles].sort((a, b) => b.profiles.length - a.profiles.length)[0]
  return <section className="panel snapshot-intelligence-brief-panel" aria-labelledby="snapshot-intelligence-brief-title">
    <div className="snapshot-intelligence-brief-header"><span>Intelligence Brief</span><h2 id="snapshot-intelligence-brief-title">{faction}</h2></div>
    <ul>
      <li><strong>{primaryProfile || 'No profile recorded'}</strong><span>has the broadest list coverage in the selected sample.</span></li>
      <li><strong>{specialists} specialist profiles</strong><span>appear across the submitted forces.</span></li>
      <li><strong>{strongestRole?.label ?? 'No role coverage'}</strong><span>is the most represented operational role.</span></li>
      <li><strong>{mission || 'No mission recorded'}</strong><span>is the most represented mission across {lists} decoded lists.</span></li>
    </ul>
  </section>
}

function IntelligenceMetric({ icon, label, value, helper, onActivate }: { icon: MetricIcon; label: string; value: number; helper?: string; onActivate?: () => void }) {
  return <InteractiveMetricCard
    ariaLabel={onActivate ? `Browse ${label}` : label}
    className="snapshot-intelligence-metric"
    helperText={helper}
    icon={<MetricIcon icon={icon} />}
    label={label}
    onActivate={onActivate}
    value={formatNumber(value)}
  />
}

function MetricIcon({ icon }: { icon: MetricIcon }) {
  return <span className={`snapshot-intelligence-metric-icon is-${icon}`} aria-hidden="true" />
}

function UsagePanel({ items, listCount, title, wide = false }: { items: UsageRow[]; listCount: number; title: string; wide?: boolean }) {
  return <Panel eyebrow="Unit intelligence" title={title} className={wide ? 'snapshot-intelligence-panel-wide' : ''}>
    {items.length ? <div className="snapshot-intelligence-usage-groups">
      {items.map((row) => <details className="snapshot-intelligence-usage-group" key={row.name}>
        <summary>
          <span className="snapshot-intelligence-profile-cell"><strong>{row.name}</strong><small>{row.troopType || 'Profile'} {row.profiles.length > 1 ? `- ${row.profiles.length} profiles` : ''}</small></span>
          <span>{row.points || '—'} pts</span>
          <span>{row.listCount} lists</span>
          <span>{listCount ? Math.round((row.listCount / listCount) * 100) : 0}% coverage</span>
        </summary>
        <div className="snapshot-intelligence-profile-usage">
          <p><strong>Profiles</strong> {row.profiles.join(' · ') || row.name}</p>
          <p><strong>Roles</strong> {row.roles.join(', ') || 'None recorded'}</p>
          <p><strong>Skills</strong> {row.skills.join(', ') || 'None recorded'}</p>
          <p><strong>Weapons</strong> {row.weapons.join(', ') || 'None recorded'}</p>
          <p><strong>Equipment</strong> {row.equipment.join(', ') || 'None recorded'}</p>
        </div>
      </details>)}
    </div> : <Empty message="No profiles match the current filters." />}
  </Panel>
}

function RoleDisclosure({ row, listCount }: { row: RoleRow; listCount: number }) {
  return <details className="snapshot-intelligence-role-disclosure">
    <summary><span>Role coverage</span><strong>{row.label}</strong><small>{row.profiles.length} profiles</small></summary>
    <UsagePanel items={row.profiles} listCount={listCount} title={row.label} />
  </details>
}

function ArmyListExplorer({ lists, open, players, player, search, sectorial, sectorials, sort, onClose, onPlayerChange, onSearchChange, onSectorialChange, onSortChange }: {
  lists: ArmyList[]
  open: boolean
  players: string[]
  player: string
  search: string
  sectorial: string
  sectorials: string[]
  sort: ExplorerSort
  onClose: () => void
  onPlayerChange: (value: string) => void
  onSearchChange: (value: string) => void
  onSectorialChange: (value: string) => void
  onSortChange: (value: ExplorerSort) => void
}) {
  if (!open) return null
  return <div className="snapshot-intelligence-explorer-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="snapshot-intelligence-explorer-panel" role="dialog" aria-modal="true" aria-label="Army List Explorer" onMouseDown={(event) => event.stopPropagation()}>
      <header className="snapshot-intelligence-explorer-header"><div><p className="eyebrow">Army List Explorer</p><h2>Submitted forces</h2></div><button type="button" onClick={onClose}>Close</button></header>
      <div className="snapshot-intelligence-explorer-stats"><article><span>Visible lists</span><strong>{lists.length}</strong></article><article><span>Players</span><strong>{new Set(lists.map((list) => list.playerDisplayName || list.player)).size}</strong></article><article><span>Sectorials</span><strong>{new Set(lists.map((list) => list.sectorial || list.faction)).size}</strong></article></div>
      <section className="snapshot-intelligence-explorer-controls" aria-label="Army List Explorer controls">
        <label><span>Search</span><input type="search" placeholder="Player, list, or sectorial" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label>
        <label><span>Player</span><select value={player} onChange={(event) => onPlayerChange(event.target.value)}><option value="">All players</option>{players.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Sectorial</span><select value={sectorial} onChange={(event) => onSectorialChange(event.target.value)}><option value="">All sectorials</option>{sectorials.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Sort</span><select value={sort} onChange={(event) => onSortChange(event.target.value as ExplorerSort)}><option value="submissionDate">Newest submission</option><option value="player">Player</option><option value="sectorial">Sectorial</option><option value="points">Points</option></select></label>
      </section>
      {lists.length ? <div className="snapshot-intelligence-table snapshot-intelligence-explorer-table"><table><thead><tr><th>Date</th><th>Player</th><th>Army</th><th>Faction / sectorial</th><th>Points</th><th>SWC</th><th>Source</th><th>Public link</th></tr></thead><tbody>{lists.map((list) => <tr key={list.id}><td>{formatDate(list.submissionDate)}</td><td><strong>{list.playerDisplayName || list.player}</strong></td><td>{list.armyName}</td><td>{list.sectorial || list.faction}</td><td>{list.points}</td><td>{list.swc}</td><td>{list.source}</td><td>{list.armyLink ? <a href={list.armyLink} target="_blank" rel="noreferrer">Open list</a> : '—'}</td></tr>)}</tbody></table></div> : <Empty message="No army lists match the current explorer filters." />}
    </section>
  </div>
}

function Panel({ eyebrow, title, children, className = '' }: { eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return <section className={`panel snapshot-intelligence-panel ${className}`}><div className="panel-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><div className="snapshot-intelligence-panel-body">{children}</div></section>
}

function Empty({ message }: { message: string }) { return <div className="snapshot-intelligence-empty"><strong>No matching data</strong><p>{message}</p></div> }

function PageState({ title, message, compact = false, error = false }: { title: string; message: string; compact?: boolean; error?: boolean }) {
  return <section className={`panel snapshot-intelligence-state${compact ? ' compact' : ''}${error ? ' error' : ''}`} role={error ? 'alert' : undefined}><span className="snapshot-intelligence-state-mark" aria-hidden="true">{error ? '!' : 'i'}</span><div><h2>{title}</h2><p>{message}</p></div></section>
}

function selectScope(groups: DetailGroup[], selected: string) {
  const exact = groups.find((group) => normalize(group.faction) === normalize(selected))
  if (!exact) return []
  const parent = exact.lists.find((list) => list.decoded)?.decoded?.faction
  const selectedIsParent = parent && normalize(parent) === normalize(selected)
  if (!selectedIsParent) return [exact]
  return groups.filter((group) => group.lists.some((list) => normalize(list.decoded?.faction ?? list.faction) === normalize(selected)))
}

function matchesResult(list: DecodedList, filter: ResultFilter) {
  if (filter === 'all') return true
  const results = [list.result, ...(list.results ?? [])].join(' ').toLowerCase()
  return filter === 'winning' ? /win|won|victory/.test(results) : /loss|lost|defeat/.test(results)
}

function getEntries(list: DecodedList) { return list.decoded?.combatGroups.flatMap((group) => group.entries) ?? [] }

export function buildUsage(lists: DecodedList[]): UsageRow[] {
  const rows = new Map<string, UsageRow & { listIds: Set<string> }>()
  lists.forEach((list, index) => {
    const seen = new Set<string>()
    getEntries(list).forEach((entry) => {
      const name = entry.unit || entry.profile || 'Unknown profile'
      const key = normalize(name)
      const row = rows.get(key) ?? { equipment: [], listCount: 0, listIds: new Set(), name, points: entry.points || 0, profiles: [], roles: [], selections: 0, skills: [], troopType: entry.troopType || '', weapons: [] }
      row.selections += 1
      if (!seen.has(key)) { row.listCount += 1; seen.add(key); row.listIds.add(String(index)) }
      row.points = Math.max(row.points, entry.points || 0)
      row.profiles = unique([...row.profiles, entry.profile].filter(Boolean))
      row.skills = unique([...row.skills, ...(entry.skills ?? [])])
      row.weapons = unique([...row.weapons, ...(entry.weapons ?? [])])
      row.equipment = unique([...row.equipment, ...(entry.equipment ?? [])])
      row.roles = unique([...row.roles, ...entryRoles(entry)])
      rows.set(key, row)
    })
  })
  return [...rows.values()].map(({ listIds: _listIds, ...row }) => row)
}

function buildRoles(rows: UsageRow[]): RoleRow[] {
  const labels = ['Lieutenant Choices', 'Hackers', 'Specialist Operatives', 'Doctors', 'Engineers', 'Forward Observers', 'Chain of Command']
  return labels.map((label) => ({ label, profiles: rows.filter((row) => row.roles.includes(label)).map((row) => row) }))
}

function entryRoles(entry: Entry) {
  const roles: string[] = []
  if (entry.lieutenant) roles.push('Lieutenant Choices')
  if (entry.hacker) roles.push('Hackers')
  if (entry.specialist) roles.push('Specialist Operatives')
  if (entry.doctor) roles.push('Doctors')
  if (entry.engineer) roles.push('Engineers')
  if (entry.forwardObserver) roles.push('Forward Observers')
  if (entry.chainOfCommand) roles.push('Chain of Command')
  return roles
}

function sortUsage(rows: UsageRow[], sort: UsageSort, listCount: number) {
  return [...rows].sort((a, b) => {
    if (sort === 'alphabetical') return a.name.localeCompare(b.name)
    if (sort === 'points') return b.points - a.points || a.name.localeCompare(b.name)
    if (sort === 'selections') return b.selections - a.selections || a.name.localeCompare(b.name)
    return (b.listCount / listCount) - (a.listCount / listCount) || b.selections - a.selections
  })
}

function sortExplorerLists(rows: ArmyList[], sort: ExplorerSort) {
  return [...rows].sort((a, b) => {
    if (sort === 'player') return (a.playerDisplayName || a.player).localeCompare(b.playerDisplayName || b.player)
    if (sort === 'sectorial') return (a.sectorial || a.faction).localeCompare(b.sectorial || b.faction)
    if (sort === 'points') return Number(b.points) - Number(a.points) || b.submissionDate.localeCompare(a.submissionDate)
    return b.submissionDate.localeCompare(a.submissionDate)
  })
}

function countValues(values: string[]) {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
function round(value: number) { return Math.round(value * 10) / 10 }
function formatNumber(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1) }
function normalize(value: string) { return value.trim().toLocaleLowerCase() }
function unique(values: string[]) { return [...new Set(values)].sort((a, b) => a.localeCompare(b)) }
function formatDate(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString() }
