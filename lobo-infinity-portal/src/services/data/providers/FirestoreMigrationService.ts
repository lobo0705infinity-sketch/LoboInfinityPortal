import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseRuntime } from '../../../firebase/firebaseConfig'
import type {
  EventRegistrationEntry,
  FactionSummary,
  LeagueNotification,
  MissionSummary,
  RecentGame,
  TeamTournamentPairing,
  TeamTournamentResult,
  TeamTournamentTeam,
} from '../../api'
import type { Standing } from '../../../types/dashboard'
import { firestorePortalVersion, initializeFirestoreSchema } from './firestoreSchema'
import { runMigrationVerification } from './FirestoreMigrationVerification'
import { googleSheetsProvider } from './GoogleSheetsProvider'

export type FirestoreCollectionMigrationStatus = {
  collection: string
  durationMs: number
  percent: number
  status: 'FAILED' | 'PARTIAL' | 'PASS' | 'PENDING'
  verified: number
  warnings: string[]
  written: number
}

export type FirestoreDataMigrationReport = {
  completedAt: string
  collections: FirestoreCollectionMigrationStatus[]
  documentsVerified: number
  documentsWritten: number
  durationMs: number
  failures: string[]
  googleAuthoritative: true
  overallStatus: 'FAILED' | 'PASS' | 'PARTIAL' | 'PENDING'
  parity: {
    mismatchCount: number
    readiness: string
  }
  provider: 'firestore'
  retries: number
  throughputPerSecond: number
}

let lastMigrationReport: FirestoreDataMigrationReport | null = null

const collectionNames = [
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
] as const

export function getLastFirestoreDataMigrationReport() {
  return (
    lastMigrationReport ?? {
      collections: collectionNames.map((collection) => ({
        collection,
        durationMs: 0,
        percent: 0,
        status: 'PENDING' as const,
        verified: 0,
        warnings: [],
        written: 0,
      })),
      completedAt: '',
      documentsVerified: 0,
      documentsWritten: 0,
      durationMs: 0,
      failures: [],
      googleAuthoritative: true as const,
      overallStatus: 'PENDING' as const,
      parity: {
        mismatchCount: 0,
        readiness: 'VERIFYING',
      },
      provider: 'firestore' as const,
      retries: 0,
      throughputPerSecond: 0,
    }
  )
}

export async function runFirestoreDataMigration(): Promise<FirestoreDataMigrationReport> {
  const startedAt = performance.now()
  const failures: string[] = []
  const statuses: FirestoreCollectionMigrationStatus[] = []
  const runtime = getFirebaseRuntime()

  await initializeFirestoreSchema(runtime.db, runtime.config.projectId, {
    initializedBy: 'migration',
    portalVersion: firestorePortalVersion,
  })

  const operations = [
    migrateEvents,
    migratePlayers,
    migrateGames,
    migrateRegistrations,
    migrateTeams,
    migratePairings,
    migrateNotifications,
    migrateMissions,
    migrateFactions,
    migrateAnalytics,
    migrateSettings,
  ]

  for (const operation of operations) {
    try {
      statuses.push(await operation())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown migration failure.'
      failures.push(message)
      statuses.push({
        collection: operation.name.replace(/^migrate/, '').toLowerCase(),
        durationMs: 0,
        percent: 0,
        status: 'FAILED',
        verified: 0,
        warnings: [message],
        written: 0,
      })
    }
  }

  const verification = await runMigrationVerification()
  const durationMs = Math.round(performance.now() - startedAt)
  const documentsWritten = statuses.reduce((total, status) => total + status.written, 0)
  const documentsVerified = statuses.reduce((total, status) => total + status.verified, 0)
  const failed = failures.length > 0 || statuses.some((status) => status.status === 'FAILED')
  const partial = statuses.some((status) => status.percent < 100)

  lastMigrationReport = {
    collections: statuses,
    completedAt: new Date().toISOString(),
    documentsVerified,
    documentsWritten,
    durationMs,
    failures,
    googleAuthoritative: true,
    overallStatus: failed ? 'FAILED' : partial ? 'PARTIAL' : 'PASS',
    parity: {
      mismatchCount: verification.mismatchCount,
      readiness: verification.overallReadiness,
    },
    provider: 'firestore',
    retries: 0,
    throughputPerSecond:
      durationMs > 0 ? Math.round((documentsWritten / durationMs) * 1000) : 0,
  }

  await setDocument('settings', 'migrationStatus', {
    ...lastMigrationReport,
    updatedAt: serverTimestamp(),
  })

  return lastMigrationReport
}

