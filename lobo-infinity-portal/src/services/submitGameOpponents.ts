import type {
  EventHomeData,
  EventRegistrationEntry,
  SearchData,
} from './api'

export type SubmitGameOpponentOption = {
  label: string
  meta?: string
  value: string
}

export type SubmitGameOpponentExclusion = {
  division: string
  player: string
  reason: string
  status: string
}

export type SubmitGameOpponentResolution = {
  currentRegistration: EventRegistrationEntry | null
  exclusions: SubmitGameOpponentExclusion[]
  options: SubmitGameOpponentOption[]
  participantCount: number
  resolvedDivision: string
}

export function buildSubmitGamePlayerOptions(
  searchIndex: SearchData | null,
): SubmitGameOpponentOption[] {
  const seen = new Map<string, SubmitGameOpponentOption>()

  searchIndex?.players.forEach((division) => {
    division.standings.forEach((player) => {
      const value = player.player.trim()
      if (!value) {
        return
      }

      const key = normalizeSubmitGameValue(value)
      if (seen.has(key)) {
        return
      }

      seen.set(key, {
        label: player.displayName || value,
        meta: division.divisionLabel,
        value,
      })
    })
  })

  return Array.from(seen.values()).sort((left, right) =>
    left.label.localeCompare(right.label),
  )
}

export function buildSubmitGameOpponentOptions({
  allPlayers,
  currentPlayer,
  currentPlayerDivision,
  eventHome,
  showAllPlayers,
  tournamentRegistrations,
}: {
  allPlayers: SubmitGameOpponentOption[]
  currentPlayer: string
  currentPlayerDivision: string
  eventHome: EventHomeData | null
  showAllPlayers: boolean
  tournamentRegistrations?: EventRegistrationEntry[]
}) {
  return buildSubmitGameOpponentResolution({
    allPlayers,
    currentPlayer,
    currentPlayerDivision,
    eventHome,
    showAllPlayers,
    tournamentRegistrations,
  }).options
}

export function buildSubmitGameOpponentResolution({
  allPlayers,
  currentPlayer,
  currentPlayerDivision,
  currentUserEmail = '',
  eventHome,
  showAllPlayers,
  tournamentRegistrations,
}: {
  allPlayers: SubmitGameOpponentOption[]
  currentPlayer: string
  currentPlayerDivision: string
  currentUserEmail?: string
  eventHome: EventHomeData | null
  showAllPlayers: boolean
  tournamentRegistrations?: EventRegistrationEntry[]
}): SubmitGameOpponentResolution {
  const registrations = eventHome?.registration.registrations ?? []
  const currentRegistration =
    eventHome?.registration.currentPlayer ??
    findCurrentRegistration(registrations, currentPlayer, currentUserEmail)

  if (showAllPlayers) {
    const options = allPlayers.filter((option) => !sameSubmitGameValue(option.value, currentPlayer))
    return {
      currentRegistration,
      exclusions: [],
      options,
      participantCount: registrations.length,
      resolvedDivision: '',
    }
  }

  const eventType = eventHome?.event.type ?? ''

  if (isTournamentEventType(eventType)) {
    const options = buildTournamentOpponentOptions(
      tournamentRegistrations ?? registrations,
      currentPlayer,
      currentRegistration,
    )

    return {
      currentRegistration,
      exclusions: [],
      options,
      participantCount: tournamentRegistrations?.length ?? registrations.length,
      resolvedDivision: '',
    }
  }

  return buildLeagueOpponentResolution(
    eventHome,
    allPlayers,
    currentPlayer,
    currentPlayerDivision,
    currentRegistration,
  )
}

export function isTournamentEventType(eventType: string) {
  const normalized = normalizeSubmitGameValue(eventType)
  return normalized.includes('tournament')
}

