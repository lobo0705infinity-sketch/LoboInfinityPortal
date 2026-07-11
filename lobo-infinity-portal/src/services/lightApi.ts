import type {
  AuthSession,
  LeagueNotification,
  PortalSettings,
  PortalUser,
  SearchData,
} from './api'
import { postRequest, request, type ApiOptions } from './apiCore'
import { formatNotificationTimestamp } from './formatting'

let settingsCache: PortalSettings | null = null
let settingsRequest: Promise<PortalSettings> | null = null

export type PlatformReliabilityData = {
  appsScriptVersion: string
  audit: Array<Record<string, unknown>>
  cache: {
    entries: Array<Record<string, unknown>>
    performance: {
      averageApiResponse: string
      cacheHitRate: number
      cacheMissRate: number
      errors: number
      staleFallbacks: number
    }
    status: string
    version: string
  }
  cacheActions: Array<{
    entries: number
    id: string
    label: string
  }>
  frontendVersion: string
  generatedAt: string
  health: {
    averageApiResponse: string
    cacheHitRate: number
    failedJobs: number
    lastSuccessfulRebuild: string
    runningJobs: number
    score: number
    status: string
    warnings: string[]
  }
  history: Array<Record<string, unknown>>
  jobs: Array<{
    completedAt: string
    durationMs: number
    error: string
    id: string
    queuedAt: string
    requestedBy: string
    retries: number
    startedAt: string
    status: string
    type: string
  }>
  recoveryActions: Array<{
    id: string
    label: string
  }>
  snapshots: Array<{
    ageMinutes: number
    dependencies: string[]
    durationMs: number
    error: string
    generatedAt: string
    id: string
    label: string
    recordCount: number
    status: string
    version: string
  }>
  version: string
}

export async function getSession(options: ApiOptions = {}): Promise<AuthSession> {
  const payload = await postRequest('session', options, {})
  const record = asRecord(payload)

  return {
    authenticated: getBoolean(record, 'authenticated'),
    code: getString(record, 'code'),
    diagnostics: getRecord(record, 'diagnostics'),
    error: getString(record, 'error'),
    oauthConfigured: getBoolean(record, 'oauthConfigured'),
    permissions: normalizeBooleanRecord(getRecord(record, 'permissions')),
    stage: getString(record, 'stage'),
    user: normalizePortalUser(getRecord(record, 'user')),
  }
}

export async function getSettings(
  options: ApiOptions = {},
): Promise<PortalSettings> {
  if (settingsCache) {
    return settingsCache
  }

  settingsRequest ??= request('settings', options)
    .then((payload) =>
      normalizeSettings(getRecord(asRecord(payload), 'settings')),
    )
    .then((settings) => {
      settingsCache = settings
      return settings
    })
    .finally(() => {
      settingsRequest = null
    })

  return settingsRequest
}

export async function updateProfile(
  params: Record<string, string>,
  options: ApiOptions = {},
): Promise<void> {
  await postRequest('updateProfile', options, params)
}

export async function heartbeat(
  params: { lastPage: string },
  options: ApiOptions = {},
): Promise<void> {
  await postRequest('heartbeat', options, params)
}

export async function getSearchIndex(
  options: ApiOptions = {},
): Promise<SearchData> {
  const payload = await request('searchIndex', options)
  const record = asRecord(payload)

  return {
    armyLists: getArray(record, 'armyLists') as SearchData['armyLists'],
    factions: getArray(record, 'factions') as SearchData['factions'],
    games: getArray(record, 'games') as SearchData['games'],
    missions: getArray(record, 'missions') as SearchData['missions'],
    players: getArray(record, 'players') as SearchData['players'],
  }
}

export async function getNotifications(
  options: ApiOptions = {},
): Promise<LeagueNotification[]> {
  const payload = await request('notifications', options)
  return getArray(asRecord(payload), 'notifications').map((item) => {
    const record = asRecord(item)

    return {
      body: getString(record, 'body'),
      id: getString(record, 'id'),
      link: getString(record, 'link'),
      priority: getString(record, 'priority'),
      read: getBoolean(record, 'read'),
      timestamp: formatNotificationTimestamp(record.timestamp),
      title: getString(record, 'title'),
      type: getString(record, 'type'),
      unread: getBoolean(record, 'unread'),
    }
  })
}

