import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = (path) => readFileSync(path, 'utf8')
const registry = read('backend/PlayerRegistry.gs')
const router = read('backend/API.gs')
const page = read('src/pages/CommissionerPlayers.tsx')
const api = read('src/services/api.ts')

const handler = extractFunction(registry, 'setCanonicalPlayerDisplayName')
let delegated = null
const sandbox = {
  getApiParameters: () => ({
    displayName: 'New Display',
    playerName: 'CanonicalHandle',
  }),
  getPlayerRegistryString: (value) => String(value ?? '').trim(),
  jsonOutput: (value) => value,
  setLeaguePlayerDisplayName: (playerName, displayName) => {
    delegated = { displayName, playerName }
    return { displayName, player: playerName, success: true }
  },
}
vm.createContext(sandbox)
vm.runInContext(handler, sandbox)
const result = sandbox.setCanonicalPlayerDisplayName({})

const checks = [
  ['API handler delegates canonical handle and Display Name separately', result.success === true && delegated?.playerName === 'CanonicalHandle' && delegated?.displayName === 'New Display'],
  ['Existing canonical mutation remains the only sheet writer', handler.includes('setLeaguePlayerDisplayName') && !handler.includes('.setValue(')],
  ['Commissioner permission protects the action', router.includes('case "setCanonicalPlayerDisplayName"') && router.includes('requireApiPermission(e, "runSeasonControl"')],
  ['Existing mutation invalidates Player Registry', registry.includes('function setLeaguePlayerDisplayName') && registry.includes('invalidatePlayerRegistryCache()')],
  ['Existing mutation invalidates portal API caches', registry.includes('invalidatePortalCacheGroup("all")')],
  ['Frontend sends canonical handle separately', api.includes("'setCanonicalPlayerDisplayName'") && api.includes('{ playerName, displayName }')],
  ['Edit Display Name control is present', page.includes('Edit Display Name')],
  ['Current Display Name is prepopulated', page.includes('setDisplayName(selectedPlayerRecord.displayName)')],
  ['Save and Cancel controls are present', page.includes("'Saving...' : 'Save'") && page.includes('Cancel')],
  ['Cancel performs no API mutation', extractFunction(page, 'cancelDisplayNameEdit').includes("setDisplayName('')") && !extractFunction(page, 'cancelDisplayNameEdit').includes('apiClient')],
  ['Delete Player remains unchanged', page.includes('Delete Player') && page.includes('deleteCanonicalPlayer')],
]

let failed = false
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  failed ||= !pass
}
if (failed) process.exitCode = 1

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`Missing function ${name}`)
  const brace = source.indexOf('{', start)
  let depth = 0
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  throw new Error(`Unclosed function ${name}`)
}
