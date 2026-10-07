import assert from 'node:assert/strict'
import { armyListValue, filterAndSortArmyLists } from '../src/public/armyListDirectory.ts'
import { buildArmyListsFactionPath } from '../src/services/armyIntelligenceNavigation.ts'
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

const aliases = ['Panoceania', 'PanOceania', 'Starco Free Company Of The Star', 'StarCo', 'Force De Reponse Rapide Merovingienne', 'Force de Réponse Rapide Merovingienne'].map((faction, index) => ({ ...lists[0], id: `alias-${index}`, sectorial: '', faction }))
assert.equal(new Set(aliases.map(list => armyListValue(list, 'faction'))).size, 3)
for (const faction of ['PanOceania', 'StarCo', 'Force de Réponse Rapide Merovingienne']) {
  assert.equal(filterAndSortArmyLists(aliases, '', faction, '', 'date', 'desc').length, 2, `${faction} must include both aliases`)
}
assert.equal(filterAndSortArmyLists(aliases, 'starco free company of the star', '', '', 'date', 'desc').length, 2)

for (const faction of ['Corregidor', 'Ariadna', 'Starco Free Company Of The Star', 'Force de Réponse Rapide Merovingienne']) {
  const target = new URL(buildArmyListsFactionPath(faction), 'https://portal.test')
  assert.equal(target.pathname, '/army-lists')
  const selected = target.searchParams.get('faction') || ''
  const source = faction === 'Corregidor' || faction === 'Ariadna' ? lists : aliases
  const rows = filterAndSortArmyLists(source, '', selected, '', 'date', 'desc')
  assert.ok(rows.length > 0, `${faction} navigation preserves matching lists`)
  assert.ok(rows.every(row => armyListValue(row, 'faction') === selected))
}
assert.equal(buildArmyListsFactionPath(''), '/army-lists')
console.log('Known Lists faction navigation checks passed')
