import { getDiagnosticsState, type LoboApiRequestDiagnostic } from './diagnostics'
import { getFrontendPerformanceDiagnostics } from './performanceDiagnostics'

type PipelineSubStage = {
  durationMs?: number
  stage?: string
  details?: Record<string, unknown>
}

type PipelineDiagnostics = {
  action?: string
  stages?: Record<string, { durationMs?: number }>
  subStages?: PipelineSubStage[]
}

export type ObservatoryBudgetStatus = 'pass' | 'warning' | 'fail'

export type ObservatoryOperation = {
  averageMs: number
  bestMs: number
  budgetMs: number
  count: number
  name: string
  p95Ms: number
  status: ObservatoryBudgetStatus
  worstMs: number
}

export type ObservatoryDuplicateWork = {
  count: number
  evidence: string
  recommendation: string
  source: string
  totalMs: number
  type: 'api' | 'cache' | 'calculation' | 'eventEngine' | 'playerRegistry' | 'sheet'
}

export type ObservatoryWaterfallItem = {
  durationMs: number
  name: string
  percent: number
}

export type ObservatoryEndpointProfile = {
  action: string
  averageMs: number
  callCount: number
  maximumMs: number
  minimumMs: number
  percentOfEndpoint: number
  stage: string
  totalMs: number
}

export type PerformanceObservatorySnapshot = {
  apiPerformance: ObservatoryOperation[]
  budgetStatus: ObservatoryOperation[]
  cache: {
    hits: number
    hitRatio: number
    invalidations: ObservatoryDuplicateWork[]
    misses: number
    shared: number
  }
  deployment: {
    bundleVersion: string
    deploymentId: string
    gitCommit: string
  }
  duplicateWork: ObservatoryDuplicateWork[]
  generatedAt: string
  historicalTrend: Array<{
    averageApiMs: number
    cacheHitRatio: number
    deploymentId: string
    generatedAt: string
    slowestWorkflow: string
    slowestWorkflowMs: number
  }>
  operationTimeline: ObservatoryWaterfallItem[]
  recommendedNextOptimization: {
    cause: string
    expectedImprovementMs: number
    operation: string
    recommendation: string
  }
  regression: {
    api: 'improved' | 'regressed' | 'unchanged'
    cache: 'improved' | 'regressed' | 'unchanged'
    requestCount: 'improved' | 'regressed' | 'unchanged'
    summary: string
  }
  releaseGate: {
    apiCount: number
    bundleCssBytes: number
    bundleJsBytes: number
    cacheHitRatio: number
    duplicateRequests: number
    performanceScore: number
    slowestEndpoint: string
    slowestWorkflow: string
    startupRequests: number
  }
  routePerformance: ObservatoryOperation[]
  topEndpointStages: ObservatoryEndpointProfile[]
  topSlowestOperations: ObservatoryOperation[]
}

const performanceBudgets: Record<string, number> = {
  approveRegistration: 1_000,
  authentication: 2_000,
  commissionerDashboard: 2_000,
  dashboard: 2_000,
  eventHome: 2_000,
  factions: 1_500,
  hallOfFame: 2_000,
  heartbeat: 200,
  matchFinder: 2_000,
  missions: 1_500,
  playerProfile: 2_000,
  search: 1_000,
  session: 1_000,
  standings: 2_000,
  submitResult: 2_000,
  teamTournament: 2_000,
}

const historyKey = 'lobo-performance-observatory-history'

