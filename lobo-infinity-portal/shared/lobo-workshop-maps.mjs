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

const definitions = [
  { id: 'standard', title: 'Standard and split deployment', description: 'Two terrain setups per mission using straight deployment edges or split deployment zones.', matches: map => /Standard|Split/.test(map.family) },
  { id: 'diagonal', title: 'Diagonal deployment', description: 'Two setups per diagonal mission, with circular deployment templates in opposing corners.', matches: map => map.family === 'Diagonal deployment' },
  { id: 'objective-room', title: 'Objective rooms', description: 'Two setups per room mission, with an 8-inch objective room and open entrance approaches.', matches: map => map.family === 'Objective rooms' },
]
export const loboWorkshopMapSections = definitions.map(({ matches, ...section }) => {
  const layouts = new Map()
  for (const map of loboWorkshopMaps.filter(matches)) {
    if (!layouts.has(map.layoutKey)) layouts.set(map.layoutKey, { layoutKey: map.layoutKey, name: map.name, saves: [] })
    layouts.get(map.layoutKey).saves.push(map)
  }
  return { ...section, eventUrl: null, layouts: [...layouts.values()] }
})
