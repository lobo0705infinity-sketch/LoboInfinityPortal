// Fictional setting tags for the Area of Interest editorial pilot. The game
// record does not store terrain or weather, so these are narrative variants,
// not claims about the table on which a match was played.

export const AREA_WEATHER = {
  none: {
    opening: 'Both patrols had a clear view of the approach to its controls.',
    complication: 'The exposed route kept both specialists under fire as each side tried to hold the switch within reach.',
    closing: 'The relay clicked once as the opposing squad moved back toward the switch.',
  },
  rain: {
    opening: 'Rain ran through the seams of its exposed control housing.',
    complication: 'Water pooled beneath the panel, so a loose cable spat sparks whenever anyone reached for the switch.',
    closing: 'Rain hissed against the exposed wires while the relay clicked between channels.',
  },
  fog: {
    opening: 'Fog concealed the far side of the relay from both patrols.',
    complication: 'A bank of mist swallowed the route to the controls, and shots struck at movement neither specialist could identify.',
    closing: 'The fog closed again over the mast before the signal could settle.',
  },
  crosswind: {
    opening: 'A crosswind dragged dust across the open approach to its controls.',
    complication: 'A loose access cover swung in the gusts and slammed shut whenever a specialist tried to read the panel.',
    closing: 'The wind caught the cover once more and drowned out the relay’s final click.',
  },
  snow: {
    opening: 'Snow gathered along the control housing and softened the tracks leading to the mast.',
    complication: 'Ice sealed the panel’s release catch, forcing the specialist to scrape it clear while shots struck the mast.',
    closing: 'New snow filled the prints converging on the relay as the indicator flashed.',
  },
} as const

export type AreaWeatherTag = keyof typeof AREA_WEATHER

export const AREA_LOCATIONS = {
  relayCourtyard: {
    arrival: 'A relay mast stood in a walled courtyard beside a collapsed arcade.',
    approach: 'the arcade rubble', position: 'the breach in the far wall',
    scoringGround: 'the courtyard', retreat: 'the broken wall',
    signal: 'The activation light washed over the fallen stone at the mast’s base.',
    allowedWeather: ['none', 'rain', 'fog', 'crosswind', 'snow'],
  },
  freightDepot: {
    arrival: 'A relay mast rose between abandoned freight carriers at a depot.',
    approach: 'a parked cargo carrier', position: 'the raised loading platform',
    scoringGround: 'the loading lanes', retreat: 'the parked carriers',
    signal: 'The activation light spread across the empty loading rails.',
    allowedWeather: ['none', 'rain', 'fog', 'crosswind', 'snow'],
  },
  rooftopTerrace: {
    arrival: 'A relay mast stood on a rooftop terrace above the transit lines.',
    approach: 'a concrete planter', position: 'the maintenance stair',
    scoringGround: 'the rooftop', retreat: 'the stairwell',
    signal: 'The activation light caught the low parapet overlooking the tracks.',
    allowedWeather: ['none', 'rain', 'fog', 'crosswind', 'snow'],
  },
  forest: {
    arrival: 'A relay mast rose above a forest clearing hemmed in by pines.',
    approach: 'a fallen trunk', position: 'the treeline beyond the clearing',
    scoringGround: 'the clearing', retreat: 'the pines',
    signal: 'The activation light crossed the felled logs around the mast.',
    allowedWeather: ['none', 'rain', 'fog', 'crosswind', 'snow'],
  },
  desert: {
    arrival: 'A relay mast stood among the concrete ruins of a desert waystation.',
    approach: 'a collapsed shade wall', position: 'the dry culvert',
    scoringGround: 'the waystation', retreat: 'the empty service trench',
    signal: 'The activation light cut across the sand-dusted pavement.',
    allowedWeather: ['none', 'crosswind'],
  },
  mountain: {
    arrival: 'A relay mast stood on a mountain pass above a shale service road.',
    approach: 'a boulder near the switchback', position: 'the uphill trail',
    scoringGround: 'the pass', retreat: 'the lower switchback',
    signal: 'The activation light caught the broken shale along the pass.',
    allowedWeather: ['none', 'rain', 'fog', 'crosswind', 'snow'],
  },
  jungle: {
    arrival: 'A relay mast rose from a jungle outpost above a tangle of roots.',
    approach: 'a mossy supply crate', position: 'the narrow trail beyond the palisade',
    scoringGround: 'the outpost clearing', retreat: 'the root-choked trail',
    signal: 'The activation light picked out leaves along the perimeter.',
    allowedWeather: ['none', 'rain', 'fog'],
  },
} as const

export type AreaStoryTags = {
  location: keyof typeof AREA_LOCATIONS
  weather: AreaWeatherTag
}
