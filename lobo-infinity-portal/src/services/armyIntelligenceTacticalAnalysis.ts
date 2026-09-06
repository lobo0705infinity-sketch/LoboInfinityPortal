import type { ArmyIntelligenceDecodedEntry, ArmyIntelligenceList } from './api'

export type TacticalCategoryId = 'apex' | 'hacking' | 'aro' | 'alternative' | 'defensive'

export type TacticalProfile = {
  badges: string[]
  bs: number | null
  equipment: string[]
  listCount: number
  percentage: number
  profile: string
  profileId: string
  unit: string
  weapons: Array<{ burst: number | null; name: string }>
  linkability: 'verified' | 'verified-false' | 'unknown'
}

export type TacticalCategory = {
  description: string
  id: TacticalCategoryId
  profiles: TacticalProfile[]
  title: string
  unavailableReason?: string
}

export type TacticalAnalysis = {
  categories: TacticalCategory[]
  hackerListCount: number
  listCount: number
  mode: 'Observed Capabilities' | 'Submitted-List Trends'
  perListNetworks: Array<{ label: string; components: string[] }>
}

const aroWeapon = /(?:sniper rifle|panzerfaust|flammenspeer|heavy rocket launcher|feuerbach)/i
const deploymentSkill = /^(?:parachutist|combat jump|hidden deployment)(?:\s*[\[(].*[\])])?$/i
const defensiveSkill = /^(?:camouflage|decoy|minelayer)(?:\s*[\[(].*[\])])?$/i
const enhancement = /^(?:mimetism|multispectral visor|msv)(?:\s+(?:l|level)\s*\d+)?(?:\s*[\[(].*[\])])?$|^bs attack\s*\(\s*-3\s*\)$/i
const deliveryEquipment = /^(?:pitcher|fast\s*-?\s*panda|deployable\s*-?\s*repeater)$/i
const hackingDevice = /^(?:hacking device(?: plus)?|killer hacking device|evo hacking device)$/i

export function buildTacticalAnalysis(lists: ArmyIntelligenceList[]): TacticalAnalysis {
  const decoded = lists.filter((list) => list.status === 'decoded' && list.decoded)
  const appearances = new Map<string, { entry: ArmyIntelligenceDecodedEntry; lists: Set<number> }>()

  decoded.forEach((list, listIndex) => {
    const seen = new Set<string>()
    for (const entry of list.decoded!.combatGroups.flatMap((group) => group.entries)) {
      const key = profileKey(entry)
      if (seen.has(key)) continue
      seen.add(key)
      const current = appearances.get(key) ?? { entry, lists: new Set<number>() }
      current.lists.add(listIndex)
      appearances.set(key, current)
    }
  })

  const rows = Array.from(appearances.values()).map(({ entry, lists: listIndexes }) => ({
    entry,
    profile: toProfile(entry, listIndexes.size, decoded.length),
  }))
  const category = (id: TacticalCategoryId, title: string, description: string, predicate: (entry: ArmyIntelligenceDecodedEntry) => boolean, unavailableReason?: string): TacticalCategory => ({
    description,
    id,
    profiles: rows.filter(({ entry }) => predicate(entry)).map(({ profile }) => profile).sort(compareProfiles),
    title,
    unavailableReason,
  })

  const hasApexMetadata = rows.some(({ entry }) => entry.bs !== null && entry.bs !== undefined && canonicalWeapons(entry).some((weapon) => weapon.burstStatus === 'canonical'))
  const hackerLists = new Set<number>()
  const perListNetworks = decoded.map((list, listIndex) => {
    const components = new Set<string>()
    for (const entry of list.decoded!.combatGroups.flatMap((group) => group.entries)) {
      if (isHacker(entry)) hackerLists.add(listIndex)
      hackingComponents(entry).forEach((item) => components.add(item))
    }
    return { label: list.decoded!.listName || `Decoded list ${listIndex + 1}`, components: Array.from(components).sort() }
  }).filter((row) => row.components.length > 0)

  return {
    categories: [
      category('apex', 'Apex Gunfighters', 'BS 13+ profiles with a canonical numeric Burst 4+ ranged weapon.', (entry) => Number(entry.bs) >= 13 && canonicalWeapons(entry).some((weapon) => weapon.burstStatus === 'canonical' && weapon.burst !== null && weapon.burst >= 4), hasApexMetadata ? undefined : 'BS and canonical weapon Burst are unavailable in this decoded sample, so no profile can be verified.'),
      category('hacking', 'Hacking Networks', 'Exact Hacker profiles, Hacking Devices, and verified repeater-delivery equipment.', (entry) => hackingComponents(entry).length > 0),
      category('aro', 'ARO Pieces', 'Profiles carrying a canonical Sniper Rifle, Panzerfaust, Flammenspeer, Heavy Rocket Launcher, or Feuerbach.', (entry) => canonicalWeapons(entry).some((weapon) => aroWeapon.test(normalize(weapon.name)))),
      category('alternative', 'Alternative Attack Vectors', 'Profiles with Parachutist, Combat Jump, or Hidden Deployment.', (entry) => entry.skills.some((skill) => deploymentSkill.test(normalize(skill)))),
      category('defensive', 'Defensive Network', 'Profiles with Camouflage, Decoy, or Minelayer; Mimetism alone does not qualify.', (entry) => entry.skills.some((skill) => defensiveSkill.test(normalize(skill)))),
    ],
    hackerListCount: hackerLists.size,
    listCount: decoded.length,
    mode: decoded.length < 3 ? 'Observed Capabilities' : 'Submitted-List Trends',
    perListNetworks: decoded.length < 3 ? perListNetworks : [],
  }
}

