import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const armyListApi = readFileSync('backend/ArmyListApi.gs', 'utf8')
const playersApi = readFileSync('backend/PlayersApi.gs', 'utf8')
const rebuildCoordinator = readFileSync('backend/rebuildGameEngine().gs', 'utf8')

const getPlayerArmyListsSource = extractFunction(armyListApi, 'getPlayerArmyLists')

const checks = [
  ['Player Army Lists use the persisted read-model reader', getPlayerArmyListsSource.includes('readArmyListsReadModelPayload()')],
  ['Player Army Lists do not reconstruct global Army Lists', !getPlayerArmyListsSource.includes('getArmyListObjects()') && !getPlayerArmyListsSource.includes('getCanonicalGameSubmittedArmyListObjects')],
  ['Player Army Lists do not read canonical Form Responses', !getPlayerArmyListsSource.includes('getCanonicalArmyListRecentGames') && !getPlayerArmyListsSource.includes('CONFIG.SHEETS.FORM')],
  ['Player Army Lists do not invoke the decoder', !getPlayerArmyListsSource.includes('CanonicalDecoderGateway') && !getPlayerArmyListsSource.includes('resolveArmyCodeProfiles')],
  ['Player Profile keeps Army Lists embedded in both canonical and historical responses', count(playersApi, 'getPlayerArmyLists(') === 2],
  ['Army Lists read model remains rebuilt by the canonical Game Engine coordinator', rebuildCoordinator.includes('rebuildArmyListsReadModel()')],
]

const fixtureLists = [
  buildList('2838083873', 'Lobo', 'ALEPH', 'Operations Subsection', 'decoded', 300, 6, 10),
  buildList('2838083873', 'Lobo', 'ALEPH', 'Operations Subsection', 'decoded', 300, 6, 10),
  buildList('9000000001', 'Lobo', 'PanOceania', 'Kestrel Colonial Force', 'pending', 0, 0, 0),
  buildList('3858360368', 'Erichagz', 'PanOceania', 'PanOceania', 'decoded', 300, 5.5, 14),
  buildList('4304763863', 'KaktusGalaxus', 'Ariadna', 'Tartary Army Corps', 'failed', 0, 0, 0),
  { ...buildList('1111111111', 'Lobo', 'ALEPH', 'Operations Subsection', 'decoded', 300, 6, 10), approved: false },
]

const sandbox = {
  Array,
  buildPlayerArmyListSummary: (lists) => ({
    favoriteFaction: lists[0]?.faction ?? '',
    submitted: lists.length,
  }),
  getArmyListString: (value) => String(value ?? '').trim(),
  readArmyListsReadModelPayload: () => ({ success: true, lists: fixtureLists }),
}

vm.createContext(sandbox)
vm.runInContext(getPlayerArmyListsSource, sandbox)

const lobo = sandbox.getPlayerArmyLists('lObO')
const erichagz = sandbox.getPlayerArmyLists('Erichagz')
const historical = sandbox.getPlayerArmyLists('KaktusGalaxus')
const zeroGame = sandbox.getPlayerArmyLists('Cobraprime')

checks.push(
  ['Canonical Handle matching is case-insensitive and Display Name independent', lobo.lists.length === 3],
  ['Existing canonical IDs and repeated-ID semantics are preserved', lobo.lists[0].id === '2838083873' && lobo.lists[1].id === '2838083873'],
  ['Faction, sectorial, points, SWC, and unit count remain unchanged', deepEqual(lobo.lists[0], fixtureLists[0])],
  ['Pending list semantics remain unchanged', lobo.lists[2].validation.status === 'pending' && lobo.lists[2].validation.points === 0],
  ['Canonical Player lists remain exact', deepEqual(erichagz.lists, [fixtureLists[3]])],
  ['Historical game-proven Player lists remain exact', deepEqual(historical.lists, [fixtureLists[4]]) && historical.lists[0].validation.status === 'failed'],
  ['Zero-game canonical Player remains empty', zeroGame.lists.length === 0 && zeroGame.summary.submitted === 0],
  ['Unapproved records remain excluded', !lobo.lists.some((list) => list.id === '1111111111')],
)

const unavailableSandbox = {
  Array,
  buildPlayerArmyListSummary: (lists) => ({ submitted: lists.length }),
  getArmyListString: (value) => String(value ?? '').trim(),
  readArmyListsReadModelPayload: () => null,
}

vm.createContext(unavailableSandbox)
vm.runInContext(getPlayerArmyListsSource, unavailableSandbox)

checks.push([
  'Missing read model degrades like the public Army Lists API without reconstruction fallback',
  unavailableSandbox.getPlayerArmyLists('Lobo').lists.length === 0,
])

let failed = false

for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  failed ||= !pass
}

if (failed) {
  process.exitCode = 1
}

function buildList(id, player, faction, sectorial, status, points, swc, unitCount) {
  return {
    approved: true,
    armyCode: `code-${id}`,
    armyName: `${sectorial} list`,
    faction,
    id,
    player,
    sectorial,
    source: 'Game submission',
    sourceGameId: '62',
    submissionDate: '2026-08-21',
    validation: { points, status, swc, unitCount },
  }
}

function count(source, needle) {
  return source.split(needle).length - 1
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)
  const next = source.indexOf('\nfunction ', start + 1)
  return next === -1 ? source.slice(start) : source.slice(start, next)
}
