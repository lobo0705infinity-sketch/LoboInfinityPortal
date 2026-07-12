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
  if (showAllPlayers) {
    return allPlayers.filter((option) => !sameSubmitGameValue(option.value, currentPlayer))
  }

  const eventType = eventHome?.event.type ?? ''

  if (isTournamentEventType(eventType)) {
    return buildTournamentOpponentOptions(
      tournamentRegistrations ?? eventHome?.registration.registrations ?? [],
      currentPlayer,
    )
  }

  return buildLeagueOpponentOptions(
    eventHome,
    allPlayers,
    currentPlayer,
    currentPlayerDivision,
  )
}

export function isTournamentEventType(eventType: string) {
  const normalized = normalizeSubmitGameValue(eventType)
  return normalized.includes('tournament')
}

function buildTournamentOpponentOptions(
  registrations: EventRegistrationEntry[],
  currentPlayer: string,
) {
  return registrations
    .filter((entry) => !sameSubmitGameValue(entry.player, currentPlayer))
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

function buildLeagueOpponentOptions(
  eventHome: EventHomeData | null,
  allPlayers: SubmitGameOpponentOption[],
  currentPlayer: string,
  currentPlayerDivision: string,
) {
  const currentRegistration = eventHome?.registration.currentPlayer
  const currentDivision = resolveLeagueDivision(
    currentPlayerDivision,
    currentRegistration?.notes,
    getPlayerRegistryDivision(allPlayers, currentPlayer),
  )
  const scheduledOpponent = eventHome?.playerStatus.upcomingMatch ?? ''
  const options = (eventHome?.registration.registrations ?? [])
    .filter((entry) => !sameSubmitGameValue(entry.player, currentPlayer))
    .filter((entry) => !['deleted', 'removed', 'withdrawn'].includes(normalizeSubmitGameValue(entry.status)))
    .filter((entry) => {
      const entryDivision = resolveLeagueDivision(
        entry.notes,
        getPlayerRegistryDivision(allPlayers, entry.player),
      )

      return currentDivision !== '' && entryDivision === currentDivision
    })
    .map((entry) => ({
      label: entry.displayName || entry.player,
      meta: [
        'Same division',
        entry.team || entry.preferredTeam || '',
        entry.faction || '',
      ].filter(Boolean).join(' - '),
      value: entry.player,
    }))

  return options.sort((left, right) => {
    const leftScheduled = isScheduledOpponent(left, scheduledOpponent) ? 0 : 1
    const rightScheduled = isScheduledOpponent(right, scheduledOpponent) ? 0 : 1
    return leftScheduled - rightScheduled || left.label.localeCompare(right.label)
  })
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

  if (!normalized) {
    return ''
  }

  if (normalized === 'main' || normalized.includes('mainman') || normalized.includes('main')) {
    return 'main'
  }

  if (
    normalized === 'pga' ||
    normalized.includes('provinggroundsa') ||
    normalized.includes('provinggrounda')
  ) {
    return 'pga'
  }

  if (
    normalized === 'pgb' ||
    normalized.includes('provinggroundsb') ||
    normalized.includes('provinggroundb')
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
