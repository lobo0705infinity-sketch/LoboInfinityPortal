import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normalizeArmyForDisplay } from '../services/armyIdentity'
import InfinityArmyLink from '../components/InfinityArmyLink'
import { armyListValue, filterAndSortArmyLists, type ArmyListSort } from './armyListDirectory'
import type { PublicArmyList } from './snapshotTypes'
import './ArmyListsTable.css'

export default function ArmyListsTable({ lists }: { lists: PublicArmyList[] }) {
  const [query, setQuery] = useState('')
  const [params, setParams] = useSearchParams()
  const faction = normalizeArmyForDisplay(params.get('faction') || '').trim()
  function setFaction(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set('faction', value)
    else next.delete('faction')
    setParams(next)
  }
  const [mission, setMission] = useState('')
  const [sort, setSort] = useState<ArmyListSort>('date')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const factions = [...new Set([...lists.map(list => armyListValue(list, 'faction')), faction].filter(Boolean))].sort()
  const missions = [...new Set(lists.map(list => list.mission).filter(Boolean))].sort()
  const columns: { key: ArmyListSort; label: string }[] = [
    { key: 'date', label: 'Date' }, { key: 'player', label: 'Player' },
    { key: 'faction', label: 'Faction' }, { key: 'mission', label: 'Mission' },
    ...(lists.some(list => armyListValue(list, 'opponent').trim()) ? [{ key: 'opponent' as const, label: 'Opponent' }] : []),
    ...(lists.some(list => armyListValue(list, 'result').trim()) ? [{ key: 'result' as const, label: 'Result' }] : []),
  ]
  const rows = filterAndSortArmyLists(lists, query, faction, mission, sort, direction)
  function changeSort(key: ArmyListSort) {
    setDirection(sort === key ? direction === 'asc' ? 'desc' : 'asc' : key === 'date' ? 'desc' : 'asc')
    setSort(key)
  }
  return <section className="army-list-directory" aria-label="Submitted army lists">
    <div className="army-list-filters">
      <label>Search lists<input type="search" placeholder="Player, faction, mission…" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <label>Faction<select value={faction} onChange={event => setFaction(event.target.value)}><option value="">All factions</option>{factions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Mission<select value={mission} onChange={event => setMission(event.target.value)}><option value="">All missions</option>{missions.map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" onClick={() => { setQuery(''); setFaction(''); setMission('') }} disabled={!query && !faction && !mission}>Clear filters</button>
    </div>
    <div className="army-list-summary"><p role="status">{rows.length} of {lists.length} lists</p><span>Select a heading to sort</span></div>
    <div className="army-list-table-scroll" role="region" aria-label="Army lists table" tabIndex={0}>
      <table className="army-list-table"><caption className="army-list-sr-only">Submitted army lists. Sort by selecting a column heading.</caption>
        <thead><tr>{columns.map(column => <th key={column.key} scope="col" aria-sort={sort === column.key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => changeSort(column.key)}>{column.label}<span aria-hidden="true">{sort === column.key ? direction === 'asc' ? ' ↑' : ' ↓' : ' ↕'}</span></button></th>)}<th scope="col">Army list</th></tr></thead>
        <tbody>{rows.length ? rows.map(list => <tr key={list.id}>{columns.map(column => <td key={column.key} data-label={column.label}>{column.key === 'date' ? formatListDate(list.date) : armyListValue(list, column.key) || '—'}</td>)}<td data-label="Army list">{list.armyLink ? <InfinityArmyLink mobileCopyOnly href={list.armyLink}>View List</InfinityArmyLink> : <span className="army-list-unavailable">Unavailable</span>}</td></tr>) : <tr><td colSpan={columns.length + 1} className="army-list-empty">{lists.length ? 'No lists match these filters.' : 'No army lists have been submitted yet.'}</td></tr>}</tbody>
      </table>
    </div>
  </section>
}
function formatListDate(value: string) {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? '—' : new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
