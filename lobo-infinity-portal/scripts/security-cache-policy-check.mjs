import { readFileSync } from 'node:fs'

const api = readFileSync('backend/API.gs', 'utf8')
const audit = readFileSync('scripts/security-cache-audit.mjs', 'utf8')
const deletion = readFileSync('backend/PlayerDeletionApi.gs', 'utf8')
const registry = readFileSync('backend/PlayerRegistry.gs', 'utf8')
const scoreCorrection = readFileSync('backend/GameScoreCorrectionApi.gs', 'utf8')
const teamTournament = readFileSync('backend/TeamTournamentApi.gs', 'utf8')
const operations = readFileSync('backend/OperationsApi.gs', 'utf8')
const failures = []

for (const [action, authRequired, userScoped] of [
  ['deleteCanonicalPlayer', true, false],
  ['repairHistoricalArmyCodes', true, false],
  ['setCanonicalPlayerDisplayName', true, false],
  ['teamTournamentDiagnostic', true, false],
  ['version', false, false],
]) {
  const expected = new RegExp(
    `${action}: \\{ authRequired: ${authRequired}, userScoped: ${userScoped} \\}`,
  )
  assert(expected.test(audit), `${action} must have its exact endpoint policy.`)
  assert(
    !caseBlocks(api, action).some((block) => block.includes('getCachedApiResponse(')),
    `${action} must remain outside the shared response cache.`,
  )
}

assert(
  /case "deleteCanonicalPlayer":[\s\S]*?requireApiPermission\(e, "runSeasonControl"/.test(api) &&
    /function deleteCanonicalPlayer\(e\)/.test(deletion),
  'Delete Player must retain its Commissioner guard and canonical owner.',
)
assert(
  /case "setCanonicalPlayerDisplayName":[\s\S]*?requireApiPermission\(e, "runSeasonControl"/.test(api) &&
    /function setCanonicalPlayerDisplayName\(e\)/.test(registry),
  'Display Name mutation must retain its Commissioner guard and canonical owner.',
)
assert(
  /case "repairHistoricalArmyCodes":[\s\S]*?requireApiPermission\(e, "dataCorrections"/.test(api) &&
    /function repairHistoricalArmyCodes\(e, auth\)/.test(scoreCorrection),
  'Historical Army Code repair must retain dataCorrections authorization.',
)
assert(
  /function getTeamTournamentDiagnostic\(e\)[\s\S]*?requireApiPermission\([\s\S]*?"runSeasonControl"/.test(
    teamTournament,
  ),
  'Team Tournament diagnostics must remain Commissioner protected.',
)
assert(
  /case "version":[\s\S]*?return getPortalVersion\(e\)/.test(api) &&
    /function getPortalVersion\(e\)[\s\S]*?success: true[\s\S]*?deploymentFingerprint/.test(
      operations,
    ),
  'Version must remain a public read-only deployment metadata endpoint.',
)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('security/cache endpoint policy checks passed')

function caseBlocks(source, action) {
  const matches = [...source.matchAll(/case\s+"([^"]+)":/g)]
  return matches
    .map((match, index) => ({
      action: match[1],
      block: source.slice(
        match.index,
        matches[index + 1]?.index ?? source.indexOf('default:', match.index),
      ),
    }))
    .filter((entry) => entry.action === action)
    .map((entry) => entry.block)
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}
