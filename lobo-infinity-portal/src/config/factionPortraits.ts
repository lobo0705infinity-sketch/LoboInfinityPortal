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
    alt: 'Combined Army pilot portrait',
    faction: 'Combined Army',
    src: `${FACTION_PORTRAIT_BASE_PATH}combined-army.png`,
  },
  {
    alt: 'Starmada pilot portrait',
    faction: 'Starmada',
    src: `${FACTION_PORTRAIT_BASE_PATH}starmada.png`,
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
    ['Combined', 'Combined Army'],
    ['Torchlight', 'Torchlight Brigade'],
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