export function buildPerformanceObservatory(): PerformanceObservatorySnapshot {
  const diagnostics = getDiagnosticsState()
  const frontend = getFrontendPerformanceDiagnostics()
  const apiRequests = diagnostics.apiRequests.slice(-150)
  const operations = buildOperationScoreboard(apiRequests)
  const routePerformance = buildRoutePerformance()
  const endpointProfiles = buildEndpointProfiles(apiRequests)
  const duplicateWork = buildDuplicateWork(apiRequests, frontend.api.requestsThatCanBeCombined)
  const cacheInvalidations = duplicateWork.filter((work) => work.type === 'cache')
  const slowest = operations[0]
  const recommendation = buildRecommendation(operations, duplicateWork, endpointProfiles)
  const history = updateHistory({
    averageApiMs: Math.round(frontend.api.averageDurationMs),
    cacheHitRatio: frontend.api.cacheHitRatio,
    deploymentId: frontend.bundleVersion,
    generatedAt: new Date().toISOString(),
    slowestWorkflow: slowest?.name ?? 'None',
    slowestWorkflowMs: slowest?.averageMs ?? 0,
  })
  const previous = history.at(-2)

  return {
    apiPerformance: buildApiPerformance(apiRequests),
    budgetStatus: operations,
    cache: {
      hits: frontend.api.cacheHits,
      hitRatio: frontend.api.cacheHitRatio,
      invalidations: cacheInvalidations,
      misses: frontend.api.cacheMisses,
      shared: frontend.api.sharedRequests,
    },
    deployment: {
      bundleVersion: frontend.bundleVersion,
      deploymentId: frontend.bundleVersion,
      gitCommit: 'captured-by-release-metadata',
    },
    duplicateWork,
    generatedAt: new Date().toISOString(),
    historicalTrend: history,
    operationTimeline: buildOperationTimeline(apiRequests),
    recommendedNextOptimization: recommendation,
    regression: buildRegression(previous, frontend, slowest),
    releaseGate: {
      apiCount: frontend.api.requestCount,
      bundleCssBytes: frontend.stylesheetTransferBytes,
      bundleJsBytes: frontend.javascriptTransferBytes,
      cacheHitRatio: frontend.api.cacheHitRatio,
      duplicateRequests: frontend.api.duplicateRequestCount,
      performanceScore: calculatePerformanceScore(operations, frontend.api.cacheHitRatio),
      slowestEndpoint: frontend.api.slowest[0]?.action ?? 'None',
      slowestWorkflow: slowest?.name ?? 'None',
      startupRequests: estimateStartupRequests(apiRequests),
    },
    routePerformance,
    topEndpointStages: endpointProfiles.slice(0, 25),
    topSlowestOperations: operations.slice(0, 10),
  }
}

function buildOperationScoreboard(apiRequests: LoboApiRequestDiagnostic[]) {
  const groups = new Map<string, number[]>()

  apiRequests.forEach((request) => {
    addMetric(groups, classifyWorkflow(request), request.durationMs)
  })

  getTeamTournamentApprovalDiagnostics().forEach((event) => {
    if (
      typeof event.durationMs === 'number' &&
      (event.event === 'approvalToastShown' || event.event === 'approvalFailed')
    ) {
      addMetric(groups, 'approveRegistration', event.durationMs)
    }
  })

  return Array.from(groups.entries())
    .map(([name, values]) => buildOperation(name, values))
    .sort((left, right) => right.averageMs - left.averageMs)
}

function buildApiPerformance(apiRequests: LoboApiRequestDiagnostic[]) {
  const groups = new Map<string, number[]>()

  apiRequests.forEach((request) => {
    addMetric(groups, request.action, request.durationMs)
  })

  return Array.from(groups.entries())
    .map(([name, values]) => buildOperation(name, values))
    .sort((left, right) => right.averageMs - left.averageMs)
}

function buildRoutePerformance() {
  const groups = new Map<string, number[]>()

  getDiagnosticsState().routeDiagnostics.forEach((route) => {
    if (route.event === 'finishedRender' || route.event === 'firstRender') {
      addMetric(groups, route.name || route.pathname, route.durationMs)
    }
  })

  return Array.from(groups.entries())
    .map(([name, values]) => buildOperation(name, values))
    .sort((left, right) => right.averageMs - left.averageMs)
}

