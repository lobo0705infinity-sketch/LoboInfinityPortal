import assert from 'node:assert/strict'
import { filterAndSortArmyLists } from '../src/public/armyListDirectory.ts'
import type { PublicArmyList } from '../src/public/snapshotTypes.ts'
const lists = [
  { id: 'b', player: 'Bravo', playerDisplayName: 'Zulu', faction: 'Nomads', sectorial: 'Corregidor', mission: 'The Dig', date: '2026-10-01', opponent: 'Alpha', result: 'Win' },
  { id: 'a', player: 'Alpha', playerDisplayName: '', faction: 'Ariadna', sectorial: '', mission: 'Data Harvest', date: '2026-10-06', opponent: '', result: '' },
  { id: 'c', player: 'Charlie', playerDisplayName: '', faction: 'Nomads', sectorial: 'Corregidor', mission: 'The Dig', date: '', opponent: '', result: '' },
] as PublicArmyList[]
const sort = (key: Parameters<typeof filterAndSortArmyLists>[4], direction: 'asc'|'desc') => filterAndSortArmyLists(lists, '', '', '', key, direction).map(x => x.id)
assert.deepEqual(sort('date','desc'), ['a','b','c'])
assert.deepEqual(sort('date','asc'), ['b','a','c'])
assert.deepEqual(sort('player','asc'), ['a','c','b'])
assert.deepEqual(sort('player','desc'), ['b','c','a'])
assert.deepEqual(sort('opponent','desc'), ['b','a','c'])
assert.deepEqual(filterAndSortArmyLists(lists, ' zULu ', 'Corregidor', 'The Dig', 'date', 'desc').map(x=>x.id), ['b'])
assert.equal(filterAndSortArmyLists(lists,'','Ariadna','The Dig','date','desc').length,0)
assert.equal(filterAndSortArmyLists(lists,'data harvest','','','date','desc').length,1)
assert.deepEqual(lists.map(x=>x.id),['b','a','c'], 'Sorting must not mutate snapshot data')
console.log('Army list filtering and sorting checks passed')
