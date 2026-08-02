import { readFileSync } from 'node:fs'

const files = {
  armyIntelligenceAdapter: read('backend/OperationsArmyIntelligenceAdapter.gs'),
  armyIntelligencePage: read('src/pages/ArmyIntelligence.tsx'),
  api: read('backend/API.gs'),
  cacheAdapter: read('backend/OperationsCacheAdapter.gs'),
  commissionerDashboard: read('src/pages/CommissionerDashboard.tsx'),
  commissionerSystem: read('src/pages/CommissionerSystem.tsx'),
  competitiveIntelligenceAdapter: read('backend/OperationsCompetitiveIntelligenceAdapter.gs'),
  gameEngineAdapter: read('backend/OperationsGameEngineAdapter.gs'),
  leagueIntegrity: read('src/pages/LeagueIntegrity.tsx'),
  operationsEngine: read('backend/OperationsEngine.gs'),
  appCss: read('src/App.css'),
  serviceApi: read('src/services/api.ts'),
  securityAudit: read('scripts/security-cache-audit.mjs'),
}

const adapterFiles = [
  files.armyIntelligenceAdapter,
  files.cacheAdapter,
  files.competitiveIntelligenceAdapter,
  files.gameEngineAdapter,
]

const stateSection = files.operationsEngine.slice(
  files.operationsEngine.indexOf('function getOperationsEngineState()'),
  files.operationsEngine.indexOf('function executeOperationsEngineNext(e)'),
)

const queueHeaders = [
  'Operation ID',
  'Operation Type',
  'Operation Class',
  'Owning Subsystem',
  'Artifact State Key',
  'Status',
  'Priority',
  'Dependency Operation ID',
  'Retry Count',
  'Primary Trigger',
  'Trigger Count',
  'Triggers JSON',
  'Latest Trigger At',
  'Queue Position',
  'Created At',
  'Started At',
  'Completed At',
  'Updated At',
  'Error Message',
  'Verification Result JSON',
]

const logHeaders = [
  'Log ID',
  'Operation ID',
  'Operation Type',
  'Operation Class',
  'Owning Subsystem',
  'Artifact State Key',
  'Event Type',
  'Trigger',
  'Triggered At',
  'Merged Operation ID',
  'Status',
  'Success',
  'Started At',
  'Completed At',
  'Duration Ms',
  'Rows Processed',
  'Cache Invalidations JSON',
  'Downstream Operations JSON',
  'Verification Result JSON',
  'Retry Count',
  'Error Message',
  'Created At',
]