function buildOperation(name: string, values: number[]): ObservatoryOperation {
  const sorted = values.slice().sort((left, right) => left - right)
  const averageMs = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  const budgetMs = performanceBudgets[name] ?? 2_000

  return {
    averageMs,
    bestMs: sorted[0] ?? 0,
    budgetMs,
    count: values.length,
    name,
    p95Ms: percentile(sorted, 95),
    status: averageMs > budgetMs * 1.25 ? 'fail' : averageMs > budgetMs ? 'warning' : 'pass',
    worstMs: sorted.at(-1) ?? 0,
  }
}

function buildEndpointProfiles(apiRequests: LoboApiRequestDiagnostic[]) {
  const profiles = new Map<string, ObservatoryEndpointProfile>()

  apiRequests.forEach((request) => {
    const diagnostics = readPipeline(request.pipelineDiagnostics)
    const endpointMs = diagnostics?.stages?.endpointExecution?.durationMs ?? request.durationMs
    const stages = [
      ...Object.entries(diagnostics?.stages ?? {}).map(([stage, value]) => ({
        stage,
        durationMs: value.durationMs ?? 0,
      })),
      ...(diagnostics?.subStages ?? []).map((stage) => ({
        stage: stage.stage ?? 'unknown',
        durationMs: stage.durationMs ?? 0,
      })),
    ]

    stages.forEach((stage) => {
      if (stage.durationMs <= 0) {
        return
      }

      const key = `${request.action}:${stage.stage}`
      const existing = profiles.get(key) ?? {
        action: request.action,
        averageMs: 0,
        callCount: 0,
        maximumMs: 0,
        minimumMs: Number.POSITIVE_INFINITY,
        percentOfEndpoint: 0,
        stage: stage.stage,
        totalMs: 0,
      }

      existing.callCount += 1
      existing.totalMs += stage.durationMs
      existing.maximumMs = Math.max(existing.maximumMs, stage.durationMs)
      existing.minimumMs = Math.min(existing.minimumMs, stage.durationMs)
      existing.averageMs = Math.round(existing.totalMs / existing.callCount)
      existing.percentOfEndpoint = endpointMs > 0
        ? Math.round((existing.totalMs / endpointMs) * 10_000) / 100
        : 0
      profiles.set(key, existing)
    })
  })

  return Array.from(profiles.values())
    .map((profile) => ({
      ...profile,
      minimumMs: Number.isFinite(profile.minimumMs) ? profile.minimumMs : 0,
    }))
    .sort((left, right) => right.totalMs - left.totalMs)
}

function buildDuplicateWork(
  apiRequests: LoboApiRequestDiagnostic[],
  frontendDuplicates: Array<{ action: string; count: number; routePath: string; totalDurationMs: number }>,
) {
  const work: ObservatoryDuplicateWork[] = frontendDuplicates.map((duplicate) => ({
    count: duplicate.count,
    evidence: `${duplicate.action} repeated on ${duplicate.routePath}`,
    recommendation: 'Reuse the in-flight request or cached response.',
    source: duplicate.action,
    totalMs: duplicate.totalDurationMs,
    type: 'api',
  }))

  const stageCounts = new Map<string, { count: number; totalMs: number }>()

  apiRequests.forEach((request) => {
    const diagnostics = readPipeline(request.pipelineDiagnostics)
    diagnostics?.subStages?.forEach((subStage) => {
      const stage = subStage.stage ?? ''
      if (!isDuplicateCandidate(stage)) {
        return
      }

      const existing = stageCounts.get(stage) ?? { count: 0, totalMs: 0 }
      existing.count += 1
      existing.totalMs += subStage.durationMs ?? 0
      stageCounts.set(stage, existing)
    })
  })

  stageCounts.forEach((value, stage) => {
    if (value.count <= 1 && value.totalMs < 250) {
      return
    }

    work.push({
      count: value.count,
      evidence: stage,
      recommendation: buildDuplicateRecommendation(stage),
      source: stage,
      totalMs: Math.round(value.totalMs),
      type: classifyDuplicateType(stage),
    })
  })

  return work.sort((left, right) => right.totalMs - left.totalMs).slice(0, 25)
}

