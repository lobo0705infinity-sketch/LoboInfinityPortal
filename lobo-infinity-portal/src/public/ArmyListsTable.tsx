import { useRememberedScroll } from '../components/useRememberedScroll'
import TablePagination from '../components/TablePagination'
import { useTablePagination } from '../components/useTablePagination'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { normalizeArmyForDisplay } from '../services/armyIdentity'
import InfinityArmyLink from '../components/InfinityArmyLink'
import { armyListValue, filterAndSortArmyLists, type ArmyListSort } from './armyListDirectory'
import type { PublicArmyList } from './snapshotTypes'
import './ArmyListsTable.css'

export default function ArmyListsTable({ lists }: { lists: PublicArmyList[] }) {
  const [params, setParams] = useSearchParams()
  const location=useLocation()
  const returnState={directoryReturnTo:`${location.pathname}${location.search}`}
  const tableScroll = useRememberedScroll()
  const query=params.get('q') || ''
  const faction=normalizeArmyForDisplay(params.get('faction') || '').trim()
  const mission=params.get('mission') || ''
  const allowedSorts:ArmyListSort[]=['date','player','faction','mission','opponent','result']
  const sort=allowedSorts.includes(params.get('sort') as ArmyListSort)?params.get('sort') as ArmyListSort:'date'
  const direction=params.get('direction')==='asc'?'asc':'desc'
  function update(values:Record<string,string>) {
    const next=new URLSearchParams(params)
    for(const [key,value] of Object.entries(values)){if(value)next.set(key,value);else next.delete(key)}
    setParams(next,{replace:true})
  }
  const factions = [...new Set([...lists.map(list => armyListValue(list, 'faction')), faction].filter(Boolean))].sort()
  const missions = [...new Set(lists.map(list => list.mission).filter(Boolean))].sort()
  const columns: { key: ArmyListSort; label: string }[] = [
    { key: 'date', label: 'Date' }, { key: 'player', label: 'Player' },
    { key: 'faction', label: 'Faction' }, { key: 'mission', label: 'Mission' },
    ...(lists.some(list => armyListValue(list, 'opponent').trim()) ? [{ key: 'opponent' as const, label: 'Opponent' }] : []),
    ...(lists.some(list => armyListValue(list, 'result').trim()) ? [{ key: 'result' as const, label: 'Result' }] : []),
  ]
  const rows = filterAndSortArmyLists(lists, query, faction, mission, sort, direction)
  const pagination = useTablePagination(rows,[query,faction,mission,sort,direction,lists.map(list=>list.id)])
  function changeSort(key:ArmyListSort) {
    update({sort:key,direction:sort===key?(direction==='asc'?'desc':'asc'):key==='date'?'desc':'asc'})
  }
  return <section className="army-list-directory" aria-label="Submitted army lists">
    <div className="army-list-filters">
      <label>Search lists<input type="search" placeholder="Player, faction, mission…" value={query} onChange={event => update({q:event.target.value})}/></label>
      <label>Faction<select value={faction} onChange={event => update({faction:event.target.value})}><option value="">All factions</option>{factions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Mission<select value={mission} onChange={event => update({mission:event.target.value})}><option value="">All missions</option>{missions.map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" onClick={() => { update({q:'',faction:'',mission:''}) }} disabled={!query && !faction && !mission}>Clear filters</button>
    </div>
    <div className="army-list-summary"><p role="status">{rows.length} of {lists.length} lists</p><span>Select a heading to sort</span></div>
    <div ref={tableScroll} className="army-list-table-scroll" role="region" aria-label="Army lists table" tabIndex={0}>
      <table className="army-list-table"><caption className="army-list-sr-only">Submitted army lists. Sort by selecting a column heading.</caption>
        <thead><tr>{columns.map(column => <th key={column.key} scope="col" aria-sort={sort === column.key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => changeSort(column.key)}>{column.label}<span aria-hidden="true">{sort === column.key ? direction === 'asc' ? ' ↑' : ' ↓' : ' ↕'}</span></button></th>)}<th scope="col">Army list</th></tr></thead>
        <tbody>{rows.length ? pagination.rows.map(list => <tr key={list.id}>{columns.map(column => <td key={column.key} data-label={column.label}>{column.key === 'date' ? formatListDate(list.date) : column.key === 'player' ? <Link state={returnState} to={`/players/${encodeURIComponent(list.player)}`}>{armyListValue(list,column.key)}</Link> : column.key === 'faction' ? <Link state={returnState} to={`/factions/${encodeURIComponent(armyListValue(list,column.key))}`}>{armyListValue(list,column.key)}</Link> : armyListValue(list,column.key) || '—'}</td>)}<td data-label="Army list">{list.armyLink ? <InfinityArmyLink mobileCopyOnly href={list.armyLink}>View List</InfinityArmyLink> : <span className="army-list-unavailable">Unavailable</span>}</td></tr>) : <tr><td colSpan={columns.length + 1} className="army-list-empty">{lists.length ? 'No lists match these filters.' : 'No army lists have been submitted yet.'}</td></tr>}</tbody>
      </table>
    </div>
    <TablePagination {...pagination}/>
  </section>
}
function formatListDate(value: string) {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? '—' : new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
