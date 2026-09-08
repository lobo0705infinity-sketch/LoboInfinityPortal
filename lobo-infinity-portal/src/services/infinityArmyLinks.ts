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

export function isMobileOrTabletDevice() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  return navigator.maxTouchPoints > 1
    || /Android|iPad|iPhone|iPod|Mobile|Tablet/i.test(navigator.userAgent)
    || window.matchMedia?.('(pointer: coarse)').matches === true
}

export function decodeInfinityArmyCode(armyCode: string | undefined, href: string) {
  const encoded = String(armyCode || '').trim() || extractArmyCodeFromHref(href)
  try { return decodeURIComponent(encoded) } catch { return encoded }
}

export function getInfinityArmyAppUrl() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
    ? 'intent://open#Intent;scheme=infinityarmy;package=com.infinityarmy;end'
    : 'infinityarmy://'
}

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

function extractArmyCodeFromHref(href: string) {
  try {
    const url = new URL(href, typeof window === 'undefined' ? 'https://infinitytheuniverse.com' : window.location.href)
    const marker = '/army/list/'
    const index = url.pathname.toLowerCase().indexOf(marker)
    return index === -1 ? '' : url.pathname.slice(index + marker.length)
  } catch { return '' }
}
