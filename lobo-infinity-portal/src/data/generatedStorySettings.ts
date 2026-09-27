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

// Later incidents encounter a different part of the same setting. Swapping
// complete observations avoids recycling five identical environment lines
// when two games happen to share their location and weather tags.
export const AREA_WEATHER_ALTERNATES: Record<AreaWeatherTag,
  { opening: string; complication: string; closing: string }> = {
  none: {
    opening: 'The guard could see the switch clearly, though broken cover still lined its approach.',
    complication: 'With no obstruction on the crossing, an operator had to wait for covering fire before reading the panel.',
    closing: 'The relay gave a dry click as the rival squad returned to the switch.',
  },
  rain: {
    opening: 'Rain dripped from the switch housing onto the contested approach.',
    complication: 'A soaked control face blurred the signal whenever a specialist tried to read its damaged contacts.',
    closing: 'Water tracked over the panel as a fresh burst rattled the relay.',
  },
  fog: {
    opening: 'Fog blurred the guard posted on the other side of the mast.',
    complication: 'The specialist could see the relay light but lost the far approach each time the mist thickened.',
    closing: 'A shape emerged from the fog as the relay answered with a faint click.',
  },
  crosswind: {
    opening: 'Wind pushed grit against the switch and stripped dust from the bare crossing.',
    complication: 'Each gust blew grit into the open housing and made its indicator difficult to read under fire.',
    closing: 'Another gust lifted dust over the relay before either patrol could inspect the light.',
  },
  snow: {
    opening: 'Fresh snow hid the footprints that led to the relay controls.',
    complication: 'The specialist brushed ice from the signal lamp while the other patrol watched the exposed approach.',
    closing: 'New prints converged on the mast as the relay flickered beneath falling snow.',
  },
}

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

export const AREA_LOCATION_ALTERNATES: Record<AreaStoryTags['location'],
  { arrival: string; signal: string }> = {
  relayCourtyard: {
    arrival: 'A relay mast rose above broken paving inside a courtyard with two exposed entrances.',
    signal: 'The indicator flashed across the arcade stones as a fighter moved by the wall.',
  },
  freightDepot: {
    arrival: 'A relay mast overlooked the empty tracks between two freight platforms.',
    signal: 'The indicator lit the abandoned cargo rails beneath the guarded platform.',
  },
  rooftopTerrace: {
    arrival: 'The rooftop relay mast stood between a low parapet and a maintenance hatch.',
    signal: 'The indicator cast a line over the terrace parapet as the watch shifted.',
  },
  forest: {
    arrival: 'Pines screened one edge of a clearing where the relay mast stood exposed.',
    signal: 'The indicator picked out a fallen branch as fighters crossed the clearing.',
  },
  desert: {
    arrival: 'A relay mast overlooked the empty service trench of a desert waystation.',
    signal: 'The indicator flashed across the dry pavement and vanished behind a shade wall.',
  },
  mountain: {
    arrival: 'The relay mast stood above a mountain switchback with loose shale beneath the guard’s boots.',
    signal: 'The indicator glowed across the shale while fighters edged along the pass.',
  },
  jungle: {
    arrival: 'A relay mast rose over an outpost clearing where roots broke the approach.',
    signal: 'The indicator showed through the leaves beside the outpost wall.',
  },
}
