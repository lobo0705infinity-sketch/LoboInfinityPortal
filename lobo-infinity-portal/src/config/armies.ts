export type ArmyType = 'Vanilla' | 'Sectorial' | 'NA2'

export type ArmyRegistryEntry = {
  active: boolean
  id: string
  name: string
  parentFaction: string
  type: ArmyType
}

export const CANONICAL_ARMY_REGISTRY: readonly ArmyRegistryEntry[] = [
  { active: true, id: 'panoceania', name: 'PanOceania', parentFaction: 'PanOceania', type: 'Vanilla' },
  { active: true, id: 'military-orders', name: 'Military Orders', parentFaction: 'PanOceania', type: 'Sectorial' },
  { active: true, id: 'kestrel-colonial-force', name: 'Kestrel Colonial Force', parentFaction: 'PanOceania', type: 'Sectorial' },
  { active: true, id: 'neoterra-capitaline-army', name: 'Neoterra Capitaline Army', parentFaction: 'PanOceania', type: 'Sectorial' },
  { active: true, id: 'shock-army-of-acontecimento', name: 'Shock Army of Acontecimento', parentFaction: 'PanOceania', type: 'Sectorial' },
  { active: true, id: 'svalarheima-winter-force', name: 'Svalarheima Winter Force', parentFaction: 'PanOceania', type: 'Sectorial' },
  { active: true, id: 'varuna-immediate-reaction-division', name: 'Varuna Immediate Reaction Division', parentFaction: 'PanOceania', type: 'Sectorial' },
  { active: true, id: 'yu-jing', name: 'Yu Jing', parentFaction: 'Yu Jing', type: 'Vanilla' },
  { active: true, id: 'imperial-service', name: 'Imperial Service', parentFaction: 'Yu Jing', type: 'Sectorial' },
  { active: true, id: 'invincible-army', name: 'Invincible Army', parentFaction: 'Yu Jing', type: 'Sectorial' },
  { active: true, id: 'white-banner', name: 'White Banner', parentFaction: 'Yu Jing', type: 'Sectorial' },
  { active: true, id: 'ariadna', name: 'Ariadna', parentFaction: 'Ariadna', type: 'Vanilla' },
  { active: true, id: 'caledonian-highlander-army', name: 'Caledonian Highlander Army', parentFaction: 'Ariadna', type: 'Sectorial' },
  { active: true, id: 'force-de-reponse-rapide-merovingienne', name: 'Force de Réponse Rapide Merovingienne', parentFaction: 'Ariadna', type: 'Sectorial' },
  { active: true, id: 'kosmoflot', name: 'Kosmoflot', parentFaction: 'Ariadna', type: 'Sectorial' },
  { active: true, id: 'tartary-army-corps', name: 'Tartary Army Corps', parentFaction: 'Ariadna', type: 'Sectorial' },
  { active: true, id: 'usariadna-ranger-force', name: 'USAriadna Ranger Force', parentFaction: 'Ariadna', type: 'Sectorial' },
  { active: true, id: 'haqqislam', name: 'Haqqislam', parentFaction: 'Haqqislam', type: 'Vanilla' },
  { active: true, id: 'hassassin-bahram', name: 'Hassassin Bahram', parentFaction: 'Haqqislam', type: 'Sectorial' },
  { active: true, id: 'qapu-khalqi', name: 'Qapu Khalqi', parentFaction: 'Haqqislam', type: 'Sectorial' },
  { active: true, id: 'ramah-taskforce', name: 'Ramah Taskforce', parentFaction: 'Haqqislam', type: 'Sectorial' },
  { active: true, id: 'nomads', name: 'Nomads', parentFaction: 'Nomads', type: 'Vanilla' },
  { active: true, id: 'bakunin-jurisdictional-command', name: 'Bakunin Jurisdictional Command', parentFaction: 'Nomads', type: 'Sectorial' },
  { active: true, id: 'corregidor-jurisdictional-command', name: 'Corregidor Jurisdictional Command', parentFaction: 'Nomads', type: 'Sectorial' },
  { active: true, id: 'tunguska-jurisdictional-command', name: 'Tunguska Jurisdictional Command', parentFaction: 'Nomads', type: 'Sectorial' },
  { active: true, id: 'combined-army', name: 'Combined Army', parentFaction: 'Combined Army', type: 'Vanilla' },
  { active: true, id: 'morat-aggression-force', name: 'Morat Aggression Force', parentFaction: 'Combined Army', type: 'Sectorial' },
  { active: true, id: 'next-wave', name: 'Next Wave', parentFaction: 'Combined Army', type: 'Sectorial' },
  { active: true, id: 'onyx-contact-force', name: 'Onyx Contact Force', parentFaction: 'Combined Army', type: 'Sectorial' },
  { active: true, id: 'shasvastii-expeditionary-force', name: 'Shasvastii Expeditionary Force', parentFaction: 'Combined Army', type: 'Sectorial' },
  { active: true, id: 'aleph', name: 'ALEPH', parentFaction: 'ALEPH', type: 'Vanilla' },
  { active: true, id: 'operations-subsection', name: 'Operations Subsection', parentFaction: 'ALEPH', type: 'Sectorial' },
  { active: true, id: 'steel-phalanx', name: 'Steel Phalanx', parentFaction: 'ALEPH', type: 'Sectorial' },
  { active: true, id: 'o-12', name: 'O-12', parentFaction: 'O-12', type: 'Vanilla' },
  { active: true, id: 'starmada', name: 'Starmada', parentFaction: 'O-12', type: 'Sectorial' },
  { active: true, id: 'torchlight-brigade', name: 'Torchlight Brigade', parentFaction: 'O-12', type: 'Sectorial' },
  { active: true, id: 'japanese-secessionist-army', name: 'Japanese Secessionist Army', parentFaction: 'Japanese Secessionist Army', type: 'Vanilla' },
  { active: true, id: 'oban', name: 'Oban', parentFaction: 'Japanese Secessionist Army', type: 'Sectorial' },
  { active: true, id: 'shindenbutai', name: 'Shindenbutai', parentFaction: 'Japanese Secessionist Army', type: 'Sectorial' },
  { active: true, id: 'tohaa', name: 'Tohaa', parentFaction: 'Tohaa', type: 'Vanilla' },
  { active: true, id: 'dashat-company', name: 'Dashat Company', parentFaction: 'Non-Aligned Armies', type: 'NA2' },
  { active: true, id: 'druze-bayram-security', name: 'Druze Bayram Security', parentFaction: 'Non-Aligned Armies', type: 'NA2' },
  { active: true, id: 'foreign-company', name: 'Foreign Company', parentFaction: 'Non-Aligned Armies', type: 'NA2' },
  { active: true, id: 'ikari-company', name: 'Ikari Company', parentFaction: 'Non-Aligned Armies', type: 'NA2' },
  { active: true, id: 'spiral-corps', name: 'Spiral Corps', parentFaction: 'Non-Aligned Armies', type: 'NA2' },
  { active: true, id: 'starco', name: 'StarCo', parentFaction: 'Non-Aligned Armies', type: 'NA2' },
  { active: true, id: 'white-company', name: 'White Company', parentFaction: 'Non-Aligned Armies', type: 'NA2' },
] as const

