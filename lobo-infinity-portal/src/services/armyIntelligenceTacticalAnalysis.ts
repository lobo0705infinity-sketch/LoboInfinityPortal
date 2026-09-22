import { eligibleLevel2Teams } from '../../bot/fireteam-list-eligibility.mjs'
import { lookupMobility, type MobilityCatalog } from '../../bot/mobility-lookup.mjs'
import portalAroRatings from '../data/portal-aro-ratings.json' with { type: 'json' }
import portalGunfighterRatings from '../data/portal-gunfighter-ratings.json' with { type: 'json' }
import portalCloseCombatRatings from '../data/portal-close-combat-ratings.json' with { type: 'json' }
import mobilityCatalog from '../data/mobility-index.json' with { type: 'json' }
import type { ArmyIntelligenceDecodedEntry, ArmyIntelligenceList } from './api'

export type TacticalCategoryId = 'apex' | 'competent' | 'apexCc' | 'hacking' | 'vision' | 'valuableAro' | 'disposableAro' | 'alternative' | 'defensive'

type BenchmarkState = {
  grade: string
  percentile: number
  rating: number
  weaponsUsed: Array<{ scoreContribution: number; selections?: number; weapon: string }>
}

export type TacticalProfile = {
  badges: string[]
  bs: number | null
  cc: number | null
  equipment: string[]
  listCount: number
  percentage: number
  profile: string
  profileId: string
  unit: string
  weapons: Array<{ burst: number | null; effectiveBurst: number | null; effectiveDice: number | null; name: string }>
  aro?: { fireteam?: BenchmarkState; normal?: BenchmarkState }
  gunfighter?: { grade: string; percentile: number; rating: number; state: 'fireteam' | 'normal'; weapon: string }
  closeCombat?: { grade: string; percentile: number; rating: number; weapon: string }
  mobility?: { mov: number[] | null; score: number; travel: number | null }
  linkability: 'verified' | 'verified-false' | 'unknown'
  roles: TacticalCategoryId[]
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

const aroWeapon = /(?:sniper rifle|ap sniper rifle|multi sniper rifle|viral sniper rifle|plasma sniper rifle|missile launcher|portable autocannon|panzerfaust|flammenspeer|heavy rocket launcher|feuerbach|e mitter)/i
const alternativeSkill = /^(?:parachutist|combat jump|hidden deployment|impersonation)(?:\s*[\[(].*[\])])?$/i
const defensiveSkill = /^(?:camouflage|decoy|minelayer)(?:\s*[\[(].*[\])])?$/i
const enhancement = /^(?:mimetism|multispectral visor|msv)(?:\s+(?:l|level)\s*\d+)?(?:\s*[\[(].*[\])])?$|^bs attack\s*\(\s*-3\s*\)$/i
const gunfighterEnhancement = /^(?:mimetism|albedo)\s*[\[(]\s*-(?:3|6)\s*[\])]$|^(?:multispectral visor|msv)(?:\s+(?:l|level))?\s*[123]$|^bs attack\s*[\[(]\s*-3\s*[\])]$/i
const valuableAroSkill = /^(?:total reaction|neurocinetics)$|^bs attack\s*[\[(]\s*\+\s*(?:\d+\s*)?sd\s*[\])]$/i
const deliveryEquipment = /^(?:pitcher|fast\s*-?\s*panda|deployable\s*-?\s*repeater|repeater)$/i
const hackingDevice = /^(?:hacking device(?: plus)?|killer hacking device|evo hacking device)$/i
const visionControl = /^(?:smoke grenades?|smoke grenade launchers?|discoballer|(?:pheroware(?:\s+tactics)?|pt)\s*:?\s*(?:mirroball|mirrorball)|eclipse(?:\s+.*)?)$/i
const pheroware = /^(?:pheroware(?:\s+tactics)?|pt)(?:\s*:?\s+.*)?$/i

export function buildTacticalAnalysis(lists: ArmyIntelligenceList[]): TacticalAnalysis {
  const decoded = lists.filter((list) => list.status === 'decoded' && list.decoded)
  const appearances = new Map<string, { entry: ArmyIntelligenceDecodedEntry; lists: Set<number> }>()

  decoded.forEach((list, listIndex) => {
    const entries = withFireteamSdBonuses(list.decoded!.combatGroups.flatMap((group) => group.entries))
    for (const entry of entries) {
      const key = displayedProfileKey(entry)
      const current = appearances.get(key) ?? { entry, lists: new Set<number>() }
      current.entry = mergeProfileEntries(current.entry, entry)
      current.lists.add(listIndex)
      appearances.set(key, current)
    }
  })

  const rows = Array.from(appearances.values()).map(({ entry, lists: listIndexes }) => ({
    entry,
    profile: toProfile(entry, listIndexes.size, decoded.length, gunfighterRating(entry), closeCombatRating(entry), aroRating(entry)),
  }))
  const category = (id: TacticalCategoryId, title: string, description: string, predicate: (entry: ArmyIntelligenceDecodedEntry) => boolean, unavailableReason?: string): TacticalCategory => ({
    description,
    id,
    profiles: rows.filter(({ entry }) => predicate(entry)).map(({ profile }) => profile).sort(id === 'apex' ? compareGunfighters : id === 'apexCc' ? compareCloseCombat : id === 'valuableAro' || id === 'disposableAro' ? compareAros : compareProfiles),
    title,
    unavailableReason,
  })

  const hackerLists = new Set<number>()
  const perListNetworks = decoded.map((list, listIndex) => {
    const components = new Set<string>()
    for (const entry of withFireteamSdBonuses(list.decoded!.combatGroups.flatMap((group) => group.entries))) {
      if (isHacker(entry)) hackerLists.add(listIndex)
      hackingComponents(entry).forEach((item) => components.add(item))
    }
    return { components: Array.from(components).sort() }
  }).filter((row) => row.components.length > 0)
  const hasBenchmarkRatings = rows.some(({ profile }) => Boolean(profile.gunfighter))
  const hasAroBenchmarkRatings = rows.some(({ profile }) => Boolean(profile.aro))
  const hasCloseCombatRatings = rows.some(({ profile }) => Boolean(profile.closeCombat))
  const hasApexMetadata = rows.some(({ entry }) => entry.bs !== null && entry.bs !== undefined && canonicalWeapons(entry).some((weapon) => weapon.burstStatus === 'canonical'))
  const qualifiesAsApex = (entry: ArmyIntelligenceDecodedEntry) => {
    const enhanced = entry.skills.some((skill) => gunfighterEnhancement.test(normalize(skill)))
    return effectiveSdWeapons(entry).some((weapon) => isRangedWeapon(weapon) && apexGunfighterWeapon(weapon) && weapon.burst !== null && (weapon.burst >= 5 || (Number(entry.bs) >= 14 && weapon.burst >= 4) || (Number(entry.bs) === 13 && weapon.burst >= 4 && enhanced)))
  }
  const qualifiesAsCompetent = (entry: ArmyIntelligenceDecodedEntry) => {
    const weapons = effectiveSdWeapons(entry)
    const bs = Number(entry.bs)
    const standard = (bs === 12 || bs === 13) && weapons.some((weapon) => isRangedWeapon(weapon) && competentGunfighterWeapon(weapon) && weapon.burst !== null && weapon.burst >= 4)
    const heavyRocketLauncher = bs >= 12 && weapons.some((weapon) => isRangedWeapon(weapon) && heavyRocketLauncherWeapon(weapon) && weapon.burst !== null && weapon.burst >= 3)
    const portableAutocannonEnhancement = entry.skills.some((skill) => /^(?:mimetism\s*[[(]\s*-(?:3|6)\s*[\])]|bs attack\s*[[(]\s*-3\s*[\])])$/i.test(normalize(skill)))
    const sdBonus = bsAttackSdBonus(entry.skills) + Number(entry.fireteamSdBonus || 0)
    const portableAutocannon = portableAutocannonEnhancement && weapons.some((weapon) => isRangedWeapon(weapon) && portableAutocannonWeapon(weapon) && sdBonus + weaponSdBonus(weapon) >= 1)
    return standard || heavyRocketLauncher || portableAutocannon
  }
  const gunfighterCategories = hasBenchmarkRatings
    ? [category('apex', 'Gunfighter Rankings', 'Benchmark-ranked against the shared defensive suite. Showing Grade B or higher, with list rank, rating, grade, and global percentile.', (entry) => hasQualifyingBenchmark(gunfighterRating(entry)), 'No exact Grade B-or-better gunfighter benchmark matches were found in this sample.')]
    : [
        category('apex', 'Apex Gunfighters', 'Effective dice include native Burst, BS Attack (+Burst), native +SD, verified Fireteam +1SD, and valid combinations. Qualifies at effective B5; BS 14+ with effective B4+; or BS 13 with effective B4+ plus MSV 1–3, Mimetism (-3/-6), BS Attack (-3), or Albedo (-3/-6).', qualifiesAsApex, hasApexMetadata ? undefined : 'BS and canonical weapon Burst are unavailable in this decoded sample, so no profile can be verified.'),
        category('competent', 'Competent Gunfighters', 'BS 12 or 13 profiles whose effective dice reach 4 through an approved gunfighter weapon, BS Attack (+Burst), native +SD, Fireteam +1SD, or a combination. Heavy Rocket Launchers and enhanced Portable Autocannons use their verified special cases; Apex Gunfighters are excluded.', (entry) => !qualifiesAsApex(entry) && qualifiesAsCompetent(entry), hasApexMetadata ? undefined : 'BS and canonical weapon Burst are unavailable in this decoded sample, so no profile can be verified.'),
      ]

  const aroCategories: TacticalCategory[] = hasAroBenchmarkRatings
    ? [
        category('valuableAro', 'Valuable ARO Ratings', 'Profiles costing at least 15 points whose best valid non-linked or submitted-list Fireteam state is Grade B or higher in the current ARO benchmark.', (entry) => entry.points >= 15 && hasQualifyingAroRating(aroRating(entry)), 'No exact Grade B-or-better ARO benchmark matches were found in this sample.'),
        category('disposableAro', 'Disposable ARO Ratings', 'Profiles costing 14 points or less whose best valid non-linked or submitted-list Fireteam state is Grade B or higher in the current ARO benchmark.', (entry) => entry.points <= 14 && hasQualifyingAroRating(aroRating(entry)), 'No exact Grade B-or-better ARO benchmark matches were found in this sample.'),
      ]
    : [
        category('valuableAro', 'Valuable ARO Pieces', 'Profiles costing at least 15 points with an approved ARO weapon or Pheroware capability, plus Total Reaction, Neurocinetics, native BS Attack (+SD), weapon-specific +SD, or a verified legal Fireteam +1SD. Proxy Mk IV is an explicit exception.', (entry) => {
          const hasAroCapability = canonicalWeapons(entry).some((weapon) => aroWeapon.test(normalize(weapon.name))) || [...entry.skills, ...entry.equipment, ...entry.weapons].some((item) => pheroware.test(normalize(item)))
          const hasValuableModifier = entry.skills.some((skill) => valuableAroSkill.test(normalize(skill))) || canonicalWeapons(entry).some((weapon) => weaponSdBonus(weapon) > 0) || Number(entry.fireteamSdBonus || 0) > 0
          return isProxyMkIv(entry) || (entry.points >= 15 && hasAroCapability && hasValuableModifier)
        }),
        category('disposableAro', 'Disposable ARO Pieces', 'Profiles costing 14 points or less with an approved ARO weapon, Flash Pulse, weapon-specific +SD, or native BS Attack (+SD).', (entry) => entry.points <= 14 && (canonicalWeapons(entry).some((weapon) => aroWeapon.test(normalize(weapon.name)) || /^flash pulse$/i.test(normalize(weapon.name)) || weaponSdBonus(weapon) > 0) || bsAttackSdBonus(entry.skills) > 0)),
      ]

  const categories: TacticalCategory[] = [
      ...gunfighterCategories,
      category('apexCc', 'Close Combat Rankings', 'Benchmark-ranked against the shared close-combat defender suite. Showing Grade B or higher, with list rank, rating, grade, and global percentile.', (entry) => hasCloseCombatRatings && hasQualifyingBenchmark(closeCombatRating(entry)), 'No exact Grade B-or-better close-combat benchmark matches were found in this sample.'),
      category('hacking', 'Hacking Networks', 'Exact Hacker profiles, Hacking Devices, Repeaters, and verified repeater-delivery equipment.', (entry) => hackingComponents(entry).length > 0),
      category('vision', 'Vision Control', 'Profiles with Smoke Grenades, Smoke Grenade Launchers, Discoballer, Pheroware Mirrorball, or Eclipse.', (entry) => [...entry.skills, ...entry.equipment, ...entry.weapons].some((item) => visionControl.test(normalize(item)))),
      ...aroCategories,
      category('alternative', 'Alternative Attack Vectors', 'Profiles with Parachutist, Combat Jump, Hidden Deployment, or Impersonation; Netrods and Imetrons are excluded.', (entry) => !excludedAlternativeAttackVector(entry.unit) && entry.skills.some((skill) => alternativeSkill.test(normalize(skill)))),
      category('defensive', 'Defensive Network', 'Profiles with Camouflage, Decoy, or Minelayer; Mimetism alone does not qualify.', (entry) => entry.skills.some((skill) => defensiveSkill.test(normalize(skill)))),
    ]
  addMultiRoleMetadata(categories)
  return {
    categories,
    hackerListCount: hackerLists.size,
    listCount: decoded.length,
    mode: decoded.length < 3 ? 'Observed Capabilities' : 'Submitted-List Trends',
    perListNetworks: decoded.length < 3 ? perListNetworks : [],
  }
}

function gunfighterRating(entry: ArmyIntelligenceDecodedEntry): TacticalProfile['gunfighter'] {
  const key = String(entry.combinedId || '').replaceAll('-', ':')
  const states = (portalGunfighterRatings.ratings as Record<string, Record<string, { grade: string; percentile: number; rating: number; weaponsUsed: Array<{ weapon: string; scoreContribution: number }> }>>)[key]
  if (!states) return undefined
  const [state, rating] = Object.entries(states).sort(([, left], [, right]) => right.rating - left.rating)[0] || []
  if (!rating || (state !== 'normal' && state !== 'fireteam')) return undefined
  const weapon = [...rating.weaponsUsed].sort((left, right) => right.scoreContribution - left.scoreContribution || left.weapon.localeCompare(right.weapon))[0]?.weapon || 'No selected weapon'
  return { grade: rating.grade, percentile: rating.percentile, rating: rating.rating, state, weapon }
}

function closeCombatRating(entry: ArmyIntelligenceDecodedEntry): TacticalProfile['closeCombat'] {
  const key = String(entry.combinedId || '').replaceAll('-', ':')
  const rating = (portalCloseCombatRatings.ratings as Record<string, { grade: string; percentile: number; rating: number; weapon: string }>)[key]
  return rating ? { grade: rating.grade, percentile: rating.percentile, rating: rating.rating, weapon: rating.weapon } : undefined
}

function hasQualifyingBenchmark(rating: { grade?: string } | undefined) {
  return Boolean(rating && ['S', 'A', 'B'].includes(String(rating.grade || '').toUpperCase()))
}

function aroRating(entry: ArmyIntelligenceDecodedEntry): TacticalProfile['aro'] {
  const key = String(entry.combinedId || '').replaceAll('-', ':')
  const states = (portalAroRatings.ratings as Record<string, Record<string, BenchmarkState>>)[key]
  if (!states?.normal) return undefined
  return {
    normal: states.normal,
    ...(entry.fireteamSdBonus && states.fireteam ? { fireteam: states.fireteam } : {}),
  }
}

function hasQualifyingAroRating(rating: TacticalProfile['aro']) {
  return Boolean(rating && Object.values(rating).some((state) => ['S', 'A', 'B'].includes(String(state?.grade || '').toUpperCase())))
}

function compareGunfighters(left: TacticalProfile, right: TacticalProfile) {
  return Number(right.gunfighter?.rating || 0) - Number(left.gunfighter?.rating || 0) || compareProfiles(left, right)
}

function compareCloseCombat(left: TacticalProfile, right: TacticalProfile) {
  return Number(right.closeCombat?.rating || 0) - Number(left.closeCombat?.rating || 0) || compareProfiles(left, right)
}

function compareAros(left: TacticalProfile, right: TacticalProfile) {
  return bestAroRating(right) - bestAroRating(left) || compareProfiles(left, right)
}

function bestAroRating(profile: TacticalProfile) {
  return Math.max(...Object.values(profile.aro || {}).map((state) => Number(state?.rating ?? -1)), -1)
}

function excludedAlternativeAttackVector(unitName: string) {
  return /^(?:netrods?|imetrons?)(?:\s|$)/i.test(normalize(unitName))
}

function toProfile(entry: ArmyIntelligenceDecodedEntry, listCount: number, denominator: number, gunfighter: TacticalProfile['gunfighter'], closeCombat: TacticalProfile['closeCombat'], aro: TacticalProfile['aro']): TacticalProfile {
  const skills = entry.skills.map(normalize).filter((skill) => alternativeSkill.test(skill) || defensiveSkill.test(skill) || enhancement.test(skill) || valuableAroSkill.test(skill) || bsAttackBurstBonus([skill]) > 0)
  const burstBonus = bsAttackBurstBonus(entry.skills)
  const sdBonus = bsAttackSdBonus(entry.skills) + Number(entry.fireteamSdBonus || 0)
  const mobility = lookupMobility(mobilityCatalog as MobilityCatalog, entry.combinedId)
  return {
    aro,
    badges: unique([...skills, ...canonicalWeapons(entry).filter((weapon) => weaponSdBonus(weapon) > 0).map((weapon) => `${weapon.name} (+${weaponSdBonus(weapon)}SD)`), ...canonicalWeapons(entry).filter((weapon) => weaponBurstBonus(weapon) > 0).map((weapon) => `${weapon.name} (+${weaponBurstBonus(weapon)}B)`), ...(entry.fireteamSdBonus ? ['Fireteam (+1SD)'] : []), ...(isProxyMkIv(entry) ? ['Proxy Mk IV exception'] : []), ...hackingComponents(entry)]),
    bs: entry.bs ?? null,
    cc: entry.cc ?? null,
    closeCombat,
    equipment: entry.equipment.filter((item) => deliveryEquipment.test(normalize(item)) || hackingDevice.test(normalize(item))),
    gunfighter,
    mobility: mobility?.status === 'rated' && mobility.score !== null
      ? { mov: mobility.mov, score: mobility.score, travel: mobility.travel }
      : undefined,
    linkability: entry.fireteamEligibility?.state === 'verified' ? 'verified' : entry.fireteamEligibility?.state === 'verified-false' ? 'verified-false' : 'unknown',
    listCount,
    percentage: denominator ? (listCount / denominator) * 100 : 0,
    profile: tacticalProfileLabel(entry),
    profileId: profileKey(entry),
    roles: [],
    unit: entry.unit || entry.profile,
    weapons: normalizedWeapons(entry).map((weapon) => ({ ...weapon, effectiveBurst: weapon.burst === null ? null : weapon.burst + burstBonus + weaponBurstBonus(weapon), effectiveDice: weapon.burst === null ? null : weapon.burst + burstBonus + weaponBurstBonus(weapon) + sdBonus + weaponSdBonus(weapon) })),
  }
}

function canonicalWeapons(entry: ArmyIntelligenceDecodedEntry) {
  return entry.weaponProfiles?.map((weapon) => ({ name: normalize(weapon.name), mode: normalize(weapon.mode), type: normalize(weapon.type), modifiers: weapon.modifiers || [], burst: finiteOrNull(weapon.burst), burstStatus: weapon.burstStatus || 'unknown' })) || []
}

function effectiveSdWeapons(entry: ArmyIntelligenceDecodedEntry) {
  const bonus = bsAttackBurstBonus(entry.skills) + bsAttackSdBonus(entry.skills) + Number(entry.fireteamSdBonus || 0)
  return canonicalWeapons(entry).filter((weapon) => weapon.burstStatus === 'canonical').map((weapon) => ({ ...weapon, burst: weapon.burst === null ? null : weapon.burst + bonus + weaponBurstBonus(weapon) + weaponSdBonus(weapon) }))
}

function weaponSdBonus(weapon: { modifiers?: string[] }) {
  for (const modifier of weapon.modifiers || []) {
    const match = normalize(modifier).match(/^\+\s*(?:(\d+)\s*)?sd$/i)
    if (match) return Number(match[1] || 1)
  }
  return 0
}

function weaponBurstBonus(weapon: { modifiers?: string[] }) {
  for (const modifier of weapon.modifiers || []) {
    const match = normalize(modifier).match(/^\+\s*(?:(\d+)\s*)?(?:b|burst)$/i)
    if (match) return Number(match[1] || 1)
  }
  return 0
}

function isProxyMkIv(entry: Pick<ArmyIntelligenceDecodedEntry, 'canonicalProfile' | 'profile' | 'unit'>) {
  return [entry.unit, entry.profile, entry.canonicalProfile].some((value) => /^proxy\s+mk\s+(?:iv|4)(?:\s|$)/.test(normalize(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()))
}

function weaponRuleToken(weapon: { name?: string; mode?: string }) {
  return normalize([weapon.name, weapon.mode].filter(Boolean).join(' ')).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[−–—-]/g, ' ').replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function apexGunfighterWeapon(weapon: { name?: string; mode?: string }) {
  return /(?:^|\s)(?:marksman rifle|spitfire|red fury|heavy machine gun|hmg|hyper rapid magnetic cannon|hrmc|thunderbolt)(?:\s+(?:ap|burst|anti materiel|hit|blast) mode)?$/.test(weaponRuleToken(weapon))
}

function competentGunfighterWeapon(weapon: { name?: string; mode?: string }) {
  return apexGunfighterWeapon(weapon) || /(?:^|\s)rifle(?:\s+(?:ap|burst|anti materiel|hit|blast) mode)?$/.test(weaponRuleToken(weapon))
}

function heavyRocketLauncherWeapon(weapon: { name?: string; mode?: string }) {
  return /^heavy rocket launcher(?:\s+(?:burst|anti materiel|hit|blast) mode)?$/.test(weaponRuleToken(weapon))
}

function portableAutocannonWeapon(weapon: { name?: string; mode?: string }) {
  return /^portable autocannon(?:\s+(?:burst|anti materiel|hit|blast) mode)?$/.test(weaponRuleToken(weapon))
}

function isRangedWeapon(weapon: { name?: string; type?: string }) {
  return weaponRuleToken({ name: weapon.type }) !== 'cc' && !/\bcc weapon\b/.test(weaponRuleToken(weapon))
}

function bsAttackBurstBonus(skills: string[]) {
  for (const skill of skills) {
    const match = normalize(skill).match(/^bs attack\s*[\[(]\s*\+\s*(?:(\d+)\s*)?(?:b|burst)\s*[\])]$/i)
    if (match) return Number(match[1] || 1)
  }
  return 0
}

function bsAttackSdBonus(skills: string[]) {
  for (const skill of skills) {
    const match = normalize(skill).match(/^bs attack\s*[\[(]\s*\+\s*(?:(\d+)\s*)?sd\s*[\])]$/i)
    if (match) return Number(match[1] || 1)
  }
  return 0
}

function withFireteamSdBonuses(entries: ArmyIntelligenceDecodedEntry[]) {
  const eligible = eligibleLevel2Teams(entries.map(entry => ({ combinedId: entry.combinedId, unitName: entry.unit, combatGroup: entry.combatGroup, fireteamMemberships: entry.fireteamEligibility?.memberships, fireteamTeams: entry.fireteamEligibility?.teams })))
  return entries.map(entry => ({ ...entry, fireteamSdBonus: eligible.get(entry.combinedId)?.size ? 1 : 0 }))
}

function addMultiRoleMetadata(categories: TacticalCategory[]) {
  const roles = new Map<string, TacticalCategoryId[]>()
  for (const category of categories) for (const profile of category.profiles) roles.set(profile.profileId, Array.from(new Set<TacticalCategoryId>([...(roles.get(profile.profileId) || []), category.id])))
  for (const category of categories) for (const profile of category.profiles) profile.roles = roles.get(profile.profileId) || [category.id]
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
  if (Number.isInteger(entry.canonicalUnitId) && Number.isInteger(entry.canonicalOptionId)) {
    return ['canonical', entry.canonicalUnitId, entry.canonicalOptionId, normalize(entry.canonicalProfile || entry.profile || entry.unit).toLowerCase()].join('::')
  }
  const weapons = entry.weaponProfiles?.length
    ? entry.weaponProfiles.map((weapon) => `${normalize(weapon.name).toLowerCase()}:${normalize(weapon.mode).toLowerCase()}:${weapon.burst ?? '?'}:${(weapon.modifiers || []).map((modifier) => normalize(modifier).toLowerCase()).sort().join(',')}`).sort()
    : entry.weapons.map((weapon) => normalize(weapon).toLowerCase()).sort()
  return [normalize(entry.unit).toLowerCase(), normalize(entry.profile || entry.unit).toLowerCase(), entry.bs ?? '', entry.points ?? '', weapons.join('|')].join('::')
}

function tacticalProfileLabel(entry: ArmyIntelligenceDecodedEntry) {
  const profile = normalize(entry.profile || entry.unit)
  const baseLabel = profile.toLowerCase() !== normalize(entry.unit).toLowerCase()
    ? profile
    : canonicalWeapons(entry)[0]?.name || profile
  const apsaraVariant = normalize(entry.unit).toLowerCase() === 'apsara'
    ? entry.skills.map(normalize).find((skill) => /^(?:remdriver|tagcom)(?:\s|$)/i.test(skill))?.match(/^(remdriver|tagcom)/i)?.[1]
    : ''
  return apsaraVariant ? `${baseLabel} · ${apsaraVariant}` : baseLabel
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
    fireteamSdBonus: Math.max(Number(left.fireteamSdBonus || 0), Number(right.fireteamSdBonus || 0)),
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
