import catalog from '../src/data/profile-audit.json' with { type: 'json' }
import { mobilityKey } from './mobility-lookup.mjs'
export function repairArmyProfile(entry) {
  const key = mobilityKey(entry.combinedId)
  const index = key ? catalog.keys[key] : undefined
  if (index === undefined) return entry
  const record = catalog.profiles[index]
  const memberships = catalog.memberships[record.m]
  const weaponProfiles = record.w.map(index => catalog.weapons[index])
  const weapons = [...new Set(weaponProfiles.map(w => w.name + (w.modifiers.length ? ` (${w.modifiers.join(', ')})` : '')))]
  const teams = [...new Set(memberships.map(m => m.team))]
  return { ...entry, weapons, weaponProfiles, fireteamEligibility: { state: teams.length ? 'verified' : 'verified-false', verified: !!teams.length, teams, memberships } }
}
export function repairArmyList(list) {
  if (!list.decoded) return list
  return { ...list, decoded: { ...list.decoded, combatGroups: list.decoded.combatGroups.map(group => ({ ...group, entries: group.entries.map(repairArmyProfile) })) } }
}