const checks = [
  [
    'Operations Engine stores queue and log as hidden tabs in active workbook',
    files.operationsEngine.includes('SpreadsheetApp.getActive()') &&
      files.operationsEngine.includes('spreadsheet.insertSheet(sheetName)') &&
      files.operationsEngine.includes('sheet.hideSheet()') &&
      !files.operationsEngine.includes('SpreadsheetApp.create') &&
      !files.operationsEngine.includes('openById'),
  ],
  [
    'Phase 1 queue and log accessors remain present',
    files.operationsEngine.includes('function getOperationsEngineQueue()') &&
      files.operationsEngine.includes('function getOperationsEngineLog()'),
  ],
  [
    'Queue schema includes approved v4 fields',
    queueHeaders.every((header) => files.operationsEngine.includes(`"${header}"`)),
  ],
  [
    'Log schema includes approved audit fields',
    logHeaders.every((header) => files.operationsEngine.includes(`"${header}"`)),
  ],
  [
    'Operation class order is preserved',
    files.operationsEngine.includes('"Immediate"') &&
      files.operationsEngine.indexOf('"Immediate"') < files.operationsEngine.indexOf('"High"') &&
      files.operationsEngine.indexOf('"High"') < files.operationsEngine.indexOf('"Normal"') &&
      files.operationsEngine.indexOf('"Normal"') < files.operationsEngine.indexOf('"Background"'),
  ],
  [
    'Coalescing identity fields are explicit and unchanged',
    files.operationsEngine.includes('"Owning Subsystem"') &&
      files.operationsEngine.includes('"Operation Type"') &&
      files.operationsEngine.includes('"Artifact State Key"') &&
      files.operationsEngine.includes('coalescingKey: OPERATIONS_ENGINE_QUEUE_IDENTITY_FIELDS.slice()'),
  ],
  [
    'Read-only API routes are auth protected',
    files.api.includes('case "operationsQueue"') &&
      files.api.includes('return getOperationsEngineQueue();') &&
      files.api.includes('case "operationsLog"') &&
      files.api.includes('return getOperationsEngineLog();') &&
      files.securityAudit.includes('operationsQueue: { authRequired: true') &&
      files.securityAudit.includes('operationsLog: { authRequired: true'),
  ],
  [
    'Frontend API exposes read-only queue and log methods',
    files.serviceApi.includes('export type OperationsQueueItem') &&
      files.serviceApi.includes('export type OperationsLogEntry') &&
      files.serviceApi.includes("request('operationsQueue'") &&
      files.serviceApi.includes("request('operationsLog'") &&
      files.serviceApi.includes('getOperationsQueue,') &&
      files.serviceApi.includes('getOperationsLog,'),
  ],
  [
    'Phase 3 exposes read-only subsystem stale state',
    files.operationsEngine.includes('function getOperationsEngineState()') &&
      files.operationsEngine.includes('function getOperationsEngineSubsystemStates()') &&
      files.api.includes('case "operationsState"') &&
      files.api.includes('return getOperationsEngineState();') &&
      files.securityAudit.includes('operationsState: { authRequired: true') &&
      files.serviceApi.includes('export type OperationsSubsystemState') &&
      files.serviceApi.includes("request('operationsState'") &&
      files.serviceApi.includes('getOperationsState,'),
  ],
  [
    'All subsystem adapters report passive stale state contracts',
    adapterFiles.every((contents) =>
      contents.includes('artifactStateKey:') &&
      contents.includes('stale:') &&
      contents.includes('staleReason:')
    ),
  ],
  [
    'Passive stale state does not execute operations directly',
    !stateSection.includes('.rebuild(') &&
      !stateSection.includes('.verify(') &&
      !stateSection.includes('rebuildGameEngine()'),
  ],
  [
    'Phase 4 queue execution uses LockService and runs one existing item',
    files.operationsEngine.includes('function executeOperationsEngineNext(e)') &&
      files.operationsEngine.includes('LockService.getScriptLock()') &&
      files.operationsEngine.includes('lock.tryLock(OPERATIONS_ENGINE_LOCK_WAIT_MS)') &&
      files.operationsEngine.includes('selectNextOperationsEngineOperation(queueRows)') &&
      files.operationsEngine.includes('executeOperationsEngineQueueRow('),
  ],
  [
    'Queue execution respects scheduler ordering and dependencies',
    files.operationsEngine.includes('function compareOperationsEngineQueueRows') &&
      files.operationsEngine.includes('getOperationsEngineOperationClassRank') &&
      files.operationsEngine.includes('right.record.priority - left.record.priority') &&
      files.operationsEngine.includes('getOperationsEngineQueueAge') &&
      files.operationsEngine.includes('getOperationsEngineDependencyState'),
  ],
  [
    'Queue execution preserves coalescing without stale-work inference',
      files.operationsEngine.includes('coalesceOperationsEngineQueueRows') &&
      files.operationsEngine.includes('getOperationsEngineCoalescingKey') &&
      !/function\s+mark.*Stale/i.test(files.operationsEngine) &&
      !/function\s+requestOperation\b/i.test(files.operationsEngine),
  ],
  [
    'Queue execution delegates to adapters, verifies, invalidates caches, and logs',
    files.operationsEngine.includes('adapter.rebuild(context)') &&
      files.operationsEngine.includes('adapter.verify(context)') &&
      files.operationsEngine.includes('invalidateOperationsEngineAdapterCaches(adapter, context)') &&
      files.operationsEngine.includes('appendOperationsEngineLog('),
  ],
  [
    'Queue execution API is auth protected and service-wrapped',
    files.api.includes('case "operationsRunNext"') &&
      files.api.includes('return executeOperationsEngineNext(e);') &&
      files.securityAudit.includes('operationsRunNext: { authRequired: true') &&
      files.serviceApi.includes('export type OperationsExecutionData') &&
      files.serviceApi.includes("postRequest('operationsRunNext'") &&
      files.serviceApi.includes('runOperationsNext,'),
  ],
  [
    'Stages 2-4 disable global Shadow Mode for approved production execution',
    files.operationsEngine.includes('const OPERATIONS_ENGINE_SHADOW_MODE = false') &&
      files.operationsEngine.includes('const OPERATIONS_ENGINE_EXECUTABLE_OPERATIONS') &&
      files.operationsEngine.includes('gameEngine: "Rebuild Game Engine"') &&
      files.operationsEngine.includes('armyIntelligence: "Refresh Army Intelligence"') &&
      files.operationsEngine.includes('competitiveIntelligence: "Refresh Competitive Intelligence"') &&
      files.operationsEngine.includes('function isOperationsEngineShadowMode()') &&
      files.operationsEngine.includes('function isOperationsEngineOperationExecutionEnabled(operation)'),
  ],
  [
    'Operations state reads perform stale detection and queueing without execution',
    stateSection.includes('requestOperationsEngineGameEngineSelfHealing(states)') &&
      stateSection.includes('requestOperationsEngineArmyIntelligenceSelfHealing(states)') &&
      stateSection.includes('requestOperationsEngineCompetitiveIntelligenceSelfHealing(states)') &&
      stateSection.includes('planOperationsEngineShadowQueue()') &&
      stateSection.includes('shadowMode: isOperationsEngineShadowMode()') &&
      stateSection.includes('shadowPlanning: shadowPlanning') &&
      !stateSection.includes('executeOperationsEngineNext') &&
      !stateSection.includes('invalidateOperationsEngineAdapterCaches'),
  ],
  [
    'Stage 0 planned operations are logged as WOULD EXECUTE with required audit fields',
    shadowModeSection(files.operationsEngine).includes('"Event Type": "WOULD EXECUTE"') &&
      shadowModeSection(files.operationsEngine).includes('"Status": "WOULD EXECUTE"') &&
      shadowModeSection(files.operationsEngine).includes('"Owning Subsystem": operation.owningSubsystem') &&
      shadowModeSection(files.operationsEngine).includes('"Trigger": operation.primaryTrigger') &&
      shadowModeSection(files.operationsEngine).includes('"Cache Invalidations JSON"') &&
      shadowModeSection(files.operationsEngine).includes('"Downstream Operations JSON"') &&
      shadowModeSection(files.operationsEngine).includes('"Verification Result JSON"'),
  ],
  [
    'Stage 0 shadow planning never executes rebuilds, verifies, refreshes, or cache invalidation',
    !shadowModeSection(files.operationsEngine).includes('adapter.rebuild(context)') &&
      !shadowModeSection(files.operationsEngine).includes('adapter.verify(context)') &&
      !shadowModeSection(files.operationsEngine).includes('rebuildGameEngine()') &&
      !shadowModeSection(files.operationsEngine).includes('refreshArmyIntelligence(') &&
      !shadowModeSection(files.operationsEngine).includes('getIntelligence()') &&
      !shadowModeSection(files.operationsEngine).includes('invalidatePortalCacheGroup(group)') &&
      !shadowModeSection(files.operationsEngine).includes('invalidateOperationsEngineAdapterCaches'),
  ],
  [
    'Stage 0 planning records dependency, verification, cache, and downstream plans',
    shadowModeSection(files.operationsEngine).includes('dependencyStatus') &&
      shadowModeSection(files.operationsEngine).includes('dependencyReason') &&
      shadowModeSection(files.operationsEngine).includes('adapterVerificationRequired') &&
      shadowModeSection(files.operationsEngine).includes('plannedCacheInvalidations') &&
      shadowModeSection(files.operationsEngine).includes('plannedDownstreamOperations') &&
      shadowModeSection(files.operationsEngine).includes('getOperationsEnginePlannedDownstreamOperations'),
  ],
  [
    'Stages 2-4 keep non-approved operations in shadow planning',
    executionSection(files.operationsEngine).includes('!isOperationsEngineOperationExecutionEnabled(operation)') &&
      executionSection(files.operationsEngine).includes('return executeOperationsEngineQueueRowInShadowMode('),
  ],
  [
    'Stages 2-4 enqueue downstream work only after successful verification',
    executionSection(files.operationsEngine).indexOf('adapter.verify(context)') <
      executionSection(files.operationsEngine).indexOf('if (verificationResult.success === false)') &&
      executionSection(files.operationsEngine).indexOf('if (verificationResult.success === false)') <
      executionSection(files.operationsEngine).indexOf('if (finalStatus === "Completed")') &&
      files.operationsEngine.includes('function requestOperationsEngineDownstreamSelfHealing(operation)') &&
      files.operationsEngine.includes('requestOperationsEngineArmyIntelligenceSelfHealing(states)') &&
      files.operationsEngine.includes('requestOperationsEngineCompetitiveIntelligenceSelfHealing(states)'),
  ],
  [
    'Downstream enqueue reuses the active execution lock',
    files.operationsEngine.includes('var OPERATIONS_ENGINE_LOCK_HELD = false') &&
      files.operationsEngine.includes('function isOperationsEngineLockHeld()') &&
      files.operationsEngine.includes('if (isOperationsEngineLockHeld())') &&
      files.operationsEngine.includes('return enqueueOperationWithLock(request);') &&
      files.operationsEngine.includes('OPERATIONS_ENGINE_LOCK_HELD = true') &&
      files.operationsEngine.includes('OPERATIONS_ENGINE_LOCK_HELD = false'),
  ],
  [
    'Phase 5 exposes coalescing enqueueOperation without bypassing the queue',
    files.operationsEngine.includes('function enqueueOperation(request)') &&
      files.operationsEngine.includes('findOperationsEngineQueueRowForRequest') &&
      files.operationsEngine.includes('appendOperationsEngineQueueRequest') &&
      files.operationsEngine.includes('mergeOperationsEngineQueueRequest') &&
      files.operationsEngine.includes('getOperationsEngineCoalescingKey(row.record) === key'),
  ],
  [
    'Only Game Engine, Army Intelligence, and Competitive Intelligence adapters request self-healing work',
    files.gameEngineAdapter.includes('function requestOperationsGameEngineSelfHealing') &&
      files.gameEngineAdapter.includes('return enqueueOperation({') &&
      files.armyIntelligenceAdapter.includes('function requestOperationsArmyIntelligenceSelfHealing') &&
      files.armyIntelligenceAdapter.includes('return enqueueOperation({') &&
      files.competitiveIntelligenceAdapter.includes('function requestOperationsCompetitiveIntelligenceSelfHealing') &&
      files.competitiveIntelligenceAdapter.includes('return enqueueOperation({') &&
      !files.cacheAdapter.includes('enqueueOperation'),
  ],
  [
    'Game Engine self-healing does not directly rebuild or execute the queue',
    selfHealingSection(files.gameEngineAdapter).includes('currentState.stale') &&
      !selfHealingSection(files.gameEngineAdapter).includes('rebuildGameEngine()') &&
      !selfHealingSection(files.gameEngineAdapter).includes('executeOperationsEngineNext'),
  ],
  [
    'Operations state triggers only approved Phase 5-7 self-healing adapters',
    files.operationsEngine.includes('requestOperationsEngineGameEngineSelfHealing(states)') &&
      files.operationsEngine.includes('requestOperationsEngineArmyIntelligenceSelfHealing(states)') &&
      files.operationsEngine.includes('requestOperationsEngineCompetitiveIntelligenceSelfHealing(states)') &&
      files.operationsEngine.includes('requestOperationsGameEngineSelfHealing(') &&
      files.operationsEngine.includes('requestOperationsArmyIntelligenceSelfHealing(') &&
      files.operationsEngine.includes('requestOperationsCompetitiveIntelligenceSelfHealing(') &&
      !files.operationsEngine.includes('requestOperationsCacheSelfHealing'),
  ],
  [
    'Army Intelligence self-healing is gated by Game Engine health and queue state',
    armySelfHealingSection(files.armyIntelligenceAdapter).includes('!currentGameEngineState.healthy') &&
      armySelfHealingSection(files.armyIntelligenceAdapter).includes('requestContext.gameEngineQueue.blocked') &&
      files.operationsEngine.includes('getOperationsEngineBlockingOperationState(') &&
      files.operationsEngine.includes('"Failed"'),
  ],
  [
    'Army Intelligence refreshes once per new Game Engine artifact state',
    armySelfHealingSection(files.armyIntelligenceAdapter).includes('lastSuccessfulArtifactStateKey') &&
      armySelfHealingSection(files.armyIntelligenceAdapter).includes('gameEngineArtifactStateKey') &&
      armySelfHealingSection(files.armyIntelligenceAdapter).includes('artifactStateKey: gameEngineArtifactStateKey') &&
      files.operationsEngine.includes('getOperationsEngineLatestSuccessfulArtifactStateKey('),
  ],
  [
    'Army Intelligence self-healing does not directly rebuild or execute the queue',
    armySelfHealingSection(files.armyIntelligenceAdapter).includes('currentState.stale') &&
      !armySelfHealingSection(files.armyIntelligenceAdapter).includes('refreshArmyIntelligence(') &&
      !armySelfHealingSection(files.armyIntelligenceAdapter).includes('executeOperationsEngineNext'),
  ],
  [
    'Competitive Intelligence stale state is based on Army Intelligence artifact state',
    files.competitiveIntelligenceAdapter.includes('getOperationsCompetitiveIntelligenceSourceState') &&
      files.competitiveIntelligenceAdapter.includes('getOperationsArmyIntelligenceCurrentState') &&
      files.competitiveIntelligenceAdapter.includes('sourceArtifactStateKey') &&
      files.competitiveIntelligenceAdapter.includes('lastSuccessfulArtifactStateKey'),
  ],
  [
    'Competitive Intelligence self-healing is gated by Army Intelligence health and queue state',
    competitiveSelfHealingSection(files.competitiveIntelligenceAdapter).includes('!currentArmyIntelligenceState.healthy') &&
      competitiveSelfHealingSection(files.competitiveIntelligenceAdapter).includes('requestContext.armyIntelligenceQueue.blocked') &&
      files.operationsEngine.includes('getOperationsEngineBlockingOperationState(') &&
      files.operationsEngine.includes('"Refresh Army Intelligence"') &&
      files.operationsEngine.includes('"Failed"'),
  ],
  [
    'Competitive Intelligence refreshes once per new Army Intelligence artifact state',
    competitiveSelfHealingSection(files.competitiveIntelligenceAdapter).includes('lastSuccessfulArtifactStateKey') &&
      competitiveSelfHealingSection(files.competitiveIntelligenceAdapter).includes('armyIntelligenceArtifactStateKey') &&
      competitiveSelfHealingSection(files.competitiveIntelligenceAdapter).includes('artifactStateKey: armyIntelligenceArtifactStateKey') &&
      files.operationsEngine.includes('getOperationsEngineLatestSuccessfulArtifactStateKey('),
  ],
  [
    'Competitive Intelligence self-healing does not directly rebuild or execute the queue',
    competitiveSelfHealingSection(files.competitiveIntelligenceAdapter).includes('currentState.stale') &&
      !competitiveSelfHealingSection(files.competitiveIntelligenceAdapter).includes('getIntelligence()') &&
      !competitiveSelfHealingSection(files.competitiveIntelligenceAdapter).includes('executeOperationsEngineNext'),
  ],
  [
    'Stage 5 cache healing is enabled for verified completed operations',
    files.operationsEngine.includes('const OPERATIONS_ENGINE_CACHE_HEALING_ENABLED = true') &&
      files.operationsEngine.includes('function isOperationsEngineCacheHealingEnabled()') &&
      files.operationsEngine.includes('if (!isOperationsEngineCacheHealingEnabled())') &&
      files.operationsEngine.indexOf('if (!isOperationsEngineCacheHealingEnabled())') <
        files.operationsEngine.indexOf('invalidatePortalCacheGroup(group)'),
  ],
  [
    'Future cache invalidation path remains gated after rebuild and verification pass',
    executionSection(files.operationsEngine).indexOf('adapter.rebuild(context)') <
      executionSection(files.operationsEngine).indexOf('adapter.verify(context)') &&
      executionSection(files.operationsEngine).indexOf('adapter.verify(context)') <
      executionSection(files.operationsEngine).indexOf('if (verificationResult.success === false)') &&
      executionSection(files.operationsEngine).indexOf('if (verificationResult.success === false)') <
      executionSection(files.operationsEngine).indexOf('invalidateOperationsEngineAdapterCaches(adapter, context)') &&
      !catchSection(files.operationsEngine).includes('invalidateOperationsEngineAdapterCaches') &&
      !catchSection(files.operationsEngine).includes('invalidatePortalCacheGroup'),
  ],
  [
    'Operations Engine invalidates only declared adapter cache groups',
    files.operationsEngine.includes('function getOperationsEngineAdapterCacheGroups(adapter, context)') &&
      files.operationsEngine.includes('adapter.getAffectedCacheGroups(context)') &&
      files.operationsEngine.includes('coalesceOperationsEngineCacheGroups(groups)') &&
      files.operationsEngine.includes('invalidatePortalCacheGroup(group)'),
  ],
  [
    'Duplicate cache invalidation groups coalesce before invalidation',
    files.operationsEngine.includes('function coalesceOperationsEngineCacheGroups(groups)') &&
      files.operationsEngine.includes('const seen = {}') &&
      files.operationsEngine.includes('if (seen[normalizedGroup])') &&
      files.operationsEngine.includes('normalized.push(normalizedGroup)'),
  ],
  [
    'Declared cache groups are preserved for Game Engine, Army Intelligence, and Competitive Intelligence',
    declaredCacheGroups(files.gameEngineAdapter).includes('"dashboard"') &&
      declaredCacheGroups(files.gameEngineAdapter).includes('"standings"') &&
      declaredCacheGroups(files.gameEngineAdapter).includes('"players"') &&
      declaredCacheGroups(files.gameEngineAdapter).includes('"analytics"') &&
      declaredCacheGroups(files.gameEngineAdapter).includes('"armyIntelligence"') &&
      declaredCacheGroups(files.gameEngineAdapter).includes('"operations"') &&
      declaredCacheGroups(files.armyIntelligenceAdapter).includes('"armyIntelligence"') &&
      declaredCacheGroups(files.armyIntelligenceAdapter).includes('"analytics"') &&
      declaredCacheGroups(files.armyIntelligenceAdapter).includes('"operations"') &&
      declaredCacheGroups(files.competitiveIntelligenceAdapter).includes('"analytics"') &&
      declaredCacheGroups(files.competitiveIntelligenceAdapter).includes('"dashboard"') &&
      declaredCacheGroups(files.competitiveIntelligenceAdapter).includes('"operations"'),
  ],
  [
    'Cache adapter does not invalidate during rebuild before verification',
    !cacheRebuildSection(files.cacheAdapter).includes('invalidatePortalCacheGroup(group)') &&
      files.cacheAdapter.includes('plannedCacheInvalidations: [group]') &&
      files.cacheAdapter.includes('function getOperationsCacheAffectedCacheGroups(context)'),
  ],
  [
    'Phase 9 Commissioner Operations Dashboard reads state, queue, and log only',
    files.commissionerDashboard.includes('function OperationsEngineDashboard()') &&
      files.commissionerDashboard.includes('apiClient.getOperationsState({ signal: controller.signal })') &&
      files.commissionerDashboard.includes('apiClient.getOperationsQueue({ signal: controller.signal })') &&
      files.commissionerDashboard.includes('apiClient.getOperationsLog({ signal: controller.signal })') &&
      !operationsDashboardSection(files.commissionerDashboard).includes('runOperationsNext') &&
      !operationsDashboardSection(files.commissionerDashboard).includes('<button'),
  ],
  [
    'Phase 9 dashboard displays required Operations Queue columns',
    [
      'Operation Type',
      'Operation Class',
      'Status',
      'Owning Subsystem',
      'Priority',
      'Dependency',
      'Trigger Count',
      'Queue Position',
      'Created At',
      'Started At',
      'Retry Count',
    ].every((label) => operationsDashboardSection(files.commissionerDashboard).includes(label)),
  ],
  [
    'Phase 9 dashboard displays required Operations Log columns and summaries',
    [
      'Overall System Health',
      'Subsystem Health',
      'Active Operation',
      'Operations Queue',
      'Recent Operations Log',
      'Last Successful Run',
      'Last Failure',
      'Queue Statistics',
      'Retry Statistics',
      'Operation',
      'Subsystem',
      'Trigger',
      'Duration',
      'Rows Processed',
      'Verification Result',
      'Cache Invalidations',
      'Final Status',
      'Timestamp',
    ].every((label) => operationsDashboardSection(files.commissionerDashboard).includes(label)),
  ],
  [
    'Phase 9 replaces the old maintenance panel without adding execution controls',
    !files.commissionerDashboard.includes('function CachePanel') &&
      !files.commissionerDashboard.includes('Cache and Rebuild') &&
      !files.commissionerDashboard.includes('Refresh All Cache') &&
      !files.commissionerDashboard.includes('Statistics Rebuild') &&
      !files.commissionerDashboard.includes('Refresh Army Intelligence') &&
      !files.commissionerDashboard.includes('apiClient.refreshArmyIntelligenceSnapshots') &&
      !files.commissionerDashboard.includes('runOperationsNext'),
  ],
  [
    'Phase 9 dashboard styles provide responsive read-only queue and log tables',
    files.appCss.includes('.operations-engine-dashboard') &&
      files.appCss.includes('.operations-engine-subsystems') &&
      files.appCss.includes('.operations-table-wrap') &&
      files.appCss.includes('.operations-table th') &&
      files.appCss.includes('.operations-table td'),
  ],
  [
    'Phase 10 Army Intelligence shows Operations Engine status instead of routine refresh controls',
    files.armyIntelligencePage.includes('function ArmyIntelligenceOperationsStatus()') &&
      files.armyIntelligencePage.includes('apiClient.getOperationsState({ signal: controller.signal })') &&
      files.armyIntelligencePage.includes('apiClient.getOperationsQueue({ signal: controller.signal })') &&
      files.armyIntelligencePage.includes('Automatic Operations') &&
      !files.armyIntelligencePage.includes('refreshAllSectorials') &&
      !files.armyIntelligencePage.includes('Refresh All Sectorials') &&
      !files.armyIntelligencePage.includes('apiClient.refreshArmyIntelligenceSnapshots'),
  ],
  [
    'Phase 10 League Integrity normal workflow is status and reporting only',
    integrityActionsSection(files.leagueIntegrity).includes('Automatic Operations') &&
      integrityActionsSection(files.leagueIntegrity).includes('Integrity Maintenance Is Self-Healing') &&
      integrityActionsSection(files.leagueIntegrity).includes('Export Audit Report') &&
      !integrityActionsSection(files.leagueIntegrity).includes('Run Fresh Audit') &&
      !integrityActionsSection(files.leagueIntegrity).includes('Repair All Safe Issues') &&
      !integrityActionsSection(files.leagueIntegrity).includes('Rebuild Statistics') &&
      !integrityActionsSection(files.leagueIntegrity).includes('Rebuild Standings') &&
      !integrityActionsSection(files.leagueIntegrity).includes('Refresh Cache'),
  ],
  [
    'Phase 10 League Integrity preserves break-glass recovery controls separately',
    emergencyRecoverySection(files.leagueIntegrity).includes('Emergency / Recovery') &&
      emergencyRecoverySection(files.leagueIntegrity).includes('Break-Glass Administrative Tools') &&
      emergencyRecoverySection(files.leagueIntegrity).includes('Emergency Fresh Audit') &&
      emergencyRecoverySection(files.leagueIntegrity).includes('Emergency Safe Repair') &&
      emergencyRecoverySection(files.leagueIntegrity).includes('Emergency Statistics Rebuild') &&
      emergencyRecoverySection(files.leagueIntegrity).includes('Emergency Standings Rebuild') &&
      emergencyRecoverySection(files.leagueIntegrity).includes('Emergency Cache Recovery'),
  ],
  [
    'Phase 10 System hub keeps routine maintenance out of normal workflows',
    files.commissionerSystem.includes('emergencyWorkflows') &&
      files.commissionerSystem.includes('Break-Glass Tools') &&
      files.commissionerSystem.includes('Search Index Recovery') &&
      !systemWorkflowsSection(files.commissionerSystem).includes('Cache Management') &&
      !systemWorkflowsSection(files.commissionerSystem).includes('Rebuild Engine') &&
      !systemWorkflowsSection(files.commissionerSystem).includes('Recalculate Statistics') &&
      !systemWorkflowsSection(files.commissionerSystem).includes('Queue Maintenance') &&
      !systemWorkflowsSection(files.commissionerSystem).includes('Refresh Search Index') &&
      !files.commissionerSystem.includes('Maintenance Consoles') &&
      !files.commissionerSystem.includes('system maintenance tools'),
  ],
]

