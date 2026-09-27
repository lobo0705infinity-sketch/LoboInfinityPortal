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

export const AREA_WEATHER_EARLY: Record<AreaWeatherTag,
  { opening: string; complication: string; closing: string }> = {
  none: {
    opening: 'The exposed panel stood in clear view of both patrols.',
    complication: 'A clear view of the controls made every step toward the switch visible to the opposing gun line.',
    closing: 'The relay light changed while the approach stayed open to both crews.',
  },
  rain: {
    opening: 'Rain splashed against the relay base as the operator approached its switch.',
    complication: 'Drops ran over the input face, obscuring the code beneath the specialist’s hand.',
    closing: 'The aerial hummed under the rainfall as another fighter moved into the lane.',
  },
  fog: {
    opening: 'Fog gathered beyond the mast and hid the patrol approaching from that side.',
    complication: 'The specialist could reach the panel but could not see the guard shifting in the mist.',
    closing: 'The signal lamp glimmered through fog as both crews closed on the crossing.',
  },
  crosswind: {
    opening: 'Wind struck the antenna cover, leaving the switch rattling in its loose housing.',
    complication: 'A sudden gust threw grit against the code display while both patrols fought for the open lane.',
    closing: 'The cover banged against the mast once more while the indicator flickered.',
  },
  snow: {
    opening: 'Snow fell onto the control face as two sets of tracks approached the relay.',
    complication: 'A crust of ice slipped over the switch just as the specialist began to read it.',
    closing: 'Tracks crossed the fresh snow below the aerial as its light changed.',
  },
}

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

// The fourth incident has its own environmental beat even when two generated
// games share the same setting tags and draw adjacent incident indices.
export const AREA_WEATHER_LATE: typeof AREA_WEATHER_ALTERNATES = {
  none: {
    opening: 'Nothing obscured the relay, and each patrol saw the other approach its exposed panel.',
    complication: 'The control face lay in clear view of both gun lines, leaving no sheltered way to reach it.',
    closing: 'The unshielded relay blinked while another fighter crossed the opening.',
  },
  rain: {
    opening: 'Rain traced a path down the aerial and pooled beneath its damaged switch.',
    complication: 'The wet control seam threatened to short when an operator pressed the exposed input.',
    closing: 'Drops struck the housing again as the rival patrol reached the mast.',
  },
  fog: {
    opening: 'Mist drifted low over the relay base, leaving only the signal lamp visible.',
    complication: 'A guard fired at the moving lamp as the operator lost sight of the panel edge.',
    closing: 'A bank of fog swallowed the crossing while the relay kept blinking.',
  },
  crosswind: {
    opening: 'A crosswind tugged at the relay cover and scraped grit across the controls.',
    complication: 'A gust caught the loose cover while a specialist reached past it for the input.',
    closing: 'Grit rattled against the aerial as the second patrol moved into the open.',
  },
  snow: {
    opening: 'Snow packed the foot of the relay, hiding tracks between the competing approaches.',
    complication: 'The panel release froze beneath a fresh drift as the operator struggled to lift it.',
    closing: 'The antenna light flashed through snowfall as fighters closed on the switch.',
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

export const AREA_LOCATION_EARLY: Record<AreaStoryTags['location'],
  { arrival: string; signal: string }> = {
  relayCourtyard: {
    arrival: 'The courtyard’s relay mast faced a breached wall and a row of collapsed arches.',
    signal: 'The indicator lit the stone beside the courtyard breach.',
  },
  freightDepot: {
    arrival: 'The relay mast rose above a freight depot’s empty loading lanes.',
    signal: 'The indicator shone over the platform lip near the nearest cargo carrier.',
  },
  rooftopTerrace: {
    arrival: 'A transit-yard rooftop held a relay mast beside a broken terrace parapet.',
    signal: 'The indicator cut across a maintenance hatch as the squad crossed the roof.',
  },
  forest: {
    arrival: 'A relay mast stood where a forest trail met a clearing full of fallen wood.',
    signal: 'The indicator broke through branches at the edge of the clearing.',
  },
  desert: {
    arrival: 'The relay mast overlooked the cracked paving of a desert waystation.',
    signal: 'The indicator reached the dry culvert beyond the service trench.',
  },
  mountain: {
    arrival: 'A relay mast marked the bend of a mountain road above loose shale.',
    signal: 'The indicator traced a line over the narrow switchback.',
  },
  jungle: {
    arrival: 'The relay mast stood beyond an outpost palisade amid thick jungle roots.',
    signal: 'The indicator filtered through broad leaves beside the outpost trail.',
  },
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

export const AREA_LOCATION_LATE: typeof AREA_LOCATION_ALTERNATES = {
  relayCourtyard: {
    arrival: 'Broken arcade stone surrounded the relay mast in a walled courtyard.',
    signal: 'The indicator cast its light onto the stones beside a contested courtyard entrance.',
  },
  freightDepot: {
    arrival: 'A relay mast faced the empty freight tracks between two unloading sheds.',
    signal: 'The indicator flickered across a carrier wheel as the guards changed position.',
  },
  rooftopTerrace: {
    arrival: 'A relay mast stood near a narrow hatch on a terrace above the transit yard.',
    signal: 'The indicator reflected from the parapet while a patrol climbed the maintenance stair.',
  },
  forest: {
    arrival: 'The relay mast divided a forest clearing between two dense stands of pines.',
    signal: 'The indicator caught the bark of a fallen trunk beside the clearing.',
  },
  desert: {
    arrival: 'A desert waystation’s relay mast stood beyond a collapsed wall of shade blocks.',
    signal: 'The indicator reached across the abandoned service trench.',
  },
  mountain: {
    arrival: 'A shale road curled below the relay mast on a narrow mountain pass.',
    signal: 'The indicator flashed over the uphill trail while loose stones rolled below.',
  },
  jungle: {
    arrival: 'Roots divided the path to a jungle outpost’s relay mast.',
    signal: 'The indicator pierced a curtain of leaves beside the outpost palisade.',
  },
}
