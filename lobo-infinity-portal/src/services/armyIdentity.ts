import {
  CANONICAL_ARMY_REGISTRY,
  type ArmyRegistryEntry,
  type ArmyType,
} from '../config/armies.ts'

export type ArmyIdentity = {
  aliases: readonly string[]
  displayName: string
  iconKey: string
  id: string
  parentFactionId: string
  parentFactionName: string
  registryEntry: ArmyRegistryEntry
  type: ArmyType
}

const armyIdentityByKey = new Map<string, ArmyRegistryEntry>()
const armyIdentityByName = new Map<string, ArmyRegistryEntry>()
const activeArmyIdentities = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)

CANONICAL_ARMY_REGISTRY.forEach((army) => {
  armyIdentityByName.set(army.name, army)
  getArmyRegistryIdentityValues(army).forEach((value) => {
    const key = normalizeArmyIdentityKey(value)

    if (key && !armyIdentityByKey.has(key)) {
      armyIdentityByKey.set(key, army)
    }
  })
})

export function resolveArmyIdentity(value: string | null | undefined): ArmyIdentity | null {
  const key = normalizeArmyIdentityKey(value)
  const registryEntry = key ? armyIdentityByKey.get(key) : null

  if (!registryEntry) {
    return null
  }

  const parentEntry = armyIdentityByName.get(registryEntry.parentFaction)
  const parentFactionId = parentEntry?.id || normalizeArmyIdentityKey(registryEntry.parentFaction)

  return {
    aliases: registryEntry.aliases || [],
    displayName: registryEntry.name,
    iconKey: registryEntry.name,
    id: registryEntry.id,
    parentFactionId,
    parentFactionName: registryEntry.parentFaction,
    registryEntry,
    type: registryEntry.type,
  }
}

export function getCanonicalArmyName(value: string | null | undefined) {
  return resolveArmyIdentity(value)?.displayName || ''
}

export function normalizeArmyForDisplay(value: string | null | undefined) {
  return getCanonicalArmyName(value) || String(value || '').trim()
}

export function getArmyParentFaction(value: string | null | undefined) {
  return resolveArmyIdentity(value)?.parentFactionName || ''
}

export function getCanonicalArmyOptions() {
  return activeArmyIdentities.map((army) => army.name)
}

export function getCanonicalParentFactionOptions() {
  return Array.from(new Set(CANONICAL_ARMY_REGISTRY.map((army) => army.parentFaction)))
}

export function getArmiesForParent(parentFaction: string) {
  const identity = resolveArmyIdentity(parentFaction)
  const parentFactionName = identity?.parentFactionName || normalizeArmyForDisplay(parentFaction)

  if (!parentFactionName) {
    return getCanonicalArmyOptions()
  }

  return activeArmyIdentities
    .filter((army) => army.parentFaction === parentFactionName)
    .map((army) => army.name)
}

export function normalizeArmyIdentityKey(value: string | null | undefined) {
  return String(value || '')
    .replace(/\s*\(\d+\s+games?\)\s*$/i, '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getArmyRegistryIdentityValues(army: ArmyRegistryEntry) {
  return [
    army.id,
    army.name,
    ...(army.aliases || []),
  ]
}
