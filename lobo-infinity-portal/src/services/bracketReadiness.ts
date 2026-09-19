export type BracketReadinessParticipant = {
  seed: string
  status: string
}

export type BracketReadiness = {
  capacity: number
  ready: boolean
  reasons: string[]
  registeredCount: number
  registrationClosed: boolean
  seededCount: number
}

export function getDoubleEliminationBracketReadiness({
  capacity,
  eventType,
  participants,
  registrationStatus,
}: {
  capacity: number
  eventType: string
  participants: BracketReadinessParticipant[]
  registrationStatus: string
}): BracketReadiness {
  const registered = participants.filter((participant) => participant.status === 'Registered')
  const registeredCount = registered.length
  const normalizedCapacity = Number.isInteger(capacity) && capacity > 0 ? capacity : 0
  const registrationClosed = registrationStatus === 'Registration Closed'
  const seeds = registered.map((participant) => {
    const rawSeed = String(participant.seed ?? '').trim()
    return rawSeed === '' ? null : Number(rawSeed)
  })
  const validSeedValues = seeds.filter(
    (seed): seed is number =>
      seed !== null &&
      Number.isInteger(seed) &&
      seed >= 1 &&
      seed <= registeredCount,
  )
  const everyPlayerSeeded = seeds.every(
    (seed) => seed !== null && Number.isInteger(seed) && seed > 0,
  )
  const exactSeedOrder =
    registeredCount > 0 &&
    validSeedValues.length === registeredCount &&
    new Set(validSeedValues).size === registeredCount &&
    validSeedValues.slice().sort((left, right) => left - right)
      .every((seed, index) => seed === index + 1)
  const reasons: string[] = []

  if (eventType !== 'Individual Double Elimination') {
    reasons.push('Bracket readiness is only available for Individual Double Elimination events.')
  }
  if (!registrationClosed) {
    reasons.push('Close registration before generating the bracket.')
  }
  if (registeredCount < 2) {
    reasons.push('At least 2 registered players are required.')
  }
  if (normalizedCapacity > 0 && registeredCount > normalizedCapacity) {
    reasons.push(`Registered players exceed the configured capacity of ${normalizedCapacity}.`)
  }
  if (registeredCount > 0 && !everyPlayerSeeded) {
    reasons.push('Every registered player must have a seed.')
  } else if (registeredCount > 0 && !exactSeedOrder) {
    reasons.push('Seeds must be unique and cover 1 through N.')
  }

  return {
    capacity: normalizedCapacity,
    ready: reasons.length === 0,
    reasons,
    registeredCount,
    registrationClosed,
    seededCount: validSeedValues.length,
  }
}
