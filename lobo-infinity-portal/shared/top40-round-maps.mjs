export const TOP40_EVENT_ID = 'event-lobo-s-american-top-40'
export const TOP40_APPROVED_MAPS_INSTALLER = '/assets/maps/seven-map-update-20261102-r1/Lobo-Seven-Map-Workshop-Update-Installer.zip'

// Only announced round assignments belong in the tournament map collection.
export const TOP40_ROUND_MAPS = [
  {
    "key": "winners-1",
    "mission": "Corporate Appropriation",
    "name": "Asterion Research Campus",
    "workshopLabel": "Lobo's Top 40 Winners Round 1 Map",
    "href": "/event/lobos-top-40/maps/winners-1",
    "download": "/assets/maps/seven-map-update-20261102-r1/Lobos-Top-40-Winners-Round-1-Map.json",
    "angled": "/assets/maps/seven-map-update-20261102-r1/asterion-angled.webp",
    "overhead": "/assets/maps/seven-map-update-20261102-r1/asterion-overhead.webp",
    "generalHref": "/maps/corporate-appropriation-1-satellite",
    "bracket": "Winners",
    "round": 1
  },
  {
    "key": "winners-2",
    "mission": "Superiority",
    "name": "Frostline Relay",
    "workshopLabel": "Lobo's Top 40 Winners Round 2 Map",
    "href": "/event/lobos-top-40/maps/winners-2",
    "download": "/assets/maps/seven-map-update-20261102-r1/Lobos-Top-40-Winners-Round-2-Map.json",
    "angled": "/assets/maps/seven-map-update-20261102-r1/frostline-angled.webp",
    "overhead": "/assets/maps/seven-map-update-20261102-r1/frostline-overhead.webp",
    "generalHref": "/maps/superiority-1",
    "bracket": "Winners",
    "round": 2
  },
  {
    "key": "winners-3",
    "mission": "Uplink Center",
    "name": "Verdant Exchange",
    "workshopLabel": "Lobo's Top 40 Winners Round 3 Map",
    "href": "/event/lobos-top-40/maps/winners-3",
    "download": "/assets/maps/seven-map-update-20261102-r1/Lobos-Top-40-Winners-Round-3-Map.json",
    "angled": "/assets/maps/seven-map-update-20261102-r1/verdant-angled.webp",
    "overhead": "/assets/maps/seven-map-update-20261102-r1/verdant-overhead.webp",
    "generalHref": "/maps/uplink-center-2",
    "bracket": "Winners",
    "round": 3
  },
  {
    "key": "winners-4",
    "mission": "The Dig",
    "name": "Old Quarter Excavation",
    "workshopLabel": "Lobo's Top 40 Winners Round 4 Map",
    "href": "/event/lobos-top-40/maps/winners-4",
    "download": "/assets/maps/seven-map-update-20261102-r1/Lobos-Top-40-Winners-Round-4-Map.json",
    "angled": "/assets/maps/seven-map-update-20261102-r1/old-quarter-angled.webp",
    "overhead": "/assets/maps/seven-map-update-20261102-r1/old-quarter-overhead.webp",
    "generalHref": "/maps/the-dig-2-satellite",
    "bracket": "Winners",
    "round": 4
  },
  {
    "key": "losers-1",
    "mission": "Annihilation",
    "name": "Canopy Blacksite",
    "workshopLabel": "Lobo's Top 40 Losers Round 1 Map",
    "href": "/event/lobos-top-40/maps/losers-1",
    "download": "/assets/maps/seven-map-update-20261102-r1/Lobos-Top-40-Losers-Round-1-Map.json",
    "angled": "/assets/maps/seven-map-update-20261102-r1/canopy-angled.webp",
    "overhead": "/assets/maps/seven-map-update-20261102-r1/canopy-overhead.webp",
    "generalHref": "/maps/annihilation-2",
    "bracket": "Losers",
    "round": 1
  }
]

export const TOP40_MAPS = [...TOP40_ROUND_MAPS]

export function getTop40RoundMap(bracket, round, mission = '') {
  return TOP40_ROUND_MAPS.find(map => map.bracket === bracket && map.round === Number(round)
    && (!mission || map.mission.toLowerCase() === String(mission).trim().toLowerCase()))
}

export function withTop40RoundMaps(records) {
  if (!Array.isArray(records)) return records
  return records.map(record => {
    if (!['Winners', 'Losers', 'Grand Final'].includes(record.bracket)) return record
    const map = getTop40RoundMap(record.bracket, record.bracketRound, record.mission)
    return { ...record, map: map?.workshopLabel || 'TBD', maps: [map?.workshopLabel || 'TBD'] }
  })
}

export function applyTop40MapAssignments(projection) {
  if (projection?.eventId !== TOP40_EVENT_ID) return projection
  const updateEvent = event => event?.id === TOP40_EVENT_ID ? {
    ...event,
    ...(Array.isArray(event.bracketMissions) ? { bracketMissions: withTop40RoundMaps(event.bracketMissions) } : {}),
    ...(Array.isArray(event.bracket) ? { bracket: withTop40RoundMaps(event.bracket) } : {}),
  } : event
  return {
    ...projection,
    ...(projection.home ? { home: { ...projection.home, event: updateEvent(projection.home.event) } } : {}),
    ...(projection.bracket ? { bracket: { ...projection.bracket,
      ...(Array.isArray(projection.bracket.missions) ? { missions: withTop40RoundMaps(projection.bracket.missions) } : {}),
      ...(Array.isArray(projection.bracket.matches) ? { matches: withTop40RoundMaps(projection.bracket.matches) } : {}),
    } } : {}),
    ...(projection.publicData ? { publicData: { ...projection.publicData, event: updateEvent(projection.publicData.event) } } : {}),
  }
}
