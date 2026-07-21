import { getArmyParentFaction, getCanonicalArmyName } from './armies.ts'

export type FactionPortrait = {
  alt: string
  faction: string
  src: string
}

const FACTION_PORTRAIT_BASE_PATH = '/faction-portraits/'

export const FACTION_PORTRAIT_REGISTRY: readonly FactionPortrait[] = [
  {
    alt: 'ALEPH pilot portrait',
    faction: 'ALEPH',
    src: `${FACTION_PORTRAIT_BASE_PATH}aleph.png`,
  },
  {
    alt: 'Nomads pilot portrait',
    faction: 'Nomads',
    src: `${FACTION_PORTRAIT_BASE_PATH}nomads.png`,
  },
  {
    alt: 'Corregidor pilot portrait',
    faction: 'Corregidor',
    src: `${FACTION_PORTRAIT_BASE_PATH}corregidor.png`,
  },
  {
    alt: 'Tunguska pilot portrait',
    faction: 'Tunguska',
    src: `${FACTION_PORTRAIT_BASE_PATH}tunguska.png`,
  },
  {
    alt: 'Combined Army pilot portrait',
    faction: 'Combined Army',
    src: `${FACTION_PORTRAIT_BASE_PATH}combined-army.png`,
  },
  {
    alt: 'Onyx Contact Force pilot portrait',
    faction: 'Onyx Contact Force',
    src: `${FACTION_PORTRAIT_BASE_PATH}onyx-contact-force.png`,
  },
  {
    alt: 'Starmada pilot portrait',
    faction: 'Starmada',
    src: `${FACTION_PORTRAIT_BASE_PATH}starmada.png`,
  },
  {
    alt: 'StarCo pilot portrait',
    faction: 'StarCo',
    src: `${FACTION_PORTRAIT_BASE_PATH}starco.png`,
  },
  {
    alt: 'Torchlight Brigade pilot portrait',
    faction: 'Torchlight Brigade',
    src: `${FACTION_PORTRAIT_BASE_PATH}torchlight-brigade.png`,
  },
  {
    alt: 'Ariadna pilot portrait',
    faction: 'Ariadna',
    src: `${FACTION_PORTRAIT_BASE_PATH}ariadna.png`,
  },
  {
    alt: 'Haqqislam pilot portrait',
    faction: 'Haqqislam',
    src: `${FACTION_PORTRAIT_BASE_PATH}haqqislam.png`,
  },
  {
    alt: 'Ramah Taskforce pilot portrait',
    faction: 'Ramah Taskforce',
    src: `${FACTION_PORTRAIT_BASE_PATH}ramah-taskforce.png`,
  },
  {
    alt: 'Hassassin Bahram pilot portrait',
    faction: 'Hassassin Bahram',
    src: `${FACTION_PORTRAIT_BASE_PATH}hassassin-bahram.png`,
  },
  {
    alt: 'Qapu Khalqi pilot portrait',
    faction: 'Qapu Khalqi',
    src: `${FACTION_PORTRAIT_BASE_PATH}qapu-khalqi.png`,
  },
  {
    alt: 'Japanese Secessionist Army pilot portrait',
    faction: 'Japanese Secessionist Army',
    src: `${FACTION_PORTRAIT_BASE_PATH}jsa.png`,
  },
  {
    alt: 'Tohaa pilot portrait',
    faction: 'Tohaa',
    src: `${FACTION_PORTRAIT_BASE_PATH}tohaa.png`,
  },
  {
    alt: 'O-12 pilot portrait',
    faction: 'O-12',
    src: `${FACTION_PORTRAIT_BASE_PATH}o-12.png`,
  },
  {
    alt: 'Military Orders pilot portrait',
    faction: 'Military Orders',
    src: `${FACTION_PORTRAIT_BASE_PATH}military-orders.png`,
  },
  {
    alt: 'Neoterran Capitaline Army pilot portrait',
    faction: 'Neoterran Capitaline Army',
    src: `${FACTION_PORTRAIT_BASE_PATH}neoterra.png`,
  },
  {
    alt: 'Shock Army of Acontecimento pilot portrait',
    faction: 'Shock Army of Acontecimento',
    src: `${FACTION_PORTRAIT_BASE_PATH}acontecimento.png`,
  },
  {
    alt: 'White Banner pilot portrait',
    faction: 'White Banner',
    src: `${FACTION_PORTRAIT_BASE_PATH}white-banner.png`,
  },
  {
    alt: 'Varuna pilot portrait',
    faction: 'Varuna',
    src: `${FACTION_PORTRAIT_BASE_PATH}varuna.png`,
  },
  {
    alt: "Svalarheima's Winter Force pilot portrait",
    faction: "Svalarheima's Winter Force",
    src: `${FACTION_PORTRAIT_BASE_PATH}winterfor.png`,
  },
  {
    alt: 'Kestrel Colonial Force pilot portrait',
    faction: 'Kestrel Colonial Force',
    src: `${FACTION_PORTRAIT_BASE_PATH}kestrel-colonial-force.png`,
  },
  {
    alt: 'Imperial Service pilot portrait',
    faction: 'Imperial Service',
    src: `${FACTION_PORTRAIT_BASE_PATH}imperial-service.png`,
  },
  {
    alt: 'Invincible Army pilot portrait',
    faction: 'Invincible Army',
    src: `${FACTION_PORTRAIT_BASE_PATH}invincible-army.png`,
  },
  {
    alt: 'Operations Subsection pilot portrait',
    faction: 'Operations Subsection',
    src: `${FACTION_PORTRAIT_BASE_PATH}operations-subsection.png`,
  },
  {
    alt: 'Bakunin Jurisdictional Command pilot portrait',
    faction: 'Bakunin Jurisdictional Command',
    src: `${FACTION_PORTRAIT_BASE_PATH}bakunin.png`,
  },
  {
    alt: 'Kosmoflot pilot portrait',
    faction: 'Kosmoflot',
    src: `${FACTION_PORTRAIT_BASE_PATH}kosmoflot.png`,
  },
  {
    alt: 'USAriadna Ranger Force pilot portrait',
    faction: 'USAriadna Ranger Force',
    src: `${FACTION_PORTRAIT_BASE_PATH}usariadna.png`,
  },
  {
    alt: 'Tartary Army Corps pilot portrait',
    faction: 'Tartary Army Corps',
    src: `${FACTION_PORTRAIT_BASE_PATH}tartary-army-corps.png`,
  },
  {
    alt: 'Caledonian Highlander Army pilot portrait',
    faction: 'Caledonian Highlander Army',
    src: `${FACTION_PORTRAIT_BASE_PATH}caledonian-highlander-army.png`,
  },
  {
    alt: 'Force de Réponse Rapide Merovingienne pilot portrait',
    faction: 'Force de Réponse Rapide Merovingienne',
    src: `${FACTION_PORTRAIT_BASE_PATH}frrm.png`,
  },
  {
    alt: 'Ikari Company pilot portrait',
    faction: 'Ikari Company',
    src: `${FACTION_PORTRAIT_BASE_PATH}ikari-company.png`,
  },
  {
    alt: 'Dahshat Company pilot portrait',
    faction: 'Dahshat Company',
    src: `${FACTION_PORTRAIT_BASE_PATH}dahshat-company.png`,
  },
  {
    alt: 'Druze Bayram Security pilot portrait',
    faction: 'Druze Bayram Security',
    src: `${FACTION_PORTRAIT_BASE_PATH}druze-bayram-security.png`,
  },
  {
    alt: 'Morat Aggression Force pilot portrait',
    faction: 'Morat Aggression Force',
    src: `${FACTION_PORTRAIT_BASE_PATH}morats.png`,
  },
  {
    alt: 'Shasvastii Expeditionary Force pilot portrait',
    faction: 'Shasvastii Expeditionary Force',
    src: `${FACTION_PORTRAIT_BASE_PATH}shasvastii.png`,
  },
] as const

