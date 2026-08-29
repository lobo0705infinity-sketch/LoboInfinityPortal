import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

const root = process.cwd()
const source = fs.readFileSync(path.join(root, 'backend', 'PlayersApi.gs'), 'utf8')

const favoriteMapSource = source.slice(
  source.indexOf('function buildCommunityArmyListFavoriteArmyMap'),
  source.indexOf('function getCommunityArmyListPreferredArmy'),
)

assert.match(favoriteMapSource, /getCommunityPersistedArmyListIdentities\(\)/)
assert.match(favoriteMapSource, /readArmyListsReadModelPayload\(\)/)
assert.doesNotMatch(favoriteMapSource, /getArmyListObjects\(/)
assert.doesNotMatch(favoriteMapSource, /CanonicalDecoderGateway/)
assert.doesNotMatch(favoriteMapSource, /decode\(/)
assert.doesNotMatch(favoriteMapSource, /UrlFetchApp/)

const canonicalize = (value) => String(value || '').trim()
const keyFor = (value) => canonicalize(value).toLowerCase()
const preferredArmy = (list) => canonicalize(list.sectorial) || canonicalize(list.faction)

function mostCommon(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] || 0) + 1
  let value = ''
  let count = 0
  for (const candidate in counts) {
    if (counts[candidate] > count) {
      value = candidate
      count = counts[candidate]
    }
  }
  return { value, count }
}

function buildMap(lists, decode = () => assert.fail('decoder must not run')) {
  const valuesByPlayer = {}
  for (const list of lists) {
    const player = canonicalize(list.player)
    const displayName = canonicalize(list.playerDisplayName)
    const army = preferredArmy(list)
    if (!list.approved || !player || !army) continue
    for (const identity of [player, displayName]) {
      const key = keyFor(identity)
      if (!key) continue
      if (!valuesByPlayer[key]) valuesByPlayer[key] = []
      valuesByPlayer[key].push(army)
    }
  }
  const result = {}
  for (const player in valuesByPlayer) {
    const favorite = mostCommon(valuesByPlayer[player])
    if (favorite.count > 0 && favorite.value) result[player] = favorite.value
  }
  void decode
  return result
}

const semanticFixture = [
  { id: 'a', player: 'Vanilla', playerDisplayName: 'Vanilla', faction: 'PanOceania', sectorial: '', approved: true },
  { id: 'b', player: 'Sectorial', playerDisplayName: 'Sectorial', faction: 'PanOceania', sectorial: 'Military Orders', approved: true },
  { id: 'c', player: 'Multiple', playerDisplayName: 'Multiple Display', faction: 'Yu Jing', sectorial: 'Invincible Army', approved: true },
  { id: 'd', player: 'Multiple', playerDisplayName: 'Multiple Display', faction: 'Yu Jing', sectorial: 'Invincible Army', approved: true },
  { id: 'e', player: 'Multiple', playerDisplayName: 'Multiple Display', faction: 'Yu Jing', sectorial: 'White Banner', approved: true },
  { id: 'f', player: 'Tie', playerDisplayName: 'Tie', faction: 'Nomads', sectorial: 'Corregidor', approved: true },
  { id: 'g', player: 'Tie', playerDisplayName: 'Tie', faction: 'Nomads', sectorial: 'Bakunin', approved: true },
  { id: 'missing', player: 'Missing', playerDisplayName: 'Missing', faction: '', sectorial: '', approved: true },
  { id: 'rejected', player: 'Rejected', faction: 'Haqqislam', sectorial: '', approved: false },
]

const expected = buildMap(semanticFixture)
const actual = buildMap(JSON.parse(JSON.stringify(semanticFixture)))
assert.deepEqual(actual, expected)
assert.equal(actual.vanilla, 'PanOceania')
assert.equal(actual.sectorial, 'Military Orders')
assert.equal(actual.multiple, 'Invincible Army')
assert.equal(actual['multiple display'], 'Invincible Army')
assert.equal(actual.tie, 'Corregidor')
assert.equal(actual.missing, undefined)
assert.equal(actual.rejected, undefined)

function makeFixture(players, lists) {
  const values = []
  for (let index = 0; index < lists; index += 1) {
    const player = `Player ${index % players}`
    values.push({
      id: `list-${index}`,
      player,
      playerDisplayName: player,
      faction: `Faction ${index % 8}`,
      sectorial: index % 3 === 0 ? `Sectorial ${index % 16}` : '',
      approved: true,
    })
  }
  return values
}

for (const [players, games, lists] of [[43, 72, 110], [100, 300, 500]]) {
  const fixture = makeFixture(players, lists)
  const startedAt = performance.now()
  const map = buildMap(fixture)
  const elapsedMs = performance.now() - startedAt
  assert.equal(Object.keys(map).length, players)
  assert.ok(elapsedMs < 100, `favorite-army fixture took ${elapsedMs.toFixed(3)}ms`)
  console.log(JSON.stringify({ players, games, lists, elapsedMs: Number(elapsedMs.toFixed(3)) }))
}

console.log('Persisted favorite-army identity regression passed with zero decoder calls.')
