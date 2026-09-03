import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync('backend/ArmyListApi.gs', 'utf8')
const selected = [
  'getCanonicalGameSubmittedArmyListObjects',
  'appendCanonicalGameSubmittedArmyList',
  'getPersistedCanonicalArmyListDecode',
  'buildCanonicalGameSubmittedArmyListDescription',
  'buildCanonicalGameSubmittedArmyListValidation',
].map((name) => extractFunction(source, name)).join('\n')

const games = [{
  date: '2026-09-03',
  eventId: 'event-current-league',
  gameType: 'League',
  id: 80,
  loser: 'ADangerousFrog',
  loserArmyCode: 'loser-code',
  loserArmyListId: '222',
  loserFaction: 'Ariadna',
  mission: 'Supplies',
  sourceIndex: 80,
  winner: 'Lobo',
  winnerArmyCode: 'winner-code',
  winnerArmyListId: '111',
  winnerFaction: 'ALEPH',
}]

let lookupReads = 0
const lookup = {
  byArmyCodeHash: {},
  byArmyListId: {},
}

const winnerSnapshot = buildSnapshot({
  armyCode: 'winner-code',
  armyListId: '111',
  armyName: 'Operations Subsection Strike Team',
  combatGroups: 2,
  faction: 'ALEPH',
  points: 300,
  sectorial: 'Operations Subsection of the S.S.S.',
  swc: 6,
  units: 10,
  warnings: [{ message: 'Persisted warning' }],
})
lookup.byArmyListId['111'] = winnerSnapshot
lookup.byArmyCodeHash[hash('winner-code')] = winnerSnapshot

const sandbox = {
  Array,
  Boolean,
  CanonicalDecoderGateway: { decode() { throw new Error('legacy decoder reached') } },
  CanonicalArmyCodeResolver: {
    resolveSubmittedArmyList({ game, side }) {
      return {
        armyCode: side === 'winner' ? game.winnerArmyCode : game.loserArmyCode,
        armyListId: side === 'winner' ? game.winnerArmyListId : game.loserArmyListId,
        id: side === 'winner' ? game.winnerArmyListId : game.loserArmyListId,
      }
    },
  },
  getArmyIntelligenceHash: hash,
  getArmyListNumber: Number,
  getArmyListString: (value) => String(value ?? '').trim(),
  formatArmyListDate: (value) => String(value ?? ''),
  getCanonicalArmyListRecentGames: () => games,
  getPersistedArmyIntelligenceSnapshotLookup: () => {
    lookupReads += 1
    return lookup
  },
  getPlayerDisplayName: (player) => `Display ${player}`,
  canonicalizeArmyName: (value) => String(value ?? '').trim(),
  canonicalizeArmyParentFaction: (value) => String(value ?? '').trim(),
  resolveArmyCodeProfiles() { throw new Error('profile resolver reached') },
  UrlFetchApp: { fetch() { throw new Error('UrlFetch reached') } },
}

vm.createContext(sandbox)
vm.runInContext(selected, sandbox)

const lists = sandbox.getCanonicalGameSubmittedArmyListObjects()
assert.equal(lookupReads, 1, 'persisted lookup must be loaded once for the complete set')
assert.equal(lists.length, 2)

const winner = lists.find((list) => list.id === '111')
const loser = lists.find((list) => list.id === '222')
assert.ok(winner)
assert.ok(loser)
assert.deepEqual(JSON.parse(JSON.stringify(winner.validation)), {
  armyName: 'Operations Subsection Strike Team',
  combatGroups: 2,
  faction: 'ALEPH',
  override: false,
  overrideBy: '',
  overrideReason: '',
  points: 300,
  sectorial: 'Operations Subsection of the S.S.S.',
  severity: 'Info',
  status: 'decoded',
  swc: 6,
  timestamp: '',
  unitCount: 10,
  warnings: ['Persisted warning'],
})
assert.equal(winner.armyName, 'Operations Subsection Strike Team')
assert.equal(winner.faction, 'ALEPH')
assert.equal(winner.sectorial, 'Operations Subsection of the S.S.S.')
assert.equal(winner.player, 'Lobo')
assert.equal(winner.mission, 'Supplies')
assert.equal(winner.event, 'event-current-league')
assert.equal(winner.sourceGameId, '80')
assert.equal(winner.armyCode, 'winner-code')
assert.equal(winner.id, '111', 'deterministic Army List identity must remain unchanged')
assert.equal('decoded' in winner, false)
assert.equal('profiles' in winner, false)
assert.equal('roster' in winner, false)
assert.equal('units' in winner, false)

