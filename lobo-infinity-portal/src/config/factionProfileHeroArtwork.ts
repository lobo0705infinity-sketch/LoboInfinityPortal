export type FactionProfileHeroArtwork = {
  alt: string
  faction: string
  src: string
}

const FACTION_PROFILE_HERO_BASE_PATH = '/assets/faction-profile-heroes/'

const canonicalFactionProfileHeroFiles = {
  ALEPH: 'aleph.png',
  Ariadna: 'ariadna.png',
  'Bakunin Jurisdictional Command': 'bakunin-jurisdictional-command.png',
  'Caledonian Highlander Army': 'caledonian-highlander-army.png',
  'Combined Army': 'combined-army.png',
  'Corregidor Jurisdictional Command': 'corregidor-jurisdictional-command.png',
  'Dashat Company': 'dashat-company.png',
  'Druze Bayram Security': 'druze-bayram-security.png',
  'Force de Réponse Rapide Merovingienne': 'force-de-reponse-rapide-merovingienne.png',
  Haqqislam: 'haqqislam.png',
  'Hassassin Bahram': 'hassassin-bahram.png',
  'Ikari Company': 'ikari-company.png',
  'Imperial Service': 'imperial-service.png',
  'Invincible Army': 'invincible-army.png',
  'Japanese Secessionist Army': 'japanese-secessionist-army.png',
  'Kestrel Colonial Force': 'kestrel-colonial-force.png',
  Kosmoflot: 'kosmoflot.png',
  'Military Orders': 'military-orders.png',
  'Morat Aggression Force': 'morat-aggression-force.png',
  'Neoterra Capitaline Army': 'neoterra-capitaline-army.png',
  'Next Wave': 'next-wave.png',
  Nomads: 'nomads.png',
  'O-12': 'o-12.png',
  Oban: 'oban.png',
  'Onyx Contact Force': 'onyx-contact-force.png',
  'Operations Subsection': 'operations-subsection.png',
  PanOceania: 'panoceania.png',
  'Qapu Khalqi': 'qapu-khalqi.png',
  'Ramah Taskforce': 'ramah-taskforce.png',
  'Shasvastii Expeditionary Force': 'shasvastii-expeditionary-force.png',
  Shindenbutai: 'shindenbutai.png',
  'Shock Army of Acontecimento': 'shock-army-of-acontecimento.png',
  StarCo: 'starco.png',
  Starmada: 'starmada.png',
  'Steel Phalanx': 'steel-phalanx.png',
  'Svalarheima Winter Force': 'svalarheima-winter-force.png',
  'Tartary Army Corps': 'tartary-army-corps.png',
  Tohaa: 'tohaa.png',
  'Torchlight Brigade': 'torchlight-brigade.png',
  'Tunguska Jurisdictional Command': 'tunguska-jurisdictional-command.png',
  'USAriadna Ranger Force': 'usariadna-ranger-force.png',
  'Varuna Immediate Reaction Division': 'varuna-immediate-reaction-division.png',
  'White Banner': 'white-banner.png',
  'White Company': 'white-company.png',
  'Yu Jing': 'yu-jing.png',
} as const

export const FACTION_PROFILE_HERO_CANONICAL_FACTIONS = Object.freeze(
  Object.keys(canonicalFactionProfileHeroFiles) as Array<keyof typeof canonicalFactionProfileHeroFiles>,
)

export function resolveFactionProfileHero(
  factionName: string | null | undefined,
): FactionProfileHeroArtwork | null {
  const faction = String(factionName ?? '').trim()
  const file = canonicalFactionProfileHeroFiles[
    faction as keyof typeof canonicalFactionProfileHeroFiles
  ]

  if (!file) return null

  return {
    alt: `Faction Profile — ${faction}`,
    faction,
    src: `${FACTION_PROFILE_HERO_BASE_PATH}${file}`,
  }
}
