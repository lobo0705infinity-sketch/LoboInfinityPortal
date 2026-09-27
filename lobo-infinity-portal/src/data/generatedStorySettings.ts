// Fictional setting tags for the Area of Interest editorial pilot. The game
// record does not store terrain or weather, so these are narrative variants,
// not claims about the table on which a match was played.
import type { ArmyStoryStyle } from './generatedStoryArmies.ts'

export const AREA_LOCATIONS = {
  relayCourtyard: {
    arrival: 'A relay mast stood in a walled courtyard beside a collapsed arcade.',
    approach: 'the arcade rubble', position: 'the breach in the far wall',
    scoringGround: 'the courtyard', retreat: 'the broken wall',
    signal: 'The activation light washed over the fallen stone at the mast’s base.',
  },
  freightDepot: {
    arrival: 'A relay mast rose between abandoned freight carriers at a depot.',
    approach: 'a parked cargo carrier', position: 'the raised loading platform',
    scoringGround: 'the loading lanes', retreat: 'the parked carriers',
    signal: 'The activation light spread across the empty loading rails.',
  },
  rooftopTerrace: {
    arrival: 'A relay mast stood on a rooftop terrace above the transit lines.',
    approach: 'a concrete planter', position: 'the maintenance stair',
    scoringGround: 'the rooftop', retreat: 'the stairwell',
    signal: 'The activation light caught the low parapet overlooking the tracks.',
  },
} as const

export const AREA_WEATHER = {
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
} as const

export type AreaStoryTags = {
  location: keyof typeof AREA_LOCATIONS
  weather: keyof typeof AREA_WEATHER
}

// These are ways a side changes the fight, rather than labels for its crew.
// They remain broad until the actual roster can support finer unit-specific
// tactics. The rescue/covert comparison is the Tohaa/Next Wave pilot.
export const AREA_METHODS: Record<ArmyStoryStyle, {
  initiative: string; response: string; followThrough: string
}> = {
  assault: {
    initiative: 'The advance went straight through the fire, with the switch as its next point of cover.',
    response: 'The defenders concentrated their fire on the open approach instead of chasing the first attacker.',
    followThrough: 'The pressure on the mast gave the specialist a moment to work before the guards returned.',
  },
  armored: {
    initiative: 'Covering fire kept the guard low while a specialist crossed the last stretch to the mast.',
    response: 'The defenders set a firing line across the controls and waited for a clear target.',
    followThrough: 'The covering line stayed in place as the specialist tried to secure the panel.',
  },
  flanking: {
    initiative: 'A fighter circled the cover to draw attention while the specialist approached from another angle.',
    response: 'The defenders shifted their watch to the side passage and kept the controls in sight.',
    followThrough: 'The flanking fighter held the far approach as the specialist reached for the switch.',
  },
  guard: {
    initiative: 'The squad formed a short firing line and moved its specialist forward behind the nearest cover.',
    response: 'The defenders held the mast instead of breaking formation to pursue the exposed fighter.',
    followThrough: 'The line closed around the controls while the specialist checked the uncertain signal.',
  },
  rescue: {
    initiative: 'An escort screened the specialist while the rest kept an open path back from the mast.',
    response: 'The defenders moved around the mast in short bounds, keeping an escape route through the fire.',
    followThrough: 'The escort closed around the specialist, leaving a guard on the contested ground.',
  },
  covert: {
    initiative: 'A false rush across open ground drew attention from the real approach to the switch.',
    response: 'The defenders watched the controls from concealment and fired at the first exposed figure.',
    followThrough: 'The feint bought the specialist one more moment beside the panel before the return fire came.',
  },
  technical: {
    initiative: 'A scout traced the active lead while the specialist followed the safer route to the controls.',
    response: 'The defenders watched the panel’s indicator and covered the route the next operator would need.',
    followThrough: 'The squad watched the indicator change while its specialist waited for confirmation.',
  },
  contract: {
    initiative: 'Two fighters traded covering angles while their specialist crossed the exposed ground to the mast.',
    response: 'The defenders held the higher angle and made each advance on the controls costly.',
    followThrough: 'The covering fighters kept their angles as the specialist worked under pressure.',
  },
}
