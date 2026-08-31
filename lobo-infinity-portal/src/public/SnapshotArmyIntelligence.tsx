import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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

export default function SnapshotArmyIntelligence() {
  const summary = useSnapshotData<Summary[]>('army-intelligence-summary')
  const [params, setParams] = useSearchParams()
  const selected = params.get('faction') ?? ''

  if (summary.error) return <PageState title="Army Intelligence unavailable" message={summary.error} error />
  if (!summary.data) return <PageState title="Loading Army Intelligence" message="Loading public coverage and faction options…" />

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

    <section className="panel snapshot-intelligence-selector" aria-label="Army selection">
      <label>
        <span>Faction or sectorial</span>
        <select value={selected} onChange={(event) => {
          const next = new URLSearchParams(params)
          if (event.target.value) next.set('faction', event.target.value)
          else next.delete('faction')
          setParams(next)
        }}>
          <option value="">Choose an army to analyze</option>
          {data.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <p>Select a faction or sectorial to load its persisted intelligence detail.</p>
    </section>

    {selected
      ? <ArmyIntelligenceDetail selected={selected} />
      : <PageState compact title="Select an army" message="Choose a faction or sectorial above to explore its lists, profiles, roles, and equipment." />}
  </main>
}

function ArmyIntelligenceDetail({ selected }: { selected: string }) {
  const detail = useSnapshotData<DetailGroup[]>('army-intelligence-detail')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [search, setSearch] = useState('')
  const [troopType, setTroopType] = useState('')
  const [skill, setSkill] = useState('')
  const [weapon, setWeapon] = useState('')
  const [sort, setSort] = useState<UsageSort>('coverage')
  const [listSearch, setListSearch] = useState('')

  if (detail.error) return <PageState compact error title="Detail could not be loaded" message="The immutable Army Intelligence detail file is unavailable. No live fallback was attempted." />
  if (!detail.data) return <PageState compact title={`Loading ${selected}`} message="Loading persisted profiles, lists, and composition data…" />

  const scope = selectScope(detail.data, selected)
  if (!scope.length) return <PageState compact title="No intelligence" message={`${selected} has no persisted intelligence group in this snapshot.`} />

  const allLists = scope.flatMap((group) => group.lists).filter((list) => list.decoded)
  const lists = allLists.filter((list) => matchesResult(list, resultFilter))
  const publicLists = scope.flatMap((group) => group.armyLists)
  const usage = buildUsage(lists)
  const troopTypes = unique(usage.map((row) => row.troopType).filter(Boolean))
  const skills = unique(usage.flatMap((row) => row.skills))
  const weapons = unique(usage.flatMap((row) => row.weapons))
  const visibleUsage = sortUsage(usage.filter((row) => {
    const query = search.trim().toLowerCase()
    return (!query || `${row.name} ${row.profiles.join(' ')}`.toLowerCase().includes(query))
      && (!troopType || row.troopType === troopType)
      && (!skill || row.skills.includes(skill))
      && (!weapon || row.weapons.includes(weapon))
  }), sort, lists.length)
  const visibleLists = publicLists
    .filter((list) => !listSearch.trim() || `${list.playerDisplayName} ${list.armyName} ${list.sectorial}`.toLowerCase().includes(listSearch.trim().toLowerCase()))
    .sort((a, b) => b.submissionDate.localeCompare(a.submissionDate))
  const entries = lists.flatMap(getEntries)
  const orderTotals = lists.map((list) => list.decoded?.orderCounts ?? {})
  const avg = (key: string) => round(average(orderTotals.map((orders) => Number(orders[key] ?? 0))))
  const roleRows = buildRoles(usage)
  const missions = countValues(lists.map((list) => list.mission).filter(Boolean))

  return <>
    <section className="panel snapshot-intelligence-controls" aria-label="Intelligence filters">
      <label><span>Analyze</span><select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as ResultFilter)}><option value="all">All decoded lists</option><option value="winning">Winning lists</option><option value="losing">Losing lists</option></select></label>
      <label><span>Profile search</span><input type="search" placeholder="Troop or profile" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label><span>Troop type</span><select value={troopType} onChange={(event) => setTroopType(event.target.value)}><option value="">All types</option>{troopTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Skill</span><select value={skill} onChange={(event) => setSkill(event.target.value)}><option value="">All skills</option>{skills.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Weapon</span><select value={weapon} onChange={(event) => setWeapon(event.target.value)}><option value="">All weapons</option>{weapons.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Sort profiles</span><select value={sort} onChange={(event) => setSort(event.target.value as UsageSort)}><option value="coverage">List coverage</option><option value="selections">Total selections</option><option value="points">Points</option><option value="alphabetical">Alphabetical</option></select></label>
    </section>

    {lists.length ? <>
      <section className="snapshot-intelligence-metrics" aria-label={`${selected} intelligence summary`}>
        <Metric label="Decoded lists" value={lists.length} />
        <Metric label="Public lists" value={publicLists.length} />
        <Metric label="Average points" value={round(average(lists.map((list) => Number(list.decoded?.totals.points ?? 0))))} />
        <Metric label="Average SWC" value={round(average(lists.map((list) => Number(list.decoded?.totals.swc ?? 0))))} />
        <Metric label="Regular orders" value={avg('regular')} />
        <Metric label="Irregular orders" value={avg('irregular')} />
        <Metric label="Models analyzed" value={entries.length} />
        <Metric label="Profiles found" value={usage.length} />
      </section>

      <section className="snapshot-intelligence-layout">
        <Panel eyebrow="Local analysis" title="Intelligence Brief">
          <ul className="snapshot-intelligence-brief">
            <li><strong>{usage[0]?.name ?? 'No profile'}</strong> has the broadest list coverage.</li>
            <li><strong>{roleRows.find((row) => row.label === 'Specialists')?.profiles.length ?? 0}</strong> specialist profiles appear in this selection.</li>
            <li><strong>{missions[0]?.label ?? 'No mission recorded'}</strong> is the most represented mission.</li>
            <li><strong>{scope.map((group) => group.faction).join(', ')}</strong> is represented by {lists.length} decoded public lists.</li>
          </ul>
        </Panel>
        <Panel eyebrow="Composition" title="Role Coverage">
          <div className="snapshot-role-grid">{roleRows.map((row) => <article key={row.label}><span>{row.label}</span><strong>{row.profiles.length}</strong><small>{row.profiles.slice(0, 4).join(', ') || 'None recorded'}</small></article>)}</div>
        </Panel>
      </section>

      <Panel eyebrow="Unit intelligence" title={`Model Usage — ${selected}`}>
        {visibleUsage.length ? <div className="snapshot-intelligence-table"><table><thead><tr><th>Unit / profile</th><th>Type</th><th>Points</th><th>Lists</th><th>Selections</th><th>Coverage</th><th>Roles</th></tr></thead><tbody>{visibleUsage.map((row) => <tr key={row.name}><td><strong>{row.name}</strong>{row.profiles.length > 1 ? <small>{row.profiles.slice(0, 3).join(' · ')}</small> : null}</td><td>{row.troopType || '—'}</td><td>{row.points || '—'}</td><td>{row.listCount}</td><td>{row.selections}</td><td>{Math.round((row.listCount / lists.length) * 100)}%</td><td>{row.roles.join(', ') || '—'}</td></tr>)}</tbody></table></div> : <Empty message="No profiles match the current filters." />}
      </Panel>

      <Panel eyebrow="Submitted forces" title="Army List Explorer">
        <div className="snapshot-list-search"><input type="search" placeholder="Search player, list, or sectorial" value={listSearch} onChange={(event) => setListSearch(event.target.value)} /><span>{visibleLists.length} lists</span></div>
        {visibleLists.length ? <div className="snapshot-intelligence-table"><table><thead><tr><th>Date</th><th>Player</th><th>Army</th><th>Faction / sectorial</th><th>Points</th><th>SWC</th><th>Source</th><th>Public link</th></tr></thead><tbody>{visibleLists.map((list) => <tr key={list.id}><td>{formatDate(list.submissionDate)}</td><td><strong>{list.playerDisplayName || list.player}</strong></td><td>{list.armyName}</td><td>{list.sectorial || list.faction}</td><td>{list.points}</td><td>{list.swc}</td><td>{list.source}</td><td>{list.armyLink ? <a href={list.armyLink} target="_blank" rel="noreferrer">Open list</a> : '—'}</td></tr>)}</tbody></table></div> : <Empty message="No submitted lists match this search." />}
      </Panel>
    </> : <PageState compact title="No matching intelligence" message="No decoded lists match the selected army and result filter." />}
  </>
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="panel snapshot-intelligence-panel"><div className="panel-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><div className="snapshot-intelligence-panel-body">{children}</div></section>
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>
}

function Empty({ message }: { message: string }) { return <div className="snapshot-intelligence-empty"><strong>No matching data</strong><p>{message}</p></div> }

function PageState({ title, message, compact = false, error = false }: { title: string; message: string; compact?: boolean; error?: boolean }) {
  return <section className={`panel snapshot-intelligence-state${compact ? ' compact' : ''}${error ? ' error' : ''}`} role={error ? 'alert' : undefined}><span className="snapshot-intelligence-state-mark" aria-hidden="true">{error ? '!' : '⌁'}</span><div><h2>{title}</h2><p>{message}</p></div></section>
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

function buildRoles(rows: UsageRow[]) {
  const labels = ['Lieutenants', 'Hackers', 'Specialists', 'Doctors', 'Engineers', 'Forward Observers', 'Chain of Command']
  return labels.map((label) => ({ label, profiles: rows.filter((row) => row.roles.includes(label)).map((row) => row.name) }))
}

function entryRoles(entry: Entry) {
  const roles: string[] = []
  if (entry.lieutenant) roles.push('Lieutenants')
  if (entry.hacker) roles.push('Hackers')
  if (entry.specialist) roles.push('Specialists')
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

function countValues(values: string[]) {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
function round(value: number) { return Math.round(value * 10) / 10 }
function normalize(value: string) { return value.trim().toLocaleLowerCase() }
function unique(values: string[]) { return [...new Set(values)].sort((a, b) => a.localeCompare(b)) }
function formatDate(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString() }
