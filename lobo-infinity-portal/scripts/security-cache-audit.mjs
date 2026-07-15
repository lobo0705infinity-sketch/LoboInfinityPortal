import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const apiPath = path.join(root, 'backend', 'API.gs')
const source = fs.readFileSync(apiPath, 'utf8')

const endpointPolicy = {
  achievements: { authRequired: true, userScoped: true },
  approveArmyList: { authRequired: true, userScoped: false },
  armyLists: { authRequired: false, userScoped: false },
  automation: { authRequired: true, userScoped: false },
  automationEvents: { authRequired: true, userScoped: false },
  automationRules: { authRequired: true, userScoped: false },
  automationTemplates: { authRequired: true, userScoped: false },
  awardAchievement: { authRequired: true, userScoped: false },
  cacheDiagnostics: { authRequired: true, userScoped: false },
  clearAutomationQueue: { authRequired: true, userScoped: false },
  clearCache: { authRequired: true, userScoped: false },
  communityCommandCenter: { authRequired: true, userScoped: true },
  commissionerScheduling: { authRequired: true, userScoped: false },
  comparison: { authRequired: false, userScoped: false },
  createSchedulingRequest: { authRequired: true, userScoped: true },
  dashboard: { authRequired: false, userScoped: false },
  deleteAlert: { authRequired: true, userScoped: false },
  deleteNews: { authRequired: true, userScoped: false },
  deleteStream: { authRequired: true, userScoped: false },
  deleteTimelineEntry: { authRequired: true, userScoped: false },
  disableDiscordAutomation: { authRequired: true, userScoped: false },
  diagnostics: { authRequired: true, userScoped: false },
  event: { authRequired: false, userScoped: false },
  eventHome: { authRequired: false, userScoped: true },
  eventLifecycle: { authRequired: true, userScoped: false },
  eventLifecycleTransition: { authRequired: true, userScoped: false },
  eventManager: { authRequired: true, userScoped: false },
  eventManagerCurrentEvent: { authRequired: true, userScoped: false },
  eventManagerEvent: { authRequired: true, userScoped: false },
  eventManagerLifecycle: { authRequired: true, userScoped: false },
  eventManagerPairing: { authRequired: true, userScoped: false },
  eventManagerParticipant: { authRequired: true, userScoped: false },
  eventManagerRegistration: { authRequired: true, userScoped: false },
  eventManagerTeam: { authRequired: true, userScoped: false },
  eventMigrationAudit: { authRequired: true, userScoped: false },
  eventMigrationPreview: { authRequired: true, userScoped: false },
  eventMigrationReport: { authRequired: true, userScoped: false },
  eventMigrationRollback: { authRequired: true, userScoped: false },
  eventMigrationValidation: { authRequired: true, userScoped: false },
  eventRegistration: { authRequired: false, userScoped: true },
  eventRounds: { authRequired: false, userScoped: false },
  events: { authRequired: false, userScoped: false },
  eventSeasons: { authRequired: false, userScoped: false },
  eventTemplates: { authRequired: false, userScoped: false },
  exportEventRegistrations: { authRequired: true, userScoped: false },
  faction: { authRequired: false, userScoped: false },
  factions: { authRequired: false, userScoped: false },
  hallOfFame: { authRequired: false, userScoped: false },
  heartbeat: { authRequired: true, userScoped: true },
  home: { authRequired: false, userScoped: false },
  identityBulkDisable: { authRequired: true, userScoped: false },
  identityBulkEnable: { authRequired: true, userScoped: false },
  identityResolutionDiagnostics: { authRequired: true, userScoped: false },
  integrity: { authRequired: true, userScoped: false },
  integrityFreshAudit: { authRequired: true, userScoped: false },
  integrityRepair: { authRequired: true, userScoped: false },
  integrityReport: { authRequired: true, userScoped: false },
  intelligence: { authRequired: false, userScoped: false },
  leader: { authRequired: false, userScoped: false },
  leagueOperations: { authRequired: false, userScoped: false },
  leagueOperationsSave: { authRequired: true, userScoped: false },
  manageEventRegistration: { authRequired: true, userScoped: false },
  matchFinder: { authRequired: true, userScoped: true },
  mission: { authRequired: false, userScoped: false },
  missions: { authRequired: false, userScoped: false },
  myProfile: { authRequired: true, userScoped: true },
  news: { authRequired: false, userScoped: false },
  notificationState: { authRequired: true, userScoped: true },
  notifications: { authRequired: true, userScoped: true },
  operations: { authRequired: true, userScoped: false },
  operationsAudit: { authRequired: true, userScoped: false },
  operationsCommand: { authRequired: true, userScoped: false },
  operationsContent: { authRequired: true, userScoped: false },
  operationsDiscord: { authRequired: true, userScoped: false },
  operationsIdentity: { authRequired: true, userScoped: false },
  operationsLifecycle: { authRequired: true, userScoped: false },
  operationsNotifications: { authRequired: true, userScoped: false },
  operationsSeason: { authRequired: true, userScoped: false },
  operationsStatus: { authRequired: true, userScoped: false },
  operationsSummary: { authRequired: true, userScoped: false },
  pauseAutomation: { authRequired: true, userScoped: false },
  player: { authRequired: false, userScoped: false },
  players: { authRequired: false, userScoped: false },
  previewDiscordAnnouncement: { authRequired: true, userScoped: false },
  publishAutomationEvent: { authRequired: true, userScoped: false },
  recentGames: { authRequired: false, userScoped: false },
  rebuild: { authRequired: true, userScoped: false },
  rebuildAchievements: { authRequired: true, userScoped: false },
  rebuildStatistics: { authRequired: true, userScoped: false },
  records: { authRequired: false, userScoped: false },
  refreshCache: { authRequired: true, userScoped: false },
  registerForEvent: { authRequired: true, userScoped: true },
  rejectArmyList: { authRequired: true, userScoped: false },
  reliability: { authRequired: true, userScoped: false },
  reliabilityAction: { authRequired: true, userScoped: false },
  repairIdentity: { authRequired: true, userScoped: false },
  repairMissingAccounts: { authRequired: true, userScoped: false },
  repairUsersSheet: { authRequired: true, userScoped: false },
  replayAutomationSeason: { authRequired: true, userScoped: false },
  replayAutomationWeek: { authRequired: true, userScoped: false },
  replayLastAutomationEvent: { authRequired: true, userScoped: false },
  resendDiscordAnnouncement: { authRequired: true, userScoped: false },
  respondSchedulingRequest: { authRequired: true, userScoped: true },
  resumeAutomation: { authRequired: true, userScoped: false },
  retryAutomationFailed: { authRequired: true, userScoped: false },
  runAutomation: { authRequired: true, userScoped: false },
  runDiscordAutomationJob: { authRequired: true, userScoped: false },
  saveAlert: { authRequired: true, userScoped: false },
  saveNews: { authRequired: true, userScoped: false },
  saveStream: { authRequired: true, userScoped: false },
  saveTimelineEntry: { authRequired: true, userScoped: false },
  schedulingAvailability: { authRequired: true, userScoped: true },
  schedulingCalendar: { authRequired: true, userScoped: true },
  schedulingCenter: { authRequired: true, userScoped: true },
  searchData: { authRequired: false, userScoped: false },
  searchIndex: { authRequired: false, userScoped: false },
  seasonAvailability: { authRequired: true, userScoped: true },
  seasonCommandCenter: { authRequired: true, userScoped: true },
  seasonOperation: { authRequired: true, userScoped: false },
  sendDiscordAnnouncement: { authRequired: true, userScoped: false },
  session: { authRequired: true, userScoped: true },
  settings: { authRequired: false, userScoped: false },
  standings: { authRequired: false, userScoped: false },
  streams: { authRequired: false, userScoped: false },
  submitArmyList: { authRequired: true, userScoped: true },
  submitCasualResult: { authRequired: true, userScoped: true },
  submitLeagueResult: { authRequired: true, userScoped: true },
  teamTournament: { authRequired: true, userScoped: true },
  teamTournamentInvitation: { authRequired: true, userScoped: false },
  teamTournamentPairing: { authRequired: true, userScoped: false },
  teamTournamentRegister: { authRequired: true, userScoped: true },
  teamTournamentResult: { authRequired: true, userScoped: true },
  teamTournamentRound: { authRequired: true, userScoped: false },
  teamTournamentTeam: { authRequired: true, userScoped: false },
  testDiscordWebhook: { authRequired: true, userScoped: false },
  timeline: { authRequired: false, userScoped: false },
  updateArmyList: { authRequired: true, userScoped: false },
  updateAutomationRule: { authRequired: true, userScoped: false },
  updateAutomationTemplate: { authRequired: true, userScoped: false },
  updateDiscordSettings: { authRequired: true, userScoped: false },
  updateProfile: { authRequired: true, userScoped: true },
  updateSettings: { authRequired: true, userScoped: false },
  voteArmyList: { authRequired: true, userScoped: true },
  weeklyReport: { authRequired: false, userScoped: false },
  withdrawEventRegistration: { authRequired: true, userScoped: true },
}