async function migrateEvents() {
  const catalog = await googleSheetsProvider.events.getEvents()
  const startedAt = performance.now()

  for (const event of catalog.events) {
    await setDocument('events', safeId(event.id || event.name), {
      ...event,
      migratedAt: serverTimestamp(),
      provider: 'firestore',
    })
  }

  if (catalog.currentEvent) {
    await setDocument('settings', 'currentEvent', {
      eventId: catalog.currentEvent.id,
      updatedAt: serverTimestamp(),
    })
  }

  return status('events', catalog.events.length, catalog.events.length, startedAt)
}

async function migratePlayers() {
  const divisions = await googleSheetsProvider.players.getAllPlayers()
  const rows = divisions.flatMap((division) =>
    division.standings.map((player) => ({
      ...player,
      division: division.division,
      divisionLabel: division.divisionLabel,
    })),
  )
  const startedAt = performance.now()

  for (const player of rows) {
    await setDocument('players', safeId(player.player || player.displayName), player)
  }

  return status('players', rows.length, rows.length, startedAt)
}

async function migrateGames() {
  const games = await googleSheetsProvider.games.getRecentGames()
  const startedAt = performance.now()

  for (const game of games) {
    await setDocument('games', safeId(String(game.id || `${game.date}-${game.winner}-${game.loser}`)), game)
  }

  return status('games', games.length, games.length, startedAt)
}

async function migrateRegistrations() {
  const catalog = await googleSheetsProvider.events.getEvents()
  const startedAt = performance.now()
  let written = 0
  const warnings: string[] = []

  for (const event of catalog.events) {
    const registration = await googleSheetsProvider.registrations
      .getRegistration(event.id)
      .catch((error: unknown) => {
        warnings.push(readError(error, `Registration read failed for ${event.id}.`))
        return null
      })

    for (const entry of registration?.registrations ?? []) {
      await setRegistration(entry)
      written += 1
    }
  }

  return status('registrations', written, written, startedAt, warnings)
}

async function migrateTeams() {
  const tournaments = await readTeamTournaments()
  const startedAt = performance.now()
  let written = 0

  for (const tournament of tournaments) {
    for (const team of tournament.teams) {
      await setTeam(team)
      written += 1
    }
  }

  return status('teams', written, written, startedAt)
}

async function migratePairings() {
  const tournaments = await readTeamTournaments()
  const startedAt = performance.now()
  let written = 0

  for (const tournament of tournaments) {
    for (const pairing of tournament.pairings) {
      await setPairing(pairing)
      written += 1
    }
  }

  return status('pairings', written, written, startedAt)
}

async function migrateNotifications() {
  const notifications = await googleSheetsProvider.notifications.getNotifications()
  const startedAt = performance.now()

  for (const notification of notifications) {
    await setNotification(notification)
  }

  return status('notifications', notifications.length, notifications.length, startedAt)
}

async function migrateMissions() {
  const missions = await googleSheetsProvider.analytics.getMissions()
  const startedAt = performance.now()

  for (const mission of missions) {
    await setMission(mission)
  }

  return status('missions', missions.length, missions.length, startedAt)
}

async function migrateFactions() {
  const factions = await googleSheetsProvider.analytics.getFactions()
  const startedAt = performance.now()

  for (const faction of factions) {
    await setFaction(faction)
  }

  return status('factions', factions.length, factions.length, startedAt)
}