const failures = checks.filter(([, passed]) => !passed)

if (failures.length > 0) {
  failures.forEach(([label]) => {
    console.error(`FAIL: ${label}`)
  })
  process.exit(1)
}

console.log(`Operations Engine checks passed (${checks.length}).`)

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function selfHealingSection(contents) {
  const start = contents.indexOf('function requestOperationsGameEngineSelfHealing')
  const end = contents.indexOf('function getOperationsGameEngineDependencies')

  return contents.slice(start, end)
}

function armySelfHealingSection(contents) {
  const start = contents.indexOf('function requestOperationsArmyIntelligenceSelfHealing')
  const end = contents.indexOf('function getOperationsArmyIntelligenceDependencies')

  return contents.slice(start, end)
}

function competitiveSelfHealingSection(contents) {
  const start = contents.indexOf('function requestOperationsCompetitiveIntelligenceSelfHealing')
  const end = contents.indexOf('function getOperationsCompetitiveIntelligenceDependencies')

  return contents.slice(start, end)
}

function executionSection(contents) {
  const start = contents.indexOf('function executeOperationsEngineQueueRow')
  const end = contents.indexOf('function getOperationsEngineAdapterForOperation')

  return contents.slice(start, end)
}

function catchSection(contents) {
  const section = executionSection(contents)
  const start = section.indexOf('catch (err)')
  const end = section.indexOf('const completedAt')

  return section.slice(start, end)
}

