import { readFileSync } from 'node:fs'

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
const checks = [
  ['Canonical registry seeds the public directory', builder.includes('buildPlayerRegistry()')],
  ['Legacy Users do not seed the public directory', !builder.includes('getCommunityPortalUsers')],
  ['Canonical records are keyed once', builder.includes('Object.keys(registry)') && builder.includes('upsertCommunityPlayerRecord')],
  ['Event participation only enriches canonical records', builder.includes('applyCommunityParticipantStatus')],
  ['Game statistics only enrich canonical records', builder.includes('applyCommunityGameStatistics')],
  ['Commissioner selections use the canonical player field', commissionerPlayers.includes('value={player.player}')],
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