function buildOperationTimeline(apiRequests: LoboApiRequestDiagnostic[]) {
  const latest = apiRequests.at(-1)
  const diagnostics = readPipeline(latest?.pipelineDiagnostics)
  const endpointMs = diagnostics?.stages?.endpointExecution?.durationMs ?? latest?.durationMs ?? 0

  return [
    ...Object.entries(diagnostics?.stages ?? {}).map(([name, stage]) => ({
      durationMs: stage.durationMs ?? 0,
      name,
      percent: endpointMs > 0 ? Math.round(((stage.durationMs ?? 0) / endpointMs) * 10_000) / 100 : 0,
    })),
    ...(diagnostics?.subStages ?? []).map((stage) => ({
      durationMs: stage.durationMs ?? 0,
      name: stage.stage ?? 'unknown',
      percent: endpointMs > 0 ? Math.round(((stage.durationMs ?? 0) / endpointMs) * 10_000) / 100 : 0,
    })),
  ]
    .filter((item) => item.durationMs > 0)
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 20)
}

function buildRecommendation(
  operations: ObservatoryOperation[],
  duplicateWork: ObservatoryDuplicateWork[],
  endpointProfiles: ObservatoryEndpointProfile[],
) {
  const duplicate = duplicateWork[0]
  const endpoint = endpointProfiles[0]
  const operation = operations[0]

  if (duplicate && duplicate.totalMs >= (endpoint?.totalMs ?? 0)) {
    return {
      cause: duplicate.evidence,
      expectedImprovementMs: Math.round(duplicate.totalMs * 0.7),
      operation: duplicate.source,
      recommendation: duplicate.recommendation,
    }
  }

  return {
    cause: endpoint?.stage ?? operation?.name ?? 'No bottleneck detected',
    expectedImprovementMs: endpoint ? Math.round(endpoint.totalMs * 0.5) : 0,
    operation: endpoint?.action ?? operation?.name ?? 'None',
    recommendation: endpoint
      ? `Investigate ${endpoint.stage} inside ${endpoint.action}.`
      : 'Collect more production telemetry.',
  }
}

function buildRegression(
  previous: PerformanceObservatorySnapshot['historicalTrend'][number] | undefined,
  frontend: ReturnType<typeof getFrontendPerformanceDiagnostics>,
  slowest: ObservatoryOperation | undefined,
) {
  if (!previous) {
    return {
      api: 'unchanged' as const,
      cache: 'unchanged' as const,
      requestCount: 'unchanged' as const,
      summary: 'No previous observatory snapshot in this browser.',
    }
  }

  const averageApi = Math.round(frontend.api.averageDurationMs)
  const api = compareMetric(averageApi, previous.averageApiMs, false)
  const cache = compareMetric(frontend.api.cacheHitRatio, previous.cacheHitRatio, true)
  const requestCount = compareMetric(frontend.api.requestCount, 0, false)

  return {
    api,
    cache,
    requestCount,
    summary:
      `API ${api}; cache ${cache}; slowest workflow ${slowest?.name ?? 'None'} ` +
      `${slowest?.averageMs ?? 0} ms.`,
  }
}

function updateHistory(entry: PerformanceObservatorySnapshot['historicalTrend'][number]) {
  const existing = readHistory()
  const last = existing.at(-1)
  const next = last?.deploymentId === entry.deploymentId
    ? [...existing.slice(0, -1), entry]
    : [...existing, entry]

  const limited = next.slice(-30)

  try {
    localStorage.setItem(historyKey, JSON.stringify(limited))
  } catch {
    // Local storage is best-effort diagnostics only.
  }

  return limited
}

function readHistory(): PerformanceObservatorySnapshot['historicalTrend'] {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey) ?? '[]') as unknown
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is PerformanceObservatorySnapshot['historicalTrend'][number] =>
          typeof entry === 'object' && entry !== null,
        )
      : []
  } catch {
    return []
  }
}