export async function updateNotificationState(
  params: {
    notificationId: string
    notificationIds?: string[]
    state: 'archived' | 'dismissed' | 'read'
  },
  options: ApiOptions = {},
): Promise<void> {
  await postRequest('notificationState', options, {
    notificationId: params.notificationId,
    notificationIds: JSON.stringify(params.notificationIds ?? []),
    state: params.state,
  })
}

export async function getPlatformReliability(
  options: ApiOptions = {},
): Promise<PlatformReliabilityData> {
  const payload = await request('reliability', options)
  return getRecord(asRecord(payload), 'reliability') as PlatformReliabilityData
}

export async function runReliabilityAction(
  reliabilityAction: string,
  target: string,
  options: ApiOptions = {},
): Promise<PlatformReliabilityData> {
  const payload = await postRequest('reliabilityAction', options, {
    reliabilityAction,
    target,
  })

  return getRecord(asRecord(payload), 'reliability') as PlatformReliabilityData
}

function normalizePortalUser(record: Record<string, unknown>): PortalUser {
  return {
    archivedAlerts: getStringArray(record, 'archivedAlerts'),
    avatarUrl: getString(record, 'avatarUrl'),
    created: getString(record, 'created'),
    dismissedAlerts: getStringArray(record, 'dismissedAlerts'),
    displayName: getString(record, 'displayName') || 'Guest',
    email: getString(record, 'email'),
    enabled: getBoolean(record, 'enabled'),
    favoriteFaction: getString(record, 'favoriteFaction'),
    lastLogin: getString(record, 'lastLogin'),
    lastPage: getString(record, 'lastPage'),
    lastSeen: getString(record, 'lastSeen'),
    leagueDivision: getString(record, 'leagueDivision'),
    leaguePlayer: getString(record, 'leaguePlayer'),
    notificationPreferences: getRecord(record, 'notificationPreferences'),
    playerDisplayName: getString(record, 'playerDisplayName'),
    readAlerts: getStringArray(record, 'readAlerts'),
    role: (getString(record, 'role') || 'Guest') as PortalUser['role'],
    searchHistory: getStringArray(record, 'searchHistory'),
    themePreference: getString(record, 'themePreference') || 'system',
  }
}

function normalizeSettings(record: Record<string, unknown>): PortalSettings {
  return {
    bannerImage: getString(record, 'bannerImage'),
    commissionerContact: getString(record, 'commissionerContact'),
    commissionerEmails: getString(record, 'commissionerEmails'),
    currentSeason: getString(record, 'currentSeason'),
    deploymentUrl: getString(record, 'deploymentUrl'),
    discordInvite: getString(record, 'discordInvite'),
    gitCommit: getString(record, 'gitCommit'),
    googleFormUrl: getString(record, 'googleFormUrl'),
    googleOAuthClientId: getString(record, 'googleOAuthClientId'),
    leagueLogo: getString(record, 'leagueLogo'),
    leagueName: getString(record, 'leagueName') || 'Lobo Infinity League',
    leagueWebsite: getString(record, 'leagueWebsite'),
    portalVersion: getString(record, 'portalVersion'),
    registrationOpen: getString(record, 'registrationOpen'),
    seasonEndDate: getString(record, 'seasonEndDate'),
    seasonStartDate: getString(record, 'seasonStartDate'),
    submissionButtonText:
      getString(record, 'submissionButtonText') || 'Submit Match',
    submissionButtonVisible:
      getString(record, 'submissionButtonVisible') || 'true',
    submissionEnabled: getString(record, 'submissionEnabled') || 'true',
    themeAccentColor: getString(record, 'themeAccentColor'),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function getRecord(record: Record<string, unknown>, key: string) {
  return asRecord(record[key])
}

function getArray(record: Record<string, unknown>, key: string): unknown[] {
  return Array.isArray(record[key]) ? (record[key] as unknown[]) : []
}

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function getBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}

function getStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]

  if (Array.isArray(value)) {
    return value.map(String)
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  return []
}

function normalizeBooleanRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value === true]),
  )
}
