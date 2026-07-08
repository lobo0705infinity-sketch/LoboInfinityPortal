import type { DataProvider } from '../DataProvider'
import { firestoreProvider } from './FirestoreProvider'
import { getFirestoreBootstrapReport } from './FirestoreBootstrap'
import { googleSheetsProvider } from './GoogleSheetsProvider'

export type MigrationDifference = {
  event?: string
  field: string
  firestoreValue: string
  googleValue: string
  method: string
  player?: string
  repository: string
  severity: 'critical' | 'warning'
  timestamp: string
}

export type RepositoryMigrationStatus = {
  averageLatencyMs: number
  firestoreLatencyMs: number
  googleLatencyMs: number
  lastVerified: string
  methodCount: number
  mismatchCount: number
  p95LatencyMs: number
  repository: string
  status: 'ERROR' | 'MATCH' | 'MISMATCH' | 'PENDING'
}

export type MigrationVerificationReport = {
  differences: MigrationDifference[]
  firestoreComplete: {
    collections: string[]
    missingCollections: string[]
    status: 'FAIL' | 'PASS'
  }
  generatedAt: string
  lastVerification: string
  migrationProgress: number
  mismatchCount: number
  overallReadiness: 'BLOCKED' | 'READY FOR FIRESTORE' | 'VERIFYING'
  performance: {
    firestore: LatencySummary
    google: LatencySummary
  }
  provider: {
    active: string
    firestore: string
    google: string
    mode: string
  }
  repositories: RepositoryMigrationStatus[]
  rollback: {
    available: boolean
    instruction: string
  }
  synchronization: {
    mismatchRate: number
    readSuccess: number
    replicationLatencyMs: number
    writeSuccess: string
  }
}

type LatencySummary = {
  averageMs: number
  medianMs: number
  p95Ms: number
}

type VerificationProbe = {
  method: string
  repository: keyof DataProvider
  run: (provider: DataProvider) => Promise<unknown>
}

const probes: VerificationProbe[] = [
  {
    method: 'getDashboard',
    repository: 'dashboard',
    run: (provider) => provider.dashboard.getDashboard(),
  },
  {
    method: 'getCommunityCommandCenter',
    repository: 'dashboard',
    run: (provider) => provider.dashboard.getCommunityCommandCenter(),
  },
  {
    method: 'getHome',
    repository: 'dashboard',
    run: (provider) => provider.dashboard.getHome(),
  },
  {
    method: 'getEvents',
    repository: 'events',
    run: (provider) => provider.events.getEvents(),
  },
  {
    method: 'getEventHome',
    repository: 'events',
    run: (provider) => provider.events.getEventHome(),
  },
  {
    method: 'getEventManager',
    repository: 'events',
    run: (provider) => provider.events.getEventManager(),
  },
  {
    method: 'getRecentGames',
    repository: 'games',
    run: (provider) => provider.games.getRecentGames(),
  },
  {
    method: 'getNotifications',
    repository: 'notifications',
    run: (provider) => provider.notifications.getNotifications(),
  },
  {
    method: 'getAllPlayers',
    repository: 'players',
    run: (provider) => provider.players.getAllPlayers(),
  },
  {
    method: 'getCurrentPlayer',
    repository: 'players',
    run: (provider) => provider.players.getCurrentPlayer(),
  },
  {
    method: 'getRegistration',
    repository: 'registrations',
    run: (provider) => provider.registrations.getRegistration(),
  },
  {
    method: 'getMatchFinder',
    repository: 'scheduling',
    run: (provider) => provider.scheduling.getMatchFinder(),
  },
  {
    method: 'getSchedulingCenter',
    repository: 'scheduling',
    run: (provider) => provider.scheduling.getSchedulingCenter(),
  },
  {
    method: 'getAllStandings',
    repository: 'standings',
    run: (provider) => provider.standings.getAllStandings(),
  },
  {
    method: 'getStandings',
    repository: 'standings',
    run: (provider) => provider.standings.getStandings('main'),
  },
  {
    method: 'getTeamTournament',
    repository: 'teams',
    run: (provider) => provider.teams.getTeamTournament(),
  },
  {
    method: 'getAnalytics',
    repository: 'analytics',
    run: (provider) => provider.analytics.getAnalytics(),
  },
  {
    method: 'getFactions',
    repository: 'analytics',
    run: (provider) => provider.analytics.getFactions(),
  },
  {
    method: 'getHallOfFame',
    repository: 'analytics',
    run: (provider) => provider.analytics.getHallOfFame(),
  },
  {
    method: 'getMissions',
    repository: 'analytics',
    run: (provider) => provider.analytics.getMissions(),
  },
  {
    method: 'getRecords',
    repository: 'analytics',
    run: (provider) => provider.analytics.getRecords(),
  },
]

