import current from './lobo-workshop-current.json' with { type: 'json' }
import retired from './lobo-workshop-archive-20261020.json' with { type: 'json' }
import {
  loboWorkshopMaps as legacyMaps,
  resolveLoboWorkshopMapLabel as resolveLegacyLabel,
} from './lobo-workshop-maps-legacy.mjs'

export const LOBO_WORKSHOP_URL = 'https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238'
export const LOBO_WORKSHOP_UPDATED_AT = current.updatedAt
export const LOBO_WORKSHOP_DOWNLOAD_URL = current.download
export const loboWorkshopMaps = current.maps

// Preserve old report links and terrain ratings outside the current browser.
export const archivedLoboWorkshopMaps = [
  ...legacyMaps.map(map => ({ ...map, isCurrent: false, previewKind: 'source' })),
  ...retired,
]
export const loboWorkshopMapBySlug = new Map([...archivedLoboWorkshopMaps, ...loboWorkshopMaps].map(map => [map.slug, map]))
const normalize = value => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
const currentByLabel = new Map([...archivedLoboWorkshopMaps, ...loboWorkshopMaps].flatMap(map =>
  [map.slug, map.workshopBagName, map.workshopName, ...(map.labelAliases || [])].map(label => [normalize(label), map])))
export const resolveLoboWorkshopMapLabel = label => currentByLabel.get(normalize(label)) || resolveLegacyLabel(label)

const missionNames = [...new Set(loboWorkshopMaps.flatMap(map => map.missionSetups))]
  .sort((a, b) => a.localeCompare(b))
export const loboWorkshopMapSections = missionNames.map(title => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  title,
  description: `Two terrain setups for ${title}.`,
  eventUrl: null,
  layouts: loboWorkshopMaps.filter(map => map.missionSetups.includes(title))
    .map(map => ({ layoutKey: map.layoutKey, name: map.name, saves: [map] })),
}))


// Active mission assignments may still carry a retired layout name. Resolve
// within that mission, then follow the stable save index to its replacement.
// Historical report lookups keep using resolveLoboWorkshopMapLabel unchanged.
export function resolveLoboWorkshopMissionMap(label, mission) {
  const eligible = loboWorkshopMaps.filter(map => normalize(map.missionSetups[0]) === normalize(mission))
  const matches = map => [map.name, map.slug, map.workshopBagName, map.workshopName, ...(map.labelAliases || [])]
    .some(value => normalize(value) === normalize(label))
  const direct = eligible.filter(matches)
  if (direct.length === 1) return direct[0]
  const previous = retired.filter(map => map.missionSetups.some(value => normalize(value) === normalize(mission)) && matches(map))
  if (previous.length === 1) return eligible.find(map => map.index === previous[0].index)
  return undefined
}