const armyNameByKey = new Map<string, string>(
  CANONICAL_ARMY_REGISTRY.map((army) => [normalizeArmyKey(army.name), army.name]),
)

const armyAliasEntries = [
  ['pano', 'PanOceania'],
  ['pan o', 'PanOceania'],
  ['pan-o', 'PanOceania'],
  ['vanilla pano', 'PanOceania'],
  ['vanilla pan o', 'PanOceania'],
  ['vanilla pan-o', 'PanOceania'],
  ['vanilla panoceania', 'PanOceania'],
  ['yj', 'Yu Jing'],
  ['vanilla yj', 'Yu Jing'],
  ['vanilla yu jing', 'Yu Jing'],
  ['vanilla ariadna', 'Ariadna'],
  ['haqq', 'Haqqislam'],
  ['vanilla haqq', 'Haqqislam'],
  ['vanilla haqqislam', 'Haqqislam'],
  ['vanilla nomads', 'Nomads'],
  ['ca', 'Combined Army'],
  ['vanilla ca', 'Combined Army'],
  ['combined', 'Combined Army'],
  ['vanilla combined army', 'Combined Army'],
  ['vanilla aleph', 'ALEPH'],
  ['o12', 'O-12'],
  ['o 12', 'O-12'],
  ['vanilla o12', 'O-12'],
  ['vanilla o 12', 'O-12'],
  ['vanilla o-12', 'O-12'],
  ['jsa', 'Japanese Secessionist Army'],
  ['vanilla jsa', 'Japanese Secessionist Army'],
  ['vanilla tohaa', 'Tohaa'],
  ['shock army', 'Shock Army of Acontecimento'],
  ['shock army acontecimento', 'Shock Army of Acontecimento'],
  ['shock army of acontecimento', 'Shock Army of Acontecimento'],
  ['acontecimento', 'Shock Army of Acontecimento'],
  ['mrrf', 'Force de Réponse Rapide Merovingienne'],
  ['merovingienne', 'Force de Réponse Rapide Merovingienne'],
  ['usariadna', 'USAriadna Ranger Force'],
] as const

armyAliasEntries.forEach(([alias, canonicalName]) => {
  armyNameByKey.set(normalizeArmyKey(alias), canonicalName)
})

export const CANONICAL_ARMY_NAMES = CANONICAL_ARMY_REGISTRY
  .filter((army) => army.active)
  .map((army) => army.name)

export const CANONICAL_PARENT_FACTIONS = Array.from(
  new Set(CANONICAL_ARMY_REGISTRY.map((army) => army.parentFaction)),
)

export function getCanonicalArmyName(value: string | null | undefined) {
  const key = normalizeArmyKey(value)
  return key ? armyNameByKey.get(key) || '' : ''
}

export function getCanonicalArmyOptions() {
  return CANONICAL_ARMY_NAMES
}

export function getCanonicalParentFactionOptions() {
  return CANONICAL_PARENT_FACTIONS
}

export function getArmiesForParent(parentFaction: string) {
  if (!parentFaction) {
    return CANONICAL_ARMY_NAMES
  }

  return CANONICAL_ARMY_REGISTRY
    .filter((army) => army.parentFaction === parentFaction && army.active)
    .map((army) => army.name)
}

export function getArmyParentFaction(value: string | null | undefined) {
  const canonicalName = getCanonicalArmyName(value)
  return (
    CANONICAL_ARMY_REGISTRY.find((army) => army.name === canonicalName)
      ?.parentFaction || ''
  )
}

export function normalizeArmyForDisplay(value: string | null | undefined) {
  return getCanonicalArmyName(value) || String(value || '').trim()
}

function normalizeArmyKey(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