let verificationRun: Promise<MigrationVerificationReport> | null = null

export function getMigrationVerificationReport() {
  if (!verificationRun) {
    verificationRun = runMigrationVerification()
  }

  return verificationRun
}

export async function runMigrationVerification(): Promise<MigrationVerificationReport> {
  const generatedAt = new Date().toISOString()
  const bootstrap = await getFirestoreBootstrapReport()
  const [googleHealth, firestoreHealth] = await Promise.all([
    googleSheetsProvider.getHealth(),
    firestoreProvider.getHealth(),
  ])
  const results = await Promise.all(probes.map(runProbe))
  const differences = results.flatMap((result) => result.differences)
  const repositories = buildRepositoryStatuses(results, generatedAt)
  const googleLatencies = results.map((result) => result.googleLatencyMs)
  const firestoreLatencies = results.map((result) => result.firestoreLatencyMs)
  const totalChecks = results.length
  const matchedChecks = results.filter((result) => result.status === 'MATCH').length
  const mismatchRate = totalChecks > 0
    ? Math.round((differences.length / totalChecks) * 100)
    : 0
  const requiredCollections = [
    'events',
    'players',
    'games',
    'registrations',
    'teams',
    'pairings',
    'notifications',
    'missions',
    'factions',
    'analytics',
    'settings',
  ]
  const availableCollections = firestoreHealth.collections ?? []
  const missingCollections = requiredCollections.filter(
    (collection) => !availableCollections.includes(collection),
  )
  const criticalMismatches = differences.filter(
    (difference) => difference.severity === 'critical',
  ).length
  const ready =
    bootstrap.overallHealth !== 'FAIL' &&
    firestoreHealth.status === 'healthy' &&
    criticalMismatches === 0 &&
    differences.length === 0 &&
    missingCollections.length === 0

  return {
    differences: differences.slice(0, 100),
    firestoreComplete: {
      collections: availableCollections,
      missingCollections,
      status: missingCollections.length === 0 ? 'PASS' : 'FAIL',
    },
    generatedAt,
    lastVerification: generatedAt,
    migrationProgress: totalChecks > 0
      ? Math.round((matchedChecks / totalChecks) * 100)
      : 0,
    mismatchCount: differences.length,
    overallReadiness: ready
      ? 'READY FOR FIRESTORE'
      : totalChecks === 0
        ? 'VERIFYING'
        : 'BLOCKED',
    performance: {
      firestore: summarizeLatency(firestoreLatencies),
      google: summarizeLatency(googleLatencies),
    },
    provider: {
      active: String(import.meta.env.VITE_DATA_PROVIDER ?? 'google'),
      firestore: firestoreHealth.status,
      google: googleHealth.status,
      mode: String(import.meta.env.VITE_DATA_PROVIDER ?? 'google'),
    },
    repositories,
    rollback: {
      available: true,
      instruction:
        'Set VITE_DATA_PROVIDER=google and redeploy to route all repository reads and writes through Google Sheets.',
    },
    synchronization: {
      mismatchRate,
      readSuccess: Math.round(
        (results.filter((result) => result.googleOk && result.firestoreOk).length /
          Math.max(1, totalChecks)) *
          100,
      ),
      replicationLatencyMs: Math.max(0, median(firestoreLatencies) - median(googleLatencies)),
      writeSuccess: 'Writes are not mirrored during verification; Google Sheets remains authoritative.',
    },
  }
}

