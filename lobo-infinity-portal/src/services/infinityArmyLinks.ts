export type InfinityArmyTarget =
  | {
      href: string
      status: 'available'
    }
  | {
      reason: string
      status: 'invalid' | 'missing'
    }

const infinityArmyListBaseUrl = 'https://infinitytheuniverse.com/army/list/'

export function getInfinityArmyTarget(armyCode: string): InfinityArmyTarget {
  const value = armyCode.trim()

  if (!value) {
    return {
      reason: 'Army Code unavailable.',
      status: 'missing',
    }
  }

  if (value.includes('...') || value.includes('…')) {
    return {
      reason: 'Army Code is invalid.',
      status: 'invalid',
    }
  }

  if (/\s/.test(value)) {
    return {
      reason: 'Army Code is invalid.',
      status: 'invalid',
    }
  }

  try {
    const url = new URL(value)

    if (!/^https?:$/i.test(url.protocol)) {
      return {
        reason: 'Army Code is invalid.',
        status: 'invalid',
      }
    }

    return {
      href: url.toString(),
      status: 'available',
    }
  } catch {
    if (!/[A-Za-z0-9_%+/=-]{24,}/.test(value)) {
      return {
        reason: 'Army Code is invalid.',
        status: 'invalid',
      }
    }

    return {
      href: `${infinityArmyListBaseUrl}${encodeArmyCodePathSegment(value)}`,
      status: 'available',
    }
  }
}

function encodeArmyCodePathSegment(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value))
  } catch {
    return encodeURIComponent(value)
  }
}
