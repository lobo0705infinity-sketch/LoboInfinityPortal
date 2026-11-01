export const TOP40_EVENT_ID = 'event-lobo-s-american-top-40'
const assetRoot = '/assets/maps/top40-approved-20261101-r1'
export const TOP40_APPROVED_MAPS_INSTALLER = `${assetRoot}/Lobo-Top-40-Four-Approved-Maps-Workshop-Update.zip`

// Only the four Commissioner-approved tournament assignments are released.
// General mission maps and unapproved replacements must not fill a vacant round.
export const TOP40_ROUND_MAPS = [
  { key: 'winners-1', bracket: 'Winners', round: 1, mission: 'Corporate Appropriation', name: 'Asterion Research Campus' },
  { key: 'winners-2', bracket: 'Winners', round: 2, mission: 'Superiority', name: 'Frostline Relay' },
  { key: 'winners-4', bracket: 'Winners', round: 4, mission: 'The Dig', name: 'Old Quarter Excavation' },
  { key: 'losers-1', bracket: 'Losers', round: 1, mission: 'Annihilation', name: 'Canopy Blacksite' },
].map(map => ({
  ...map,
  workshopLabel: `Lobo's Top 40 ${map.bracket} Round ${map.round} Map`,
  href: `/event/lobos-top-40/maps/${map.key}`,
  download: `${assetRoot}/Lobos-Top-40-${map.bracket}-Round-${map.round}-Map.json`,
}))

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