function classifyWorkflow(request: LoboApiRequestDiagnostic) {
  if (request.action === 'manageEventRegistration') {
    return 'approveRegistration'
  }

  if (request.action === 'session') {
    return 'session'
  }

  if (request.action === 'heartbeat') {
    return 'heartbeat'
  }

  if (request.route.includes('team-tournament') || request.action === 'teamTournament') {
    return 'teamTournament'
  }

  if (request.action === 'eventHome') {
    return 'eventHome'
  }

  if (request.route.includes('match-finder') || request.action === 'matchFinder') {
    return 'matchFinder'
  }

  if (request.route.includes('standings') || request.action === 'standings') {
    return 'standings'
  }

  if (request.route.includes('dashboard') || request.action === 'dashboard') {
    return 'dashboard'
  }

  return request.action
}

function addMetric(groups: Map<string, number[]>, key: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return
  }

  groups.set(key, [...(groups.get(key) ?? []), Math.round(value)])
}

function percentile(sorted: number[], target: number) {
  if (sorted.length === 0) {
    return 0
  }

  const index = Math.ceil((target / 100) * sorted.length) - 1
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)]
}

function isDuplicateCandidate(stage: string) {
  const normalized = stage.toLowerCase()
  return (
    normalized.includes('getdatarange') ||
    normalized.includes('registry') ||
    normalized.includes('eventengine') ||
    normalized.includes('cachemiss') ||
    normalized.includes('upsertscan') ||
    normalized.includes('calculation')
  )
}

function classifyDuplicateType(stage: string): ObservatoryDuplicateWork['type'] {
  const normalized = stage.toLowerCase()

  if (normalized.includes('cache')) {
    return 'cache'
  }

  if (normalized.includes('player')) {
    return 'playerRegistry'
  }

  if (normalized.includes('eventengine') || normalized.includes('event engine')) {
    return 'eventEngine'
  }

  if (normalized.includes('calculation')) {
    return 'calculation'
  }

  return 'sheet'
}

function buildDuplicateRecommendation(stage: string) {
  const type = classifyDuplicateType(stage)

  if (type === 'sheet') {
    return 'Read the sheet once per request or reuse an existing snapshot.'
  }

  if (type === 'playerRegistry') {
    return 'Reuse the cached Player Registry for this workflow.'
  }

  if (type === 'eventEngine') {
    return 'Use Event Engine runtime snapshots instead of repeated access.'
  }

  if (type === 'cache') {
    return 'Review invalidation scope and cache lifetime.'
  }

  return 'Reuse computed results inside the workflow.'
}

function calculatePerformanceScore(operations: ObservatoryOperation[], cacheHitRatio: number) {
  const budgetPassRatio = operations.length > 0
    ? operations.filter((operation) => operation.status === 'pass').length / operations.length
    : 1
  return Math.max(0, Math.min(100, Math.round((budgetPassRatio * 70) + (cacheHitRatio * 0.3))))
}

function estimateStartupRequests(apiRequests: LoboApiRequestDiagnostic[]) {
  const first = apiRequests[0]
  if (!first) {
    return 0
  }

  const firstTime = Date.parse(first.startedAt)
  return apiRequests.filter((request) => Date.parse(request.startedAt) - firstTime <= 3_000).length
}

function compareMetric(
  current: number,
  previous: number,
  higherIsBetter: boolean,
): 'improved' | 'regressed' | 'unchanged' {
  if (previous <= 0 || Math.abs(current - previous) <= Math.max(50, previous * 0.05)) {
    return 'unchanged'
  }

  const improved = higherIsBetter ? current > previous : current < previous
  return improved ? 'improved' : 'regressed'
}

function readPipeline(value: unknown): PipelineDiagnostics | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as PipelineDiagnostics
}

function getTeamTournamentApprovalDiagnostics() {
  const diagnosticsWindow = window as unknown as {
    __loboDiagnostics?: {
      teamTournamentApprovals?: Array<{
        durationMs?: number
        event?: string
      }>
    }
  }

  return diagnosticsWindow.__loboDiagnostics?.teamTournamentApprovals ?? []
}