function toProfile(entry: ArmyIntelligenceDecodedEntry, listCount: number, denominator: number): TacticalProfile {
  const skills = entry.skills.map(normalize).filter((skill) => deploymentSkill.test(skill) || defensiveSkill.test(skill) || enhancement.test(skill))
  return {
    badges: unique([...skills, ...hackingComponents(entry)]),
    bs: entry.bs ?? null,
    equipment: entry.equipment.filter((item) => deliveryEquipment.test(normalize(item)) || hackingDevice.test(normalize(item))),
    linkability: entry.fireteamEligibility?.state === 'verified' ? 'verified' : entry.fireteamEligibility?.state === 'verified-false' ? 'verified-false' : 'unknown',
    listCount,
    percentage: denominator ? (listCount / denominator) * 100 : 0,
    profile: entry.profile || entry.unit,
    profileId: profileKey(entry),
    unit: entry.unit || entry.profile,
    weapons: normalizedWeapons(entry),
  }
}

function canonicalWeapons(entry: ArmyIntelligenceDecodedEntry) {
  return entry.weaponProfiles?.map((weapon) => ({ name: normalize(weapon.name), burst: finiteOrNull(weapon.burst), burstStatus: weapon.burstStatus || 'unknown' })) || []
}

function normalizedWeapons(entry: ArmyIntelligenceDecodedEntry) {
  if (entry.weaponProfiles?.length) return canonicalWeapons(entry)
  return []
}

function hackingComponents(entry: ArmyIntelligenceDecodedEntry) {
  const devices = entry.equipment.filter((item) => hackingDevice.test(normalize(item))).map(normalize)
  const delivery = [...entry.equipment, ...entry.weapons].filter((item) => deliveryEquipment.test(normalize(item))).map(normalize)
  return unique([...(isHacker(entry) ? ['Hacker'] : []), ...devices, ...delivery])
}

function isHacker(entry: ArmyIntelligenceDecodedEntry) {
  return entry.hacker || entry.skills.some((skill) => /^hacker(?:\s|$)/i.test(normalize(skill))) || entry.equipment.some((item) => hackingDevice.test(normalize(item)))
}

function profileKey(entry: ArmyIntelligenceDecodedEntry) {
  return [entry.combinedId, normalize(entry.unit), normalize(entry.profile), normalizedWeapons(entry).map((weapon) => `${weapon.name}:${weapon.burst ?? '?'}`).join('|'), entry.skills.map(normalize).join('|'), entry.equipment.map(normalize).join('|')].join('::')
}

function compareProfiles(left: TacticalProfile, right: TacticalProfile) {
  return (right.linkability === 'verified' ? 1 : 0) - (left.linkability === 'verified' ? 1 : 0) || right.listCount - left.listCount || right.badges.length - left.badges.length || (right.bs ?? -1) - (left.bs ?? -1) || left.unit.localeCompare(right.unit) || left.profile.localeCompare(right.profile)
}

function normalize(value: unknown) {
  return String(value ?? '').normalize('NFKC').replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ').trim()
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function finiteOrNull(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}