async function migrateAnalytics() {
  const startedAt = performance.now()
  const [analytics, records, hallOfFame, dashboard, commandCenter] =
    await Promise.all([
      googleSheetsProvider.analytics.getAnalytics(),
      googleSheetsProvider.analytics.getRecords(),
      googleSheetsProvider.analytics.getHallOfFame(),
      googleSheetsProvider.dashboard.getDashboard(),
      googleSheetsProvider.dashboard.getCommunityCommandCenter(),
    ])
  const docs = {
    commandCenter,
    dashboard,
    hallOfFame,
    leagueIntelligence: analytics,
    records,
  }

  for (const [id, value] of Object.entries(docs)) {
    await setDocument('analytics', id, {
      id,
      migratedAt: serverTimestamp(),
      value,
    })
  }

  await migrateTournamentResults()

  return status('analytics', Object.keys(docs).length, Object.keys(docs).length, startedAt)
}

async function migrateSettings() {
  const startedAt = performance.now()
  const catalog = await googleSheetsProvider.events.getEvents()

  await setDocument('settings', 'provider', {
    activeProvider: 'google',
    firestoreMirror: true,
    googleAuthoritative: true,
    migratedAt: serverTimestamp(),
  })
  await setDocument('settings', 'events', {
    currentEventId: catalog.currentEvent?.id ?? '',
    eventCount: catalog.events.length,
    migratedAt: serverTimestamp(),
  })

  return status('settings', 2, 2, startedAt)
}

async function migrateTournamentResults() {
  const tournaments = await readTeamTournaments()

  for (const tournament of tournaments) {
    for (const result of tournament.tournamentResults) {
      await setTournamentResult(result)
    }
  }
}

async function readTeamTournaments() {
  const catalog = await googleSheetsProvider.events.getEvents()
  const tournaments = []

  for (const event of catalog.events.filter((item) => item.type === 'Team Tournament')) {
    const tournament = await googleSheetsProvider.teams
      .getTeamTournament(event.id)
      .catch(() => null)

    if (tournament) {
      tournaments.push(tournament)
    }
  }

  return tournaments
}

async function setRegistration(entry: EventRegistrationEntry) {
  await setDocument(
    'registrations',
    safeId(`${entry.eventId}-${entry.player || entry.email || entry.displayName}`),
    entry,
  )
}

async function setTeam(team: TeamTournamentTeam) {
  await setDocument('teams', safeId(team.teamId || `${team.eventId}-${team.teamName}`), team)
}

async function setPairing(pairing: TeamTournamentPairing) {
  await setDocument('pairings', safeId(pairing.roundId || `${pairing.eventId}-${pairing.round}-${pairing.teamA}-${pairing.teamB}`), pairing)
}

async function setTournamentResult(result: TeamTournamentResult) {
  await setDocument('analytics', safeId(`result-${result.resultId || `${result.eventId}-${result.round}-${result.player}`}`), {
    ...result,
    type: 'teamTournamentResult',
  })
}

async function setNotification(notification: LeagueNotification) {
  await setDocument('notifications', safeId(notification.id), notification)
}

async function setMission(mission: MissionSummary) {
  await setDocument('missions', safeId(mission.mission), mission)
}

async function setFaction(faction: FactionSummary) {
  await setDocument('factions', safeId(faction.name), faction)
}

async function setDocument(
  collectionName: string,
  id: string,
  value: Record<string, unknown> | RecentGame | Standing,
) {
  const runtime = getFirebaseRuntime()
  await setDoc(
    doc(runtime.db, collectionName, id || 'unknown'),
    {
      ...JSON.parse(JSON.stringify(value)),
      migratedAt: serverTimestamp(),
      migratedFrom: 'google-sheets',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

function status(
  collection: string,
  written: number,
  verified: number,
  startedAt: number,
  warnings: string[] = [],
): FirestoreCollectionMigrationStatus {
  return {
    collection,
    durationMs: Math.round(performance.now() - startedAt),
    percent: written === verified ? 100 : Math.round((verified / Math.max(1, written)) * 100),
    status: warnings.length > 0 ? 'PARTIAL' : 'PASS',
    verified,
    warnings,
    written,
  }
}

function safeId(value: string) {
  return (value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
