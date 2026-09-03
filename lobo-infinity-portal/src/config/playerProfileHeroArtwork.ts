export type PlayerProfileHeroArtwork = {
  alt: string
  army: string
  kind: 'army' | 'no-army'
  src: string
}

const HERO_BASE_PATH = '/assets/player-profile-heroes/'

const NO_ARMY_HERO: PlayerProfileHeroArtwork = {
  alt: 'Player Profile — no preferred army selected',
  army: 'No Army Selected',
  kind: 'no-army',
  src: `${HERO_BASE_PATH}no-army.png`,
}

const canonicalHeroFiles = {
  ALEPH: 'aleph.png',
  Ariadna: 'ariadna.png',
  'Bakunin Jurisdictional Command': 'bakunin.png',
  'Caledonian Highlander Army': 'caledonian-highlander-army.png',
  'Combined Army': 'combined-army.png',
  'Corregidor Jurisdictional Command': 'corregidor.png',
  'Dashat Company': 'dashat.png',
  'Druze Bayram Security': 'druze.png',
  'Force de Réponse Rapide Merovingienne': 'force-de-reponse-rapide-merovingienne.png',
  Haqqislam: 'haqqislam.png',
  'Hassassin Bahram': 'hassassin-bharam.png',
  'Ikari Company': 'ikari-company.png',
  'Imperial Service': 'imperial-service.png',
  'Invincible Army': 'invincible-army.png',
  'Japanese Secessionist Army': 'jsa.png',
  'Kestrel Colonial Force': 'kestrel.png',
  Kosmoflot: 'kosmoflot.png',
  'Military Orders': 'military-orders.png',
  'Morat Aggression Force': 'morat-agrression-force.png',
  'Neoterra Capitaline Army': 'neocapitaline-army.png',
  'Next Wave': 'next-wave.png',
  Nomads: 'nomads.png',
  'O-12': 'o12.png',
  Oban: 'oban.png',
  'Onyx Contact Force': 'onyx.png',
  'Operations Subsection': 'operations-subsection.png',
  PanOceania: 'panoceania.png',
  'Qapu Khalqi': 'qapu-khalqi.png',
  'Ramah Taskforce': 'ramah-task-force.png',
  'Shasvastii Expeditionary Force': 'shasvastii.png',
  Shindenbutai: 'shindenbutai.png',
  'Shock Army of Acontecimento': 'shock-army-of-acontecimento.png',
  StarCo: 'starco.png',
  Starmada: 'starmada.png',
  'Steel Phalanx': 'steel-phalanx.png',
  'Svalarheima Winter Force': 'svalarheima-winter-force.png',
  'Tartary Army Corps': 'tartary-army-korps.png',
  Tohaa: 'tohaa.png',
  'Torchlight Brigade': 'torchlight.png',
  'Tunguska Jurisdictional Command': 'tunguska.png',
  'USAriadna Ranger Force': 'us-ariadna-ranger-force.png',
  'Varuna Immediate Reaction Division': 'varuna-immediate-reaction-division.png',
  'White Banner': 'white-banner.png',
  'White Company': 'white-company.png',
  'Yu Jing': 'yu-jing.png',
} as const

const exactAliases: Readonly<Record<string, keyof typeof canonicalHeroFiles>> = {
  'Free Company of the Star': 'StarCo',
  'Jurisdictional Command of Bakunin': 'Bakunin Jurisdictional Command',
  'Jurisdictional Command of Corregidor': 'Corregidor Jurisdictional Command',
  'Jurisdictional Command of Tunguska': 'Tunguska Jurisdictional Command',
  'Japanese Sectorial Army': 'Japanese Secessionist Army',
  'Neoterran Capitaline Army': 'Neoterra Capitaline Army',
  'StarCo. Free Company of the Star': 'StarCo',
  'Tartary Army Korps': 'Tartary Army Corps',
}

export const PLAYER_PROFILE_HERO_CANONICAL_ARMIES = Object.freeze(
  Object.keys(canonicalHeroFiles) as Array<keyof typeof canonicalHeroFiles>,
)

export function resolvePlayerProfileHero(
  preferredArmy: string | null | undefined,
): PlayerProfileHeroArtwork | null {
  const value = String(preferredArmy ?? '').trim()

  if (!value || value === 'No Army Selected') {
    return NO_ARMY_HERO
  }

  const canonicalArmy = exactAliases[value] ?? value
  const file = canonicalHeroFiles[canonicalArmy as keyof typeof canonicalHeroFiles]

  if (!file) return null

  return {
    alt: `Player Profile — preferred army: ${canonicalArmy}`,
    army: canonicalArmy,
    kind: 'army',
    src: `${HERO_BASE_PATH}${file}`,
  }
}
