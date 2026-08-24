import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = (path) => readFileSync(path, 'utf8')
const constants = read('backend/Constants.gs')
const form = read('backend/JoinCommunityForm.gs')
const importer = read('backend/ResponseImporter.gs')
const registry = read('backend/PlayerRegistry.gs')
const installer = read('backend/Installer.gs')
const players = read('src/pages/Players.tsx')
const sidebar = read('src/components/Sidebar.tsx')
const mobileNavigation = read('src/pages/MobileMenu.tsx')
const sidebarNavigation = read('src/components/sidebarNavigation.ts')

const checks = [
  ['Join form has one required Handle field', form.includes('LIF_FORMS.FIELDS.PLAYER_HANDLE') && form.includes('setCollectEmail(false)') && !form.includes('Discord Name') && !form.includes('Real Name')],
  ['Join submissions route through the existing Forms trigger', importer.includes('LIF_FORMS.TYPES.JOIN') && importer.includes('lifImportCommunityPlayer_')],
  ['Canonical Players schema is used', registry.includes('function createCanonicalPlayer') && registry.includes('row[columns.player] = handle') && registry.includes('row[columns.active] = true')],
  ['Duplicate Handles use canonical case-insensitive semantics', registry.includes('handle.toLowerCase()') && registry.includes('duplicate: true')],
  ['Player caches are invalidated', registry.includes('invalidatePlayerRegistryCache()') && registry.includes('invalidatePortalCacheGroup("all")')],
  ['No Users or authentication record is created', !form.includes('ensureUsersSheet') && !importer.includes('createUserRow') && !registry.includes('ensureUsersSheet')],
  ['Existing form IDs remain configured', constants.includes('LEAGUE_FORM_ID') && constants.includes('TEAM_FORM_ID') && constants.includes('CASUAL_FORM_ID')],
  ['Installer is additive and idempotent', installer.includes('function installJoinCommunityForm()') && installer.includes('RESPONSE_SPREADSHEET_ID')],
  ['Public navigation opens configured Join form safely', sidebarNavigation.includes('Join the Lobo Game Network') && sidebarNavigation.includes('external: true') && sidebar.includes('settings?.joinCommunityFormUrl') && mobileNavigation.includes('settings?.joinCommunityFormUrl') && !players.includes('Join Community')],
]

const joinFormFunctions = [
  'lifGetJoinCommunityFormForInstallation_',
  'lifEnsureJoinCommunityFormDestination_',
].map((name) => extractFunction(form, name)).join('\n')

function runJoinFormScenario({ destinationId = null, propertyId = '', recoverableForm = null }) {
  const propertyValues = { join: propertyId }
  let created = 0
  let linked = 0
  const makeForm = (id, initialDestination) => ({
    destinationId: initialDestination,
    getDestinationId() {
      if (!this.destinationId) throw new Error('Exception: The form currently has no response destination.')
      return this.destinationId
    },
    getId: () => id,
  })
  const storedForm = propertyId ? makeForm(propertyId, destinationId) : null
  const discoveredForm = recoverableForm ? makeForm(recoverableForm.id, recoverableForm.destinationId) : null
  const formsById = {}
  if (storedForm) formsById[storedForm.getId()] = storedForm
  if (discoveredForm) formsById[discoveredForm.getId()] = discoveredForm
  const iterator = {
    consumed: false,
    hasNext() { return Boolean(discoveredForm) && !this.consumed },
    next() {
      this.consumed = true
      return { getId: () => discoveredForm.getId(), getMimeType: () => 'google-form' }
    },
  }
  const formSandbox = {
    DriveApp: { getFilesByName: () => iterator },
    FormApp: {
      create: () => {
        created += 1
        const createdForm = makeForm('created-form', null)
        formsById[createdForm.getId()] = createdForm
        return createdForm
      },
      openById: (id) => formsById[id],
    },
    LIF_FORMS: { FORM_TITLES: { JOIN: 'Join the Lobo Infinity Community' }, PROPERTIES: { JOIN_FORM_ID: 'join' } },
    MimeType: { GOOGLE_FORMS: 'google-form' },
    lifGetProperties_: () => ({
      getProperty: (key) => propertyValues[key] || '',
      setProperty: (key, value) => { propertyValues[key] = value },
    }),
    lifLinkForm_: (targetForm, targetSpreadsheetId) => {
      linked += 1
      targetForm.destinationId = targetSpreadsheetId
      return targetForm
    },
  }
  vm.createContext(formSandbox)
  vm.runInContext(joinFormFunctions, formSandbox)
  const selected = formSandbox.lifGetJoinCommunityFormForInstallation_()
  formSandbox.lifEnsureJoinCommunityFormDestination_(selected, 'existing-response-spreadsheet')
  const rerun = formSandbox.lifGetJoinCommunityFormForInstallation_()
  formSandbox.lifEnsureJoinCommunityFormDestination_(rerun, 'existing-response-spreadsheet')
  return { created, linked, propertyId: propertyValues.join, sameForm: selected === rerun }
}

const freshFormScenario = runJoinFormScenario({})
const recoveredFormScenario = runJoinFormScenario({ recoverableForm: { id: 'partial-form', destinationId: null } })
const linkedFormScenario = runJoinFormScenario({ destinationId: 'existing-response-spreadsheet', propertyId: 'known-form' })
checks.push(
  ['Fresh Form without destination links to existing response spreadsheet', freshFormScenario.created === 1 && freshFormScenario.linked === 1],
  ['Partially created unlinked Form is recovered and linked', recoveredFormScenario.created === 0 && recoveredFormScenario.linked === 1 && recoveredFormScenario.propertyId === 'partial-form'],
  ['Correctly linked existing Form destination remains unchanged', linkedFormScenario.created === 0 && linkedFormScenario.linked === 0],
  ['Installer rerun reuses the same Join Form', freshFormScenario.sameForm && freshFormScenario.created === 1],
)

const rows = [
  ['Player', 'Display Name', 'Division', 'Active'],
]
let registryInvalidations = 0
let portalInvalidations = 0
const sheet = {
  appendRow(row) { rows.push(row.slice()) },
  getDataRange() { return { getValues: () => rows.map((row) => row.slice()) } },
  getLastColumn() { return 4 },
  getLastRow() { return rows.length },
}
const sandbox = {
  Array,
  CONFIG: { SHEETS: { PLAYERS: 'Players' } },
  ensurePlayerDisplayNameColumn: () => ({ player: 0, displayName: 1, division: 2, active: 3 }),
  getPlayerRegistryString: (value) => String(value ?? '').trim(),
  invalidatePlayerRegistryCache: () => { registryInvalidations += 1 },
  invalidatePortalCacheGroup: (group) => { if (group === 'all') portalInvalidations += 1 },
  lifGetTargetSpreadsheet_: () => ({ getSheetByName: () => sheet }),
}
vm.createContext(sandbox)
vm.runInContext(extractFunction(registry, 'createCanonicalPlayer'), sandbox)
const first = sandbox.createCanonicalPlayer('  NewWolf  ')
const duplicate = sandbox.createCanonicalPlayer('newwolf')
checks.push(
  ['Valid Handle creates exactly one active canonical Player', first.success === true && rows.length === 2 && rows[1][0] === 'NewWolf' && rows[1][1] === 'NewWolf' && rows[1][3] === true],
  ['Duplicate Handle creates no second Player and overwrites nothing', duplicate.duplicate === true && rows.length === 2 && rows[1][0] === 'NewWolf'],
  ['Successful creation invalidates canonical read models', registryInvalidations === 1 && portalInvalidations === 1],
)

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
