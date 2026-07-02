import type { CSSProperties } from 'react'
import type { DivisionKey } from '../types/dashboard'

export type DivisionIdentity = {
  accent: string
  icon: string
  key: DivisionKey
  label: string
  shortLabel: string
}

const identities: Record<DivisionKey, DivisionIdentity> = {
  main: {
    accent: '#C1121F',
    icon: '👑',
    key: 'main',
    label: 'Main Man',
    shortLabel: 'Main Man',
  },
  pga: {
    accent: '#3A86FF',
    icon: '⚔',
    key: 'pga',
    label: 'Proving Grounds A',
    shortLabel: 'PGA',
  },
  pgb: {
    accent: '#2DC653',
    icon: '🛡',
    key: 'pgb',
    label: 'Proving Grounds B',
    shortLabel: 'PGB',
  },
}

export function getDivisionIdentity(
  division: DivisionKey | string | undefined,
): DivisionIdentity {
  if (division === 'pga' || division === 'Proving Grounds A') {
    return identities.pga
  }

  if (division === 'pgb' || division === 'Proving Grounds B') {
    return identities.pgb
  }

  return identities.main
}

export function getDivisionStyle(
  division: DivisionKey | string | undefined,
): CSSProperties {
  return {
    '--division-accent': getDivisionIdentity(division).accent,
  } as CSSProperties
}

export function formatDivisionLabel(
  division: DivisionKey | string | undefined,
) {
  const identity = getDivisionIdentity(division)
  return `${identity.icon} ${identity.label}`
}