const factionPortraitByKey = new Map(
  FACTION_PORTRAIT_REGISTRY.map((portrait) => [
    normalizeFactionPortraitKey(portrait.faction),
    portrait,
  ]),
)

const factionPortraitAliasByKey = new Map(
  [
    ['Nomad', 'Nomads'],
    ['Jurisdictional Command of Corregidor', 'Corregidor'],
    ['Tunguska Jurisdictional Command', 'Tunguska'],
    ['Combined', 'Combined Army'],
    ['Onyx', 'Onyx Contact Force'],
    ['StarCo. Free Company of the Star', 'StarCo'],
    ['Free Company of the Star', 'StarCo'],
    ['Torchlight', 'Torchlight Brigade'],
    ['Ramah Task Force', 'Ramah Taskforce'],
    ['Neoterra', 'Neoterran Capitaline Army'],
    ['NCA', 'Neoterran Capitaline Army'],
    ['Acontecimento', 'Shock Army of Acontecimento'],
    ['SAA', 'Shock Army of Acontecimento'],
    ['Varuna Immediate Reaction Division', 'Varuna'],
    ['WinterFor', "Svalarheima's Winter Force"],
    ['Svalarheima', "Svalarheima's Winter Force"],
    ['Kestrel', 'Kestrel Colonial Force'],
    ['Imperial Service Sectorial Army', 'Imperial Service'],
    ['IA', 'Invincible Army'],
    ['USARF', 'USAriadna Ranger Force'],
    ['US Ariadna', 'USAriadna Ranger Force'],
    ['Tartary Army Korps', 'Tartary Army Corps'],
    ['TAK', 'Tartary Army Corps'],
    ['Caledonia', 'Caledonian Highlander Army'],
    ['CHA', 'Caledonian Highlander Army'],
    ['Force de Reponse Rapide Merovingienne', 'Force de Réponse Rapide Merovingienne'],
    ['FRRM', 'Force de Réponse Rapide Merovingienne'],
    ['Merovingienne', 'Force de Réponse Rapide Merovingienne'],
    ['Merovingian Rapid Response Force', 'Force de Réponse Rapide Merovingienne'],
    ['Ikari', 'Ikari Company'],
    ['Dahshat', 'Dahshat Company'],
    ['Dashat Company', 'Dahshat Company'],
    ['Dashat', 'Dahshat Company'],
    ['Druze', 'Druze Bayram Security'],
    ['DBS', 'Druze Bayram Security'],
  ].map(([alias, faction]) => [
    normalizeFactionPortraitKey(alias),
    normalizeFactionPortraitKey(faction),
  ]),
)

export function resolveFactionPortrait(
  faction: string | null | undefined,
): FactionPortrait | null {
  const key = normalizeFactionPortraitKey(faction)

  if (!key) {
    return null
  }

  return (
    factionPortraitByKey.get(key) ??
    factionPortraitByKey.get(factionPortraitAliasByKey.get(key) || '') ??
    null
  )
}

export function resolveFactionPortraitFromArmyPriority(
  ...factions: Array<string | null | undefined>
): FactionPortrait | null {
  for (const faction of factions) {
    const portrait = resolveFactionPortraitCandidate(faction)

    if (portrait) {
      return portrait
    }
  }

  return null
}

function resolveFactionPortraitCandidate(faction: string | null | undefined) {
  const direct = resolveFactionPortrait(faction)

  if (direct) {
    return direct
  }

  const canonicalArmy = getCanonicalArmyName(faction)
  const canonical = resolveFactionPortrait(canonicalArmy)

  if (canonical) {
    return canonical
  }

  return resolveFactionPortrait(getArmyParentFaction(canonicalArmy || faction))
}

function normalizeFactionPortraitKey(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
