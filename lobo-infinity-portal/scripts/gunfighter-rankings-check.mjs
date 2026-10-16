import assert from 'node:assert/strict'
import { readArtifact } from './benchmark-artifacts.mjs'
import { loadBundledGunfighterRankings } from '../bot/gunfighter-rankings.mjs'
import { rankArmyGunfighters } from '../bot/gunfighter-benchmark-catalog.mjs'
import { gunfighterEntryMarkup } from '../bot/inf-list-tactical.mjs'

const catalog = await readArtifact('data/infinity-army/gunfighter-benchmark-catalog.json.gz.b64')
const rankings = await loadBundledGunfighterRankings(catalog)
const karakuri = rankings.get('1101:154:1:5:1')
assert.deepEqual(karakuri.normal, { faction: { rank: 21, total: 134 }, global: { rank: 1224, total: 5599 } })
assert.deepEqual(karakuri.fireteam, { faction: { rank: 2, total: 21 }, global: { rank: 532, total: 2607 } })

const oYoroi = rankings.get('1101:156:1:1:1')
const oYoroiLieutenant = rankings.get('1101:156:1:2:1')
assert.deepEqual(oYoroi.normal, oYoroiLieutenant.normal, 'equally rated Lieutenant loadouts share their placement')
assert.equal(oYoroi.normal.faction.rank, 1)
assert.equal(rankings.has('1101:154:1:1:1'), true, 'the selected Karakuri shotgun profile is separately ranked')
assert.deepEqual([...rankings].filter(([, rank]) => rank.normal?.global.rank === 1).map(([key]) => key).sort(),
  ['601:785:1:2:1', '604:785:1:2:1'], 'the Overdron Plasma Sniper ties at #1 across its two factions')
assert.equal(catalog.entries.find(entry => entry.key === '601:785:1:2:1')?.result.states[0].rating, 49.06)
assert.equal(catalog.entries.find(entry => entry.key === '102:11:1:1:1')?.result.states[0].rating, 47.8,
  'the next distinct gunfighter is the Dragão HRMC')

const decodedArmy = { sectorialId: 1101, combatGroups: [{ members: [{
  unitId: 154, groupId: 1, optionId: 5, combinedId: '1101-154-1-5-1', unitName: 'Karakuri', profileName: 'Karakuri FO',
}] }] }
const [rated] = rankArmyGunfighters(catalog, decodedArmy, { rankings })
assert.deepEqual(rated.nonLinked.ranking, karakuri.normal)
assert.deepEqual(rated.fireteamLinked.ranking, karakuri.fireteam)
const card = gunfighterEntryMarkup(rated, 0)
assert.match(card, /LIST<\/small>#1/)
assert.match(card, /NON-LINKED[\s\S]*?IN FACTION #21\/134 · GLOBAL #1,224\/5,599/)
assert.match(card, /LINKED \+1SD[\s\S]*?IN FACTION #2\/21 · GLOBAL #532\/2,607/)
const [tag] = rankArmyGunfighters(catalog, { sectorialId: 604, combatGroups: [{ members: [{
  unitId: 785, groupId: 1, optionId: 2, combinedId: '604-785-1-2-1',
}] }] }, { rankings })
assert.equal(tag.normal, 49.06, 'the unlinked Overdron remains the top global gunfighter')
assert.equal(tag.fireteamLinked, null, 'a TAG cannot receive or be ranked with Fireteam +1SD')
console.log('PASS - gunfighter cards show state-specific faction and global ranks from scored, selectable Army profiles.')
