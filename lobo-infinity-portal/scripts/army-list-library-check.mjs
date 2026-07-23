import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = read('src/pages/ArmyLists.tsx')
const api = read('src/services/api.ts')

assert.match(
  page,
  /getSubmittedArmyListLibrary/,
  'Army Lists page must use the submitted-game army list library API.',
)
assert.doesNotMatch(
  page,
  /\.getArmyLists\(/,
  'Army Lists page must not use the old approved-list vault endpoint.',
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
  /\/army-list\/\$\{encodeURIComponent\(value\)\}/,
  'Raw army codes must route through the existing internal army-list route.',
)
assert.match(
  page,
  /\^https\?:\\\/\\\//,
  'Full Army URLs must remain direct external links.',
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
