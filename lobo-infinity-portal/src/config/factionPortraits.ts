export type FactionPortrait = {
  alt: string
  faction: string
  src: string
}

const FACTION_PORTRAIT_BASE_PATH = '/faction-portraits/'

export const FACTION_PORTRAIT_REGISTRY: readonly FactionPortrait[] = [
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

export function resolveFactionPortrait(
  faction: string | null | undefined,
): FactionPortrait | null {
  const key = normalizeFactionPortraitKey(faction)

  return key ? factionPortraitByKey.get(key) ?? null : null
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