function extractCaseBlocks(contents) {
  const matches = [...contents.matchAll(/case\s+"([^"]+)":/g)]

  return matches.map((match, index) => {
    const endpoint = match[1]
    const start = match.index ?? 0
    const end = index + 1 < matches.length
      ? matches[index + 1].index ?? contents.length
      : contents.indexOf('default:', start) === -1
        ? contents.length
        : contents.indexOf('default:', start)

    return {
      block: contents.slice(start, end),
      endpoint,
      line: contents.slice(0, start).split(/\r?\n/).length,
    }
  })
}

const discovered = new Map()

for (const item of extractCaseBlocks(source)) {
  const current = discovered.get(item.endpoint) ?? {
    blocks: [],
    endpoint: item.endpoint,
  }

  current.blocks.push(item)
  discovered.set(item.endpoint, current)
}

const rows = [...discovered.values()]
  .sort((left, right) => left.endpoint.localeCompare(right.endpoint))
  .map((entry) => {
    const policy = endpointPolicy[entry.endpoint]
    const usesSharedCache = entry.blocks.some((item) =>
      item.block.includes('getCachedApiResponse(')
    )
    const codeAuthRequired = entry.blocks.some((item) =>
      item.block.includes('requireApiPermission(')
    )
    const authRequired = policy?.authRequired ?? codeAuthRequired
    const userScoped = policy?.userScoped ?? false
    const missingPolicy = !policy
    const unsafeSharedCache = usesSharedCache && (authRequired || userScoped)
    const result = missingPolicy || unsafeSharedCache ? 'FAIL' : 'PASS'

    return {
      authRequired,
      endpoint: entry.endpoint,
      lines: entry.blocks.map((item) => item.line).join(','),
      result,
      usesSharedCache,
      userScoped,
      reason: missingPolicy
        ? 'missing endpoint policy'
        : unsafeSharedCache
          ? 'auth/user-scoped endpoint uses shared cache'
          : '',
    }
  })

const headers = [
  'Endpoint',
  'Uses Shared Cache',
  'Auth Required',
  'User Scoped',
  'Result',
  'Line(s)',
]

const table = [
  headers,
  ...rows.map((row) => [
    row.endpoint,
    row.usesSharedCache ? 'Yes' : 'No',
    row.authRequired ? 'Yes' : 'No',
    row.userScoped ? 'Yes' : 'No',
    row.result,
    row.lines,
  ]),
]

const widths = headers.map((_, index) =>
  Math.max(...table.map((row) => String(row[index]).length))
)

for (const row of table) {
  console.log(
    row
      .map((cell, index) => String(cell).padEnd(widths[index]))
      .join('  ')
      .trimEnd()
  )
}

const failures = rows.filter((row) => row.result === 'FAIL')

if (failures.length > 0) {
  console.error('\nSecurity cache audit failed:')
  for (const failure of failures) {
    console.error(`- ${failure.endpoint}: ${failure.reason}`)
  }
  process.exit(1)
}

console.log(`\nSecurity cache audit passed: ${rows.length} endpoints checked.`)
