import type { ArmyIntelligenceDecodedEntry, ArmyIntelligenceList } from './api'

export type TacticalCategoryId = 'apex' | 'competent' | 'hacking' | 'valuableAro' | 'disposableAro' | 'alternative' | 'defensive'

export type TacticalProfile = {
  badges: string[]
  bs: number | null
  equipment: string[]
  listCount: number
  percentage: number
  profile: string
  profileId: string
  unit: string
  weapons: Array<{ burst: number | null; effectiveBurst: number | null; name: string }>
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
  perListNetworks: Array<{ components: string[] }>
}

const aroWeapon = /(?:sniper rifle|ap sniper rifle|multi sniper rifle|viral sniper rifle|plasma sniper rifle|missile launcher|portable autocannon|panzerfaust|flammenspeer|heavy rocket launcher|feuerbach)/i
const alternativeSkill = /^(?:parachutist|combat jump|hidden deployment|impersonation)(?:\s*[\[(].*[\])])?$/i
const defensiveSkill = /^(?:camouflage|decoy|minelayer)(?:\s*[\[(].*[\])])?$/i
const enhancement = /^(?:mimetism|multispectral visor|msv)(?:\s+(?:l|level)\s*\d+)?(?:\s*[\[(].*[\])])?$|^bs attack\s*\(\s*-3\s*\)$/i
const gunfighterEnhancement = /^(?:mimetism|albedo)\s*[\[(]\s*-(?:3|6)\s*[\])]$|^(?:multispectral visor|msv)(?:\s+(?:l|level))?\s*[123]$|^bs attack\s*[\[(]\s*-3\s*[\])]$/i
const valuableAroSkill = /^(?:total reaction|neurocinetics)$|^bs attack\s*[\[(]\s*\+\s*(?:1\s*)?sd\s*[\])]$/i
const deliveryEquipment = /^(?:pitcher|fast\s*-?\s*panda|deployable\s*-?\s*repeater)$/i
const hackingDevice = /^(?:hacking device(?: plus)?|killer hacking device|evo hacking device)$/i

export function buildTacticalAnalysis(lists: ArmyIntelligenceList[]): TacticalAnalysis {
  const decoded = lists.filter((list) => list.status === 'decoded' && list.decoded)
  const appearances = new Map<string, { entry: ArmyIntelligenceDecodedEntry; lists: Set<number> }>()

  decoded.forEach((list, listIndex) => {
    for (const entry of list.decoded!.combatGroups.flatMap((group) => group.entries)) {
      const key = displayedProfileKey(entry)
      const current = appearances.get(key) ?? { entry, lists: new Set<number>() }
      current.entry = mergeProfileEntries(current.entry, entry)
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
    return { components: Array.from(components).sort() }
  }).filter((row) => row.components.length > 0)

  return {
    categories: [
      category('apex', 'Apex Gunfighters', 'Effective B5; BS 14+ with effective B4+; or BS 13 with effective B4+ plus MSV 1–3, Mimetism (-3/-6), BS Attack (-3), or Albedo (-3/-6).', (entry) => {
        const enhanced = entry.skills.some((skill) => gunfighterEnhancement.test(normalize(skill)))
        return effectiveWeapons(entry).some((weapon) => weapon.burst !== null && (weapon.burst >= 5 || (Number(entry.bs) >= 14 && weapon.burst >= 4) || (Number(entry.bs) === 13 && weapon.burst >= 4 && enhanced)))
      }, hasApexMetadata ? undefined : 'BS and canonical weapon Burst are unavailable in this decoded sample, so no profile can be verified.'),
      category('competent', 'Competent Gunfighters', 'BS 12 or 13 profiles with an effective Burst 4 weapon, including BS Attack (+Burst).', (entry) => (Number(entry.bs) === 12 || Number(entry.bs) === 13) && effectiveWeapons(entry).some((weapon) => weapon.burst === 4), hasApexMetadata ? undefined : 'BS and canonical weapon Burst are unavailable in this decoded sample, so no profile can be verified.'),
      category('hacking', 'Hacking Networks', 'Exact Hacker profiles, Hacking Devices, and verified repeater-delivery equipment.', (entry) => hackingComponents(entry).length > 0),
      category('valuableAro', 'Valuable ARO Pieces', '15+ point profiles with Total Reaction, Neurocinetics, or BS Attack (+SD), armed with an approved ARO weapon.', (entry) => entry.points >= 15 && entry.skills.some((skill) => valuableAroSkill.test(normalize(skill))) && canonicalWeapons(entry).some((weapon) => aroWeapon.test(normalize(weapon.name)))),
      category('disposableAro', 'Disposable ARO Pieces', '14-point-or-less profiles armed with an approved ARO weapon or Flash Pulse.', (entry) => entry.points <= 14 && canonicalWeapons(entry).some((weapon) => aroWeapon.test(normalize(weapon.name)) || /^flash pulse$/i.test(normalize(weapon.name)))),
      category('alternative', 'Alternative Attack Vectors', 'Profiles with Parachutist, Combat Jump, Hidden Deployment, or Impersonation; Netrods and Imetrons are excluded.', (entry) => !excludedAlternativeAttackVector(entry.unit) && entry.skills.some((skill) => alternativeSkill.test(normalize(skill)))),
      category('defensive', 'Defensive Network', 'Profiles with Camouflage, Decoy, or Minelayer; Mimetism alone does not qualify.', (entry) => entry.skills.some((skill) => defensiveSkill.test(normalize(skill)))),
    ],
    hackerListCount: hackerLists.size,
    listCount: decoded.length,
    mode: decoded.length < 3 ? 'Observed Capabilities' : 'Submitted-List Trends',
    perListNetworks: decoded.length < 3 ? perListNetworks : [],
  }
}

function excludedAlternativeAttackVector(unitName: string) {
  return /^(?:netrods?|imetrons?)(?:\s|$)/i.test(normalize(unitName))
}

function toProfile(entry: ArmyIntelligenceDecodedEntry, listCount: number, denominator: number): TacticalProfile {
  const skills = entry.skills.map(normalize).filter((skill) => alternativeSkill.test(skill) || defensiveSkill.test(skill) || enhancement.test(skill) || valuableAroSkill.test(skill) || bsAttackBurstBonus([skill]) > 0)
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
    weapons: normalizedWeapons(entry).map((weapon) => ({ ...weapon, effectiveBurst: weapon.burst === null ? null : weapon.burst + bsAttackBurstBonus(entry.skills) })),
  }
}

