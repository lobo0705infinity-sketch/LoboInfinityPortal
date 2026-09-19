import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import vm from 'node:vm'

const backend = Object.fromEntries(
  readdirSync('backend')
    .filter((file) => file.endsWith('.gs'))
    .map((file) => [file, readFileSync(`backend/${file}`, 'utf8')]),
)
const allBackend = Object.values(backend).join('\n')

assert.doesNotMatch(allBackend, /infinity\.2nirwana\.de\/cards\/generate/i)
assert.doesNotMatch(allBackend, /CanonicalDecoderGateway\.decode\s*\(/)
assert.doesNotMatch(backend['ArmyDecoderApi.gs'], /UrlFetchApp/)
assert.doesNotMatch(extractFunction(backend['ArmyDecoderApi.gs'], 'resolveArmyCodeProfiles'), /fetch\s*\(|infinity\.2nirwana/i)

const zeroNetworkFunctions = [
  ['ArmyCodeValidationApi.gs', 'validateArmyCode'],
  ['ArmyCodeValidationApi.gs', 'auditArmyCodeSubmissions'],
  ['ArmyListApi.gs', 'submitArmyList'],
  ['ArmyListApi.gs', 'diagnoseArmyList'],
  ['ArmyListApi.gs', 'getCanonicalGameSubmittedArmyListObjects'],
  ['ArmyListApi.gs', 'rebuildArmyListsReadModelPayload'],
  ['CanonicalSubmissionService.gs', 'submitCanonicalGame'],
  ['CanonicalSubmissionService.gs', 'canonicalSubmitPortalGame_'],
  ['CanonicalSubmissionService.gs', 'canonicalSubmitPortalTeamTournamentGame_'],
  ['CanonicalRebuildCoordinator.gs', 'coordinateCanonicalRebuild'],
  ['AchievementApi.gs', 'evaluateAchievementsForAllPlayers'],
  ['AchievementApi.gs', 'buildAchievementMetrics'],
  ['TeamTournamentApi.gs', 'getTeamTournamentArmyCodeFaction'],
  ['ArmyIntelligenceApi.gs', 'buildArmyIntelligenceSources'],
  ['ArmyIntelligenceApi.gs', 'refreshArmyIntelligence'],
  ['ArmyDecoderApi.gs', 'testDecodeArmyCode'],
]

for (const [file, name] of zeroNetworkFunctions) {
  assert.doesNotMatch(
    extractFunction(backend[file], name),
    /CanonicalDecoderGateway|resolveArmyCodeProfiles|UrlFetchApp|infinity\.2nirwana/i,
    `${file}:${name} retains an external Army decoder edge`,
  )
}

let fetches = 0
const context = {
  JSON,
  Logger: { log: () => {} },
  UrlFetchApp: { fetch() { fetches += 1; throw new Error('decoder fetch reached') } },
}
vm.createContext(context)
vm.runInContext([
  extractFunction(backend['ArmyDecoderApi.gs'], 'testDecodeArmyCode'),
  extractFunction(backend['ArmyDecoderApi.gs'], 'resolveArmyCodeProfiles'),
].join('\n'), context)

const retired = context.testDecodeArmyCode()
assert.equal(retired.status, 'Retired')
const resolved = context.resolveArmyCodeProfiles('fixture')
assert.equal(resolved.roster.length, 0)
assert.match(resolved.parserWarnings[0], /retired in Apps Script/i)
assert.equal(fetches, 0)

console.log('Apps Script Army decoder zero-reachability regression passed.')
console.log('PASS - no Apps Script production path can contact infinity.2nirwana.de')

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`)
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
    if (character === '"' || character === "'" || character === '`') { quote = character; continue }
    if (character === '{') depth += 1
    if (character === '}' && --depth === 0) return text.slice(start, index + 1)
  }
  throw new Error(`unterminated function ${name}`)
}