function declaredCacheGroups(contents) {
  const match = contents.match(/function getOperations[A-Za-z]+AffectedCacheGroups[\s\S]*?\n}\n/)

  return match ? match[0] : ''
}

function cacheRebuildSection(contents) {
  const start = contents.indexOf('function rebuildOperationsCache')
  const end = contents.indexOf('function verifyOperationsCache')

  return contents.slice(start, end)
}

function operationsDashboardSection(contents) {
  const start = contents.indexOf('function OperationsEngineDashboard')
  const end = contents.indexOf('function AuditPanel')

  return contents.slice(start, end)
}

function shadowModeSection(contents) {
  const start = contents.indexOf('function planOperationsEngineShadowQueue')
  const end = contents.indexOf('function getOperationsEngineAdapterForOperation')

  return contents.slice(start, end)
}

function integrityActionsSection(contents) {
  const start = contents.indexOf('function IntegrityActions')
  const end = contents.indexOf('function EmergencyRecoveryActions')

  return contents.slice(start, end)
}

function emergencyRecoverySection(contents) {
  const start = contents.indexOf('function EmergencyRecoveryActions')
  const end = contents.indexOf('function IntegritySectionCard')

  return contents.slice(start, end)
}

function systemWorkflowsSection(contents) {
  const start = contents.indexOf('const systemWorkflows')
  const end = contents.indexOf('const emergencyWorkflows')

  return contents.slice(start, end)
}