function canonicalWeapons(entry: ArmyIntelligenceDecodedEntry) {
  return entry.weaponProfiles?.map((weapon) => ({ name: normalize(weapon.name), burst: finiteOrNull(weapon.burst), burstStatus: weapon.burstStatus || 'unknown' })) || []
}

function effectiveWeapons(entry: ArmyIntelligenceDecodedEntry) {
  const bonus = bsAttackBurstBonus(entry.skills)
  return canonicalWeapons(entry).filter((weapon) => weapon.burstStatus === 'canonical').map((weapon) => ({ ...weapon, burst: weapon.burst === null ? null : weapon.burst + bonus }))
}

function bsAttackBurstBonus(skills: string[]) {
  for (const skill of skills) {
    const match = normalize(skill).match(/^bs attack\s*[\[(]\s*\+\s*(?:(\d+)\s*)?(?:b|burst)\s*[\])]$/i)
    if (match) return Number(match[1] || 1)
  }
  return 0
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

function displayedProfileKey(entry: ArmyIntelligenceDecodedEntry) {
  return `${normalize(entry.unit).toLowerCase()}::${normalize(entry.profile || entry.unit).toLowerCase()}`
}

function mergeProfileEntries(left: ArmyIntelligenceDecodedEntry, right: ArmyIntelligenceDecodedEntry): ArmyIntelligenceDecodedEntry {
  const weaponProfiles = [...(left.weaponProfiles || []), ...(right.weaponProfiles || [])].filter((weapon, index, values) => values.findIndex((candidate) => normalize(candidate.name).toLowerCase() === normalize(weapon.name).toLowerCase() && normalize(candidate.mode).toLowerCase() === normalize(weapon.mode).toLowerCase() && candidate.burst === weapon.burst) === index)
  const verified = [left.fireteamEligibility, right.fireteamEligibility].find((value) => value?.state === 'verified')
    || [left.fireteamEligibility, right.fireteamEligibility].find((value) => value?.state === 'verified-false')
    || left.fireteamEligibility
    || right.fireteamEligibility
  return {
    ...left,
    bs: left.bs ?? right.bs ?? null,
    canonicalProfile: left.canonicalProfile || right.canonicalProfile,
    canonicalSource: left.canonicalSource || right.canonicalSource,
    equipment: unique([...left.equipment, ...right.equipment]),
    fireteamEligibility: verified,
    points: left.points || right.points,
    skills: unique([...left.skills, ...right.skills]),
    weapons: unique([...left.weapons, ...right.weapons]),
    weaponProfiles,
  }
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