function buildTournamentOpponentOptions(
  registrations: EventRegistrationEntry[],
  currentPlayer: string,
  currentRegistration: EventRegistrationEntry | null,
) {
  return registrations
    .filter((entry) => !isSamePlayerRegistration(entry, currentPlayer, currentRegistration))
    .filter((entry) => isActiveTournamentRegistration(entry.status))
    .map((entry) => ({
      label: entry.displayName || entry.player,
      meta: [
        entry.team || entry.preferredTeam || '',
        entry.faction || '',
      ].filter(Boolean).join(' - '),
      value: entry.player,
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function buildLeagueOpponentResolution(
  eventHome: EventHomeData | null,
  allPlayers: SubmitGameOpponentOption[],
  currentPlayer: string,
  currentPlayerDivision: string,
  currentRegistration: EventRegistrationEntry | null,
): SubmitGameOpponentResolution {
  const currentDivision = resolveLeagueDivision(
    currentRegistration?.notes,
    currentPlayerDivision,
    getPlayerRegistryDivision(allPlayers, currentRegistration?.player ?? ''),
    getPlayerRegistryDivision(allPlayers, currentRegistration?.displayName ?? ''),
    getPlayerRegistryDivision(allPlayers, currentPlayer),
  )
  const scheduledOpponent = eventHome?.playerStatus.upcomingMatch ?? ''
  const exclusions: SubmitGameOpponentExclusion[] = []
  const registrations = eventHome?.registration.registrations ?? []
  const options = registrations
    .flatMap((entry) => {
      const entryDivision = resolveLeagueDivision(
        entry.notes,
        getPlayerRegistryDivision(allPlayers, entry.player),
        getPlayerRegistryDivision(allPlayers, entry.displayName),
      )
      const excludedStatus = ['deleted', 'removed', 'withdrawn'].includes(normalizeSubmitGameValue(entry.status))

      if (isSamePlayerRegistration(entry, currentPlayer, currentRegistration)) {
        exclusions.push({
          division: entryDivision,
          player: entry.player,
          reason: 'self',
          status: entry.status,
        })
        return []
      }

      if (excludedStatus) {
        exclusions.push({
          division: entryDivision,
          player: entry.player,
          reason: 'inactive-status',
          status: entry.status,
        })
        return []
      }

      if (!currentDivision || entryDivision !== currentDivision) {
        exclusions.push({
          division: entryDivision,
          player: entry.player,
          reason: currentDivision ? 'different-division' : 'current-division-unresolved',
          status: entry.status,
        })
        return []
      }

      return [{
        label: entry.displayName || entry.player,
        meta: [
          'Same division',
          entry.team || entry.preferredTeam || '',
          entry.faction || '',
        ].filter(Boolean).join(' - '),
        value: entry.player,
      }]
    })

  const sortedOptions = options.sort((left, right) => {
    const leftScheduled = isScheduledOpponent(left, scheduledOpponent) ? 0 : 1
    const rightScheduled = isScheduledOpponent(right, scheduledOpponent) ? 0 : 1
    return leftScheduled - rightScheduled || left.label.localeCompare(right.label)
  })

  return {
    currentRegistration,
    exclusions,
    options: sortedOptions,
    participantCount: registrations.length,
    resolvedDivision: currentDivision,
  }
}

function isActiveTournamentRegistration(status: string) {
  return !['deleted', 'removed', 'withdrawn'].includes(normalizeSubmitGameValue(status))
}

function getPlayerRegistryDivision(
  players: SubmitGameOpponentOption[],
  player: string,
) {
  return players.find((option) => (
    sameSubmitGameValue(option.value, player) ||
    sameSubmitGameValue(option.label, player)
  ))?.meta ?? ''
}

function findCurrentRegistration(
  registrations: EventRegistrationEntry[],
  currentPlayer: string,
  currentUserEmail: string,
) {
  const playerKey = normalizeSubmitGameValue(currentPlayer)
  const emailKey = normalizeSubmitGameValue(currentUserEmail)

  return registrations.find((entry) => {
    const candidates = [
      entry.player,
      entry.displayName,
      entry.email,
    ].map(normalizeSubmitGameValue)

    return (
      (playerKey !== '' && candidates.includes(playerKey)) ||
      (emailKey !== '' && candidates.includes(emailKey))
    )
  }) ?? null
}

function isSamePlayerRegistration(
  entry: EventRegistrationEntry,
  currentPlayer: string,
  currentRegistration: EventRegistrationEntry | null,
) {
  const candidates = [
    currentPlayer,
    currentRegistration?.player ?? '',
    currentRegistration?.displayName ?? '',
    currentRegistration?.email ?? '',
  ]

  return candidates.some((candidate) => (
    candidate !== '' &&
    (
      sameSubmitGameValue(entry.player, candidate) ||
      sameSubmitGameValue(entry.displayName, candidate) ||
      sameSubmitGameValue(entry.email, candidate)
    )
  ))
}

function resolveLeagueDivision(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizeDivision(value)

    if (normalized) {
      return normalized
    }
  }

  return ''
}

function normalizeDivision(value: string | undefined) {
  const normalized = normalizeSubmitGameValue(value ?? '')
  const compact = normalized.replace(/[^a-z0-9]+/g, '')

  if (!normalized) {
    return ''
  }

  if (compact === 'main' || compact.includes('mainman') || compact.includes('main')) {
    return 'main'
  }

  if (
    compact === 'pga' ||
    compact.includes('provinggroundsa') ||
    compact.includes('provinggrounda')
  ) {
    return 'pga'
  }

  if (
    compact === 'pgb' ||
    compact.includes('provinggroundsb') ||
    compact.includes('provinggroundb')
  ) {
    return 'pgb'
  }

  return normalized
}

function isScheduledOpponent(
  option: SubmitGameOpponentOption,
  scheduledOpponent: string,
) {
  const scheduled = normalizeSubmitGameValue(scheduledOpponent)

  if (!scheduled) {
    return false
  }

  const value = normalizeSubmitGameValue(option.value)
  const label = normalizeSubmitGameValue(option.label)

  return scheduled === value || scheduled === label || scheduled.includes(value) || scheduled.includes(label)
}

function normalizeSubmitGameValue(value: string) {
  return value.trim().toLowerCase()
}

function sameSubmitGameValue(left: string, right: string) {
  return normalizeSubmitGameValue(left) === normalizeSubmitGameValue(right)
}
