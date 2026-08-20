import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const playersApi = readFileSync('backend/PlayersApi.gs', 'utf8')
const commissionerPlayers = readFileSync('src/pages/CommissionerPlayers.tsx', 'utf8')
const deletionApi = readFileSync('backend/PlayerDeletionApi.gs', 'utf8')

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`Missing function ${name}`)
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error(`Unterminated function ${name}`)
}

const builder = extractFunction(playersApi, 'buildCommunityPlayerRegistryRows')
const applyStatistics = extractFunction(playersApi, 'applyCommunityGameStatistics')
const upsert = extractFunction(playersApi, 'upsertCommunityPlayerRecord')
const finalize = extractFunction(playersApi, 'finalizeCommunityPlayerRecord')

const gameRows = [
  ['', '2026-08-02', 'Mission', 'Kiratze', 'Opponent', 'L', 0, 2, 67, 'Army', '', '', 'casual'],
  ['', '2026-07-30', 'Mission', 'KharuS', 'Opponent', 'L', 0, 2, 135, 'Army', '', '', 'casual'],
  ['', '2026-07-27', 'Mission', 'Fantasy', 'Opponent', 'W', 5, 8, 200, 'Army', '', '', 'casual'],
  ['', '2026-07-26', 'Mission', 'Fantasy', 'Opponent', 'L', 1, 5, 131, 'Army', '', '', 'casual'],
  ['', '2026-08-01', 'Mission', 'Canonical Gamer', 'Opponent', 'W', 5, 10, 250, 'Army', '', '', 'league'],
  ['', '2026-08-01', 'Mission', 'Game Without User', 'Opponent', 'W', 5, 10, 250, 'Army', '', '', 'casual'],
]
const sandbox = {
  CONFIG: { ENGINE: { DATE: 1, MISSION: 2, PLAYER: 3, RESULT: 5, TP: 6, OP: 7, VP: 8, FACTION: 9, GAME_TYPE: 12 } },
  canonicalizeArmyName: (value) => String(value || ''),
  getCommunityCurrentWinStreak: () => 0,
  getCommunityDateValue: (value) => value,
  getCommunityDivisionLabel: (value) => value || '',
  getCommunityMostPlayedArmy: () => '',
  getCommunityMostRecentDate: () => '',
  getCommunityPlayerKey: (value) => String(value || '').trim().toLowerCase(),
  getCommunityPlayerRegistryString: (value) => String(value || '').trim(),
  getCommunityStatusBadges: () => [],
  getGameEngineRowGameType: (row) => row[12],
  getLeagueDataForEvent: () => gameRows,
}
vm.createContext(sandbox)
vm.runInContext(`${upsert}\n${applyStatistics}\n${finalize}`, sandbox)

const records = {}
sandbox.upsertCommunityPlayerRecord(records, {
  player: 'Canonical Zero', displayName: 'Canonical Zero Display', canonical: true, source: 'Player Registry',
})
sandbox.upsertCommunityPlayerRecord(records, {
  player: 'Canonical Gamer', displayName: 'Canonical Gamer Display', canonical: true, source: 'Player Registry',
})
sandbox.applyCommunityGameStatistics(records)
const population = Object.values(records).map(sandbox.finalizeCommunityPlayerRecord)
const byName = Object.fromEntries(population.map((player) => [player.player, player]))
const checks = [
  ['Canonical registry seeds the public directory', builder.includes('buildPlayerRegistry()')],
  ['Legacy Users do not seed the public directory', !builder.includes('getCommunityPortalUsers')],
  ['Canonical zero-game Player is included', byName['Canonical Zero']?.games === 0 && byName['Canonical Zero']?.canonical === true],
  ['Canonical Player with games is included once', population.filter((player) => player.player === 'Canonical Gamer').length === 1 && byName['Canonical Gamer']?.games === 1],
  ['Canonical display metadata wins over game identity', byName['Canonical Gamer']?.displayName === 'Canonical Gamer Display'],
  ['Historical Casual Players are restored from authoritative games', ['Kiratze', 'KharuS', 'Fantasy'].every((name) => byName[name]?.games > 0 && byName[name]?.canonical === false)],
  ['Historical statistics are preserved', byName.Fantasy?.games === 2 && byName.Fantasy?.wins === 1 && byName.Fantasy?.losses === 1 && byName.Fantasy?.vp === 331],
  ['Game-only identity needs no Users record', byName['Game Without User']?.games === 1],
  ['Users-only Steven Butt remains excluded', !byName['Steven Butt']],
  ['Canonical records are keyed once', builder.includes('Object.keys(registry)') && builder.includes('upsertCommunityPlayerRecord')],
  ['Event participation only enriches canonical records', builder.includes('applyCommunityParticipantStatus')],
  ['Game statistics only enrich canonical records', builder.includes('applyCommunityGameStatistics')],
  ['Commissioner selections use the canonical player field', commissionerPlayers.includes('value={player.player}')],
  ['Commissioner mutations are disabled for historical identities', commissionerPlayers.includes('!selectedPlayerRecord?.canonical')],
  ['Edit Display Name sends the selected canonical record', commissionerPlayers.includes('selectedPlayerRecord.player')],
  ['Delete Player sends the selected canonical handle', commissionerPlayers.includes('deleteCanonicalPlayer(selectedPlayer)')],
  ['Guarded deletion still looks up Players.Player only', deletionApi.includes('["Player"]')],
]

let failed = false
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}`)
  failed ||= !passed
}

if (failed) process.exitCode = 1
