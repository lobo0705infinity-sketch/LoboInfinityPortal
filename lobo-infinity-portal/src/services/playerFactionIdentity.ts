import { getArmyParentFaction } from '../config/armies.ts'
import { resolveFactionPortrait } from '../config/factionPortraits.ts'

export type PlayerFactionIdentity = {
  badgeFactionKey: string | null
  normalizedFaction: string | null
  parentFaction: string | null
  portraitPath: string | null
  rawPreferredArmy: string | null
  resolutionSource: 'preferredArmy' | 'none'
}

export type PlayerFactionIdentitySource = {
  favoriteFaction?: string | null
  preferredArmy?: string | null
}

export function resolvePlayerFactionIdentity(
  player: PlayerFactionIdentitySource,
): PlayerFactionIdentity {
  const rawPreferredArmy = readStoredPreferredArmy(player)
  const normalizedFaction = normalizeStoredPreferredArmy(rawPreferredArmy)

  if (!normalizedFaction) {
    return {
      badgeFactionKey: null,
      normalizedFaction: null,
      parentFaction: null,
      portraitPath: null,
      rawPreferredArmy: rawPreferredArmy || null,
      resolutionSource: 'none',
    }
  }

  return {
    badgeFactionKey: normalizedFaction,
    normalizedFaction,
    parentFaction: getArmyParentFaction(normalizedFaction) || null,
    portraitPath: resolveFactionPortrait(normalizedFaction)?.src ?? null,
    rawPreferredArmy,
    resolutionSource: 'preferredArmy',
  }
}

export function formatPlayerFactionIdentityLabel(
  identity: PlayerFactionIdentity,
) {
  return identity.normalizedFaction || ''
}

function readStoredPreferredArmy(player: PlayerFactionIdentitySource) {
  return String(player.favoriteFaction ?? player.preferredArmy ?? '').trim()
}

function normalizeStoredPreferredArmy(value: string | null) {
  return String(value || '')
    .trim()
    .replace(/\s*\(\d+\s+games?\)$/i, '')
    .trim() || null
}