assert.equal(loser.id, '222')
assert.equal(loser.player, 'ADangerousFrog')
assert.equal(loser.faction, 'Ariadna')
assert.equal(loser.sectorial, 'Ariadna')
assert.equal(loser.armyName, 'Ariadna Army List')
assert.equal(loser.validation.status, 'pending')
assert.equal(loser.validation.severity, 'Warning')
assert.equal(loser.validation.points, 0)
assert.equal(loser.validation.unitCount, 0)

const wrongId = buildSnapshot({ armyCode: 'winner-code', armyListId: '999' })
assert.equal(
  sandbox.getPersistedCanonicalArmyListDecode('111', 'winner-code', {
    byArmyCodeHash: { [hash('winner-code')]: wrongId },
    byArmyListId: { 111: wrongId },
  }),
  null,
  'wrong Army List ID must be rejected',
)

const wrongHash = buildSnapshot({ armyCode: 'older-code', armyListId: '111' })
assert.equal(
  sandbox.getPersistedCanonicalArmyListDecode('111', 'winner-code', {
    byArmyCodeHash: { [hash('winner-code')]: wrongHash },
    byArmyListId: { 111: wrongHash },
  }),
  null,
  'wrong Army Code hash must be rejected',
)

assert.equal(
  sandbox.getPersistedCanonicalArmyListDecode('111', 'winner-code', {
    byArmyCodeHash: {},
    byArmyListId: {},
  }),
  null,
  'missing enrichment must remain pending',
)

const invalid = buildSnapshot({ armyCode: 'winner-code', armyListId: '111' })
invalid.status = 'failed'
invalid.decoded = null
assert.equal(
  sandbox.getPersistedCanonicalArmyListDecode('111', 'winner-code', {
    byArmyCodeHash: { [hash('winner-code')]: invalid },
    byArmyListId: { 111: invalid },
  }),
  null,
  'invalid enrichment must remain pending',
)

assert.doesNotMatch(
  extractFunction(source, 'appendCanonicalGameSubmittedArmyList'),
  /CanonicalDecoderGateway|resolveArmyCodeProfiles|UrlFetchApp/,
)

console.log('Army List persisted enrichment regression passed.')
console.log('PASS - complete canonical construction made zero legacy decoder and UrlFetch calls')

function buildSnapshot({
  armyCode,
  armyListId,
  armyName = 'Fixture Army',
  combatGroups = 1,
  faction = 'ALEPH',
  points = 300,
  sectorial = 'ALEPH',
  swc = 6,
  units = 10,
  warnings = [],
}) {
  const entries = Array.from({ length: units }, (_, index) => ({ profile: `Unit ${index + 1}` }))
  return {
    armyCodeHash: hash(armyCode),
    armyListId,
    decoded: {
      armyCode,
      combatGroups: [
        { combatGroup: 1, entries },
        ...Array.from({ length: Math.max(0, combatGroups - 1) }, (_, index) => ({
          combatGroup: index + 2,
          entries: [],
        })),
      ],
      faction,
      listName: armyName,
      sectorial,
      totals: { combatGroups, points, swc },
      warnings,
    },
    status: 'decoded',
  }
}

function hash(value) {
  return `hash:${String(value ?? '').trim()}`
}

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}`)
  assert.notEqual(start, -1, `missing function ${name}`)
  const open = text.indexOf('{', start)
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = open; index < text.length; index += 1) {
    const character = text[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }
    if (character === '{') depth += 1
    if (character === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  throw new Error(`unterminated function ${name}`)
}
