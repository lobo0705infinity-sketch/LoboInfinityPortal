import assert from 'node:assert/strict'
import { resolveMissionGeistNavigation as resolve } from '../src/config/missionGeistNavigation.ts'

const record = (id, name) => ({ id, name, canonicalUrl: 'https://infinitygeist.com/mission/' + id, rights: {}, sourceCollectionId: 'community', sourceCollectionName: 'Community', current: false })
const dead = record('cm_lobo_dead_mans_switch', "Dead Man's Switch — by Lobo")
assert.deepEqual(resolve({mission: "Dead Man's Switch"}, [dead]), {kind: 'unique', records: [dead]})
assert.equal(resolve({mission: 'Dead Man’s Switch'}, [dead]).records[0].id, dead.id)
assert.equal(resolve({mission: "Dead Man's Switch"}, []).kind, 'unmatched')
assert.equal(resolve({mission: 'Unlisted Mission'}, [dead]).kind, 'unmatched')
const seasons = [record('s17_neutralization', 'Neutralization'), record('s18_neutralization', 'Neutralization')]
assert.equal(resolve({mission: 'Neutralization'}, seasons).kind, 'ambiguous')
assert.deepEqual(resolve({mission: 'Neutralization', missionGeistId: seasons[1].id, missionGeistCanonicalUrl: seasons[1].canonicalUrl}, seasons), {kind: 'exact', records: [seasons[1]]})
assert.equal(resolve({mission: "Dead Man's Switch", missionGeistId: 'bad', missionGeistCanonicalUrl: dead.canonicalUrl}, [dead]).kind, 'unmatched')
assert.equal(resolve({mission: "Dead Man's Switch", missionGeistId: dead.id, missionGeistCanonicalUrl: 'https://infinitygeist.com/mission/wrong'}, [dead]).kind, 'unmatched')
console.log('PASS: author-credit alias, apostrophes, missing catalog entry, version ambiguity, and explicit identity checks')