async function runProbe(probe: VerificationProbe) {
  const google = await timed(() => probe.run(googleSheetsProvider))
  const firestore = await timed(() => probe.run(firestoreProvider))
  const differences: MigrationDifference[] = []

  if (!google.ok || !firestore.ok) {
    differences.push({
      field: 'repository',
      firestoreValue: firestore.ok ? 'OK' : firestore.error,
      googleValue: google.ok ? 'OK' : google.error,
      method: probe.method,
      repository: String(probe.repository),
      severity: 'critical',
      timestamp: new Date().toISOString(),
    })
  } else {
    const diff = findFirstDifference(google.value, firestore.value)

    if (diff) {
      differences.push({
        field: diff.path,
        firestoreValue: summarizeValue(diff.right),
        googleValue: summarizeValue(diff.left),
        method: probe.method,
        repository: String(probe.repository),
        severity: 'critical',
        timestamp: new Date().toISOString(),
      })
    }
  }

  return {
    differences,
    firestoreLatencyMs: firestore.durationMs,
    firestoreOk: firestore.ok,
    googleLatencyMs: google.durationMs,
    googleOk: google.ok,
    method: probe.method,
    repository: String(probe.repository),
    status: differences.length === 0 ? 'MATCH' : 'MISMATCH',
  }
}

async function timed(action: () => Promise<unknown>) {
  const startedAt = performance.now()

  try {
    const value = await action()

    return {
      durationMs: Math.round(performance.now() - startedAt),
      ok: true as const,
      value,
    }
  } catch (error) {
    return {
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : 'Unknown provider error.',
      ok: false as const,
    }
  }
}

function buildRepositoryStatuses(
  results: Awaited<ReturnType<typeof runProbe>>[],
  generatedAt: string,
): RepositoryMigrationStatus[] {
  const groups = new Map<string, Awaited<ReturnType<typeof runProbe>>[]>()

  results.forEach((result) => {
    const group = groups.get(result.repository) ?? []
    group.push(result)
    groups.set(result.repository, group)
  })

  return Array.from(groups.entries()).map(([repository, group]) => {
    const latencies = group.flatMap((result) => [
      result.googleLatencyMs,
      result.firestoreLatencyMs,
    ])
    const mismatchCount = group.reduce(
      (total, result) => total + result.differences.length,
      0,
    )
    const hasError = group.some((result) => !result.googleOk || !result.firestoreOk)

    return {
      averageLatencyMs: average(latencies),
      firestoreLatencyMs: average(group.map((result) => result.firestoreLatencyMs)),
      googleLatencyMs: average(group.map((result) => result.googleLatencyMs)),
      lastVerified: generatedAt,
      methodCount: group.length,
      mismatchCount,
      p95LatencyMs: percentile(latencies, 95),
      repository,
      status: hasError
        ? 'ERROR'
        : mismatchCount > 0
          ? 'MISMATCH'
          : 'MATCH',
    }
  })
}

function findFirstDifference(
  left: unknown,
  right: unknown,
  path = '$',
): { left: unknown; path: string; right: unknown } | null {
  if (stableStringify(left) === stableStringify(right)) {
    return null
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return { left, path, right }
    }

    if (left.length !== right.length) {
      return { left: left.length, path: `${path}.length`, right: right.length }
    }

    for (let index = 0; index < left.length; index += 1) {
      const difference = findFirstDifference(
        left[index],
        right[index],
        `${path}[${index}]`,
      )

      if (difference) {
        return difference
      }
    }
  }

  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) {
      return { left, path, right }
    }

    const keys = Array.from(
      new Set([...Object.keys(left), ...Object.keys(right)]),
    ).sort()

    for (const key of keys) {
      const difference = findFirstDifference(
        left[key],
        right[key],
        `${path}.${key}`,
      )

      if (difference) {
        return difference
      }
    }
  }

  return { left, path, right }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function summarizeValue(value: unknown) {
  const serialized = stableStringify(value)
  return serialized.length > 240 ? `${serialized.slice(0, 237)}...` : serialized
}

function summarizeLatency(values: number[]): LatencySummary {
  return {
    averageMs: average(values),
    medianMs: median(values),
    p95Ms: percentile(values, 95),
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length)
}

function median(values: number[]) {
  return percentile(values, 50)
}

function percentile(values: number[], target: number) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((target / 100) * sorted.length) - 1),
  )

  return sorted[index]
}
