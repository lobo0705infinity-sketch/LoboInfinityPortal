import current from './lobo-workshop-current.json' with { type: 'json' }
import {
  loboWorkshopMaps as legacyMaps,
  resolveLoboWorkshopMapLabel as resolveLegacyLabel,
} from './lobo-workshop-maps-legacy.mjs'

export const LOBO_WORKSHOP_URL = 'https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238'
export const LOBO_WORKSHOP_UPDATED_AT = current.updatedAt
export const LOBO_WORKSHOP_DOWNLOAD_URL = current.download
export const loboWorkshopMaps = current.maps

// Preserve old report links and terrain ratings outside the current browser.
export const archivedLoboWorkshopMaps = legacyMaps.map(map => ({ ...map, isCurrent: false, previewKind: 'source' }))
export const loboWorkshopMapBySlug = new Map([...archivedLoboWorkshopMaps, ...loboWorkshopMaps].map(map => [map.slug, map]))
const normalize = value => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
const currentByLabel = new Map(loboWorkshopMaps.flatMap(map =>
  [map.slug, map.workshopBagName, map.workshopName].map(label => [normalize(label), map])))
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
