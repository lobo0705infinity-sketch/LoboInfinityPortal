import { readFileSync } from 'node:fs'

const files = {
  api: read('backend/API.gs'),
  config: read('backend/Config.gs'),
  gameEngine: read('backend/GameEngine.gs'),
  recentGames: read('backend/RecentGames.gs'),
  resultSubmission: read('backend/ResultSubmissionApi.gs'),
  serviceApi: read('src/services/api.ts'),
  submitResult: read('src/pages/SubmitResult.tsx'),
  commissionerLinks: read('src/pages/CommissionerArmyListLinks.tsx'),
  commissionerDashboard: read('src/pages/CommissionerDashboard.tsx'),
  routes: read('src/App.tsx'),
  sidebar: read('src/components/sidebarNavigation.ts'),
  securityAudit: read('scripts/security-cache-audit.mjs'),
}

const checks = [
  [
    'Form schema appends winnerArmyListId and loserArmyListId',
    files.gameEngine.includes('WINNER_ARMY_LIST_ID: 21') &&
      files.gameEngine.includes('LOSER_ARMY_LIST_ID: 22'),
  ],
  [
    'Game Engine per-player rows preserve Army List ID',
    files.config.includes('ARMY_LIST_ID: 15') &&
      files.gameEngine.includes('"Army List ID"') &&
      files.gameEngine.includes('getGameEnginePlayerArmyListId'),
  ],
  [
    'Game Analytics rows preserve winner and loser Army List IDs',
    files.gameEngine.includes('"Winner Army List ID"') &&
      files.gameEngine.includes('"Loser Army List ID"') &&
      files.gameEngine.includes('getGameEngineFormArmyListId(row, FORM.WINNER_ARMY_LIST_ID)') &&
      files.gameEngine.includes('getGameEngineFormArmyListId(row, FORM.LOSER_ARMY_LIST_ID)'),
  ],
  [
    'Recent games support optional historical Army List IDs',
    files.recentGames.includes('WINNER_ARMY_LIST_ID: "Winner Army List ID"') &&
      files.recentGames.includes('LOSER_ARMY_LIST_ID: "Loser Army List ID"') &&
      files.recentGames.includes('if (column === -1)') &&
      files.recentGames.includes('winnerArmyListId: game.winnerArmyListId || ""') &&
      files.recentGames.includes('loserArmyListId: game.loserArmyListId || ""'),
  ],
  [
    'Result submission validates approved list ownership and faction before save',
    files.resultSubmission.includes('validateResultSubmissionArmyListId(') &&
      files.resultSubmission.includes('getResultSubmissionApprovedArmyListById') &&
      files.resultSubmission.includes('resultSubmissionArmyListMatchesFaction') &&
      files.resultSubmission.includes('playerArmyListId') &&
      files.resultSubmission.includes('opponentArmyListId'),
  ],
  [
    'Historical relinking writes canonical storage and records audit',
    files.resultSubmission.includes('function linkHistoricalArmyLists') &&
      files.resultSubmission.includes('getResultSubmissionFormRowNumberForGameId') &&
      files.resultSubmission.includes('recordArmyListLinkAudit') &&
      files.resultSubmission.includes('"Army List Link Audit"'),
  ],
  [
    'Commissioner link endpoints are auth protected and registered',
    files.api.includes('case "armyListLinkCandidates"') &&
      files.api.includes('case "linkHistoricalArmyLists"') &&
      files.securityAudit.includes('armyListLinkCandidates: { authRequired: true') &&
      files.securityAudit.includes('linkHistoricalArmyLists: { authRequired: true'),
  ],
  [
    'Frontend API exposes list tracking fields and mutation',
    files.serviceApi.includes('winnerArmyListId: string') &&
      files.serviceApi.includes('loserArmyListId: string') &&
      files.serviceApi.includes('getArmyListLinkCandidates') &&
      files.serviceApi.includes('linkHistoricalArmyLists'),
  ],
  [
    'Submission UI keeps Army List IDs optional and player/faction filtered',
    files.submitResult.includes('Army List not submitted') &&
      files.submitResult.includes('buildArmyListPickerOptions') &&
      files.submitResult.includes('sameValue(list.player, player)') &&
      files.submitResult.includes('armyListMatchesSelectedFaction'),
  ],
  [
    'Commissioner page supports historical relinking',
    files.commissionerLinks.includes('Link Historical Army Lists') &&
      files.commissionerLinks.includes('Search Game') &&
      files.commissionerLinks.includes('Winner Army List') &&
      files.commissionerLinks.includes('Loser Army List') &&
      files.commissionerLinks.includes('apiClient.linkHistoricalArmyLists'),
  ],
  [
    'Commissioner page is routed and discoverable',
    files.routes.includes('/commissioner/army-list-links') &&
      files.commissionerDashboard.includes('/commissioner/army-list-links'),
  ],
  [
    'Phase 2 Competitive Intelligence source code was not introduced',
    ![
      files.gameEngine,
      files.recentGames,
      files.resultSubmission,
      files.serviceApi,
      files.submitResult,
      files.commissionerLinks,
    ].some((content) => /archetype|observation engine|meta intelligence/i.test(content)),
  ],
]

const failures = checks.filter(([, passed]) => !passed)

if (failures.length > 0) {
  failures.forEach(([label]) => {
    console.error(`FAIL: ${label}`)
  })
  process.exit(1)
}

console.log(`Army list tracking regression checks passed (${checks.length}).`)

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}
