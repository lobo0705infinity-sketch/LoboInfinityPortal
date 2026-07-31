import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = read('src/pages/ArmyLists.tsx')
const factionProfile = read('src/pages/FactionProfile.tsx')
const playerProfile = read('src/pages/PlayerProfile.tsx')
const api = read('src/services/api.ts')
const infinityArmyLinks = read('src/services/infinityArmyLinks.ts')

assert.match(
  page,
  /getSubmittedArmyListLibrary/,
  'Army Lists page must use the submitted-game army list library API.',
)
assert.doesNotMatch(
  page,
  /setState\(\{[\s\S]*lists:\s*data\.lists[\s\S]*status:\s*'success'/,
  'Army Lists page must not use the old approved-list vault endpoint as the library source.',
)
assert.match(
  page,
  /resolvePlayerFactionIdentity/,
  'Army List cards must use the shared faction identity resolver.',
)
assert.match(
  page,
  /<OperatorBadge/,
  'Army List cards must use the existing Operator Badge presentation.',
)
assert.match(
  page,
  /View in Infinity Army/,
  'Army List cards must expose View in Infinity Army.',
)
assert.match(
  page,
  /View Battle Report/,
  'Army List cards must expose View Battle Report.',
)
assert.match(
  page,
  /getInfinityArmyTarget\(armyCode\)/,
  'Army List cards must use the shared Infinity Army target resolver.',
)
assert.match(
  page,
  /target="_blank"/,
  'View in Infinity Army must open in a new tab.',
)
assert.doesNotMatch(
  page,
  /to=\{target\.href\}>View in Infinity Army|\/army-list\/\$\{encodeURIComponent/,
  'View in Infinity Army must not route through the portal army-list redirect.',
)
assert.match(
  page,
  /className=\{`army-list-unavailable-link is-\$\{target\.status\}`\}/,
  'Missing or invalid Army Codes must render a disabled unavailable control.',
)
assert.match(
  infinityArmyLinks,
  /Army Code unavailable\./,
  'Unavailable Army Codes must explain why the button is disabled.',
)
assert.match(
  infinityArmyLinks,
  /https:\/\/infinitytheuniverse\.com\/army\/list\//,
  'Raw Army Codes must open the official Infinity Army list URL.',
)
assert.match(
  infinityArmyLinks,
  /encodeURIComponent\(decodeURIComponent\(value\)\)/,
  'Army Code URL generation must preserve existing encoded payloads without double-encoding.',
)
assert.match(
  infinityArmyLinks,
  /status: 'missing'/,
  'Missing Army Codes must produce a disabled state.',
)
assert.match(
  infinityArmyLinks,
  /status: 'invalid'/,
  'Invalid Army Codes must produce an error state.',
)
assert.match(
  playerProfile,
  /getInfinityArmyTarget\(list\.armyCode \|\| list\.armyLink\)/,
  'Public Player Profile Army List mini-cards must use the shared Infinity Army resolver.',
)
assert.match(
  factionProfile,
  /getInfinityArmyTarget\(list\.armyCode \|\| list\.armyLink\)/,
  'Faction Profile Army List mini-cards must use the shared Infinity Army resolver.',
)
assert.doesNotMatch(
  page,
  /\b(points|swc|lieutenant|hacker|specialist)\b/i,
  'Army List Library must not display decoded list statistics.',
)

assert.match(
  api,
  /export type SubmittedArmyListEntry/,
  'API layer must expose a read-only submitted army list entry model.',
)
assert.match(
  api,
  /getRecentGames\(options\)/,
  'Submitted army list library must derive from recent-game data.',
)
assert.match(
  api,
  /gameType: 'casual'/,
  'Submitted army list library must include casual games from recentGames&gameType=casual.',
)
assert.match(
  api,
  /gameType: 'tournament'/,
  'Submitted army list library must include tournament games from recentGames&gameType=tournament.',
)
assert.match(
  api,
  /getEvents\(options\)/,
  'Submitted army list library must resolve event names from existing events data.',
)
assert.match(
  api,
  /dedupeSubmittedArmyListEntries/,
  'Submitted army list library must dedupe combined game feeds.',
)
assert.match(
  api,
  /getSubmittedArmyCodeHash/,
  'Submitted army list library must dedupe by army-code hash.',
)
assert.match(
  api,
  /game\.winnerArmyCode[\s\S]*game\.loserArmyCode/,
  'Submitted army list library must create one candidate entry per game participant.',
)
assert.match(
  api,
  /\.filter\(\(entry\): entry is Omit<SubmittedArmyListEntry, 'eventName'>/,
  'Submitted army list library must drop participants without submitted army codes.',
)
assert.match(
  api,
  /formatSubmittedArmyListGameType/,
  'Submitted army list library must normalize League, Casual, and Tournament labels.',
)

console.log('Army List Library checks passed.')

function read(path) {
  return readFileSync(path, 'utf8')
}
