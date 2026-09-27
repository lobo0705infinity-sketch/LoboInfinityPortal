export type ArmyStoryVoice = {
  crew: string
  approach: string
  counter: string
}

// Short, fictional textures for each active army. They describe a force in
// this scene; they do not assert that a particular unit was submitted.
export const ARMY_STORY_VOICES: Record<string, ArmyStoryVoice> = {
  'panoceania': {
    crew: 'armored survey troops',
    approach: 'checked their instruments before crossing the open ground',
    counter: 'kept their signal lamps trained on the contested route',
  },
  'military-orders': {
    crew: 'armored knights',
    approach: 'advanced behind a shield marked with old campaign scars',
    counter: 'held the narrow passage with shields close together',
  },
  'kestrel-colonial-force': {
    crew: 'colonial scouts',
    approach: 'marked a second route before committing to the center',
    counter: 'watched the side approach from a sheltered position',
  },
  'neoterra-capitaline-army': {
    crew: 'capital security troops',
    approach: 'set a measured cordon around the nearest entrance',
    counter: 'kept the approach clear of anyone without their signal',
  },
  'shock-army-of-acontecimento': {
    crew: 'jungle campaign veterans',
    approach: 'split into small teams to test the blind corners',
    counter: 'covered the broken ground from several low positions',
  },
  'svalarheima-winter-force': {
    crew: 'winter patrol fighters',
    approach: 'crossed the exposed stretch with practiced restraint',
    counter: 'held their sightlines through drifting dust and smoke',
  },
  'varuna-immediate-reaction-division': {
    crew: 'rapid-response marines',
    approach: 'followed the warning markers toward the site',
    counter: 'secured a retreat lane beside the closest cover',
  },
  'yu-jing': {
    crew: 'disciplined assault teams',
    approach: 'moved in measured intervals between cover',
    counter: 'held the main approach with overlapping fire',
  },
  'imperial-service': {
    crew: 'imperial investigators',
    approach: 'followed the trail of disturbed equipment to the site',
    counter: 'watched each entrance for an attempted escape',
  },
  'invincible-army': {
    crew: 'heavy infantry columns',
    approach: 'crossed the open route behind dense armor',
    counter: 'anchored the nearest lane against a sudden push',
  },
  'white-banner': {
    crew: 'mountain-trained patrols',
    approach: 'tested the higher ground before descending',
    counter: 'watched the approaches from a broken overlook',
  },
  'ariadna': {
    crew: 'frontier patrols',
    approach: 'read the tracks left across the damaged ground',
    counter: 'held their cover without giving away a position',
  },
  'caledonian-highlander-army': {
    crew: 'highland fighters',
    approach: 'pressed forward behind a screen of scattered debris',
    counter: 'guarded the closest approach with stubborn patience',
  },
  'force-de-reponse-rapide-merovingienne': {
    crew: 'Merovingian response teams',
    approach: 'used the outer lane to reach the threatened site',
    counter: 'kept a fallback route open for their wounded',
  },
  'kosmoflot': {
    crew: 'cold-weather raiders',
    approach: 'checked the supports before taking the exposed route',
    counter: 'held the crossing from cover beside the machinery',
  },
  'tartary-army-corps': {
    crew: 'Tartary veterans',
    approach: 'advanced under the shelter of broken structures',
    counter: 'held their ground behind a rough barricade',
  },
  'usariadna-ranger-force': {
    crew: 'ranger patrols',
    approach: 'scouted the long route around the central danger',
    counter: 'kept the outer approaches under watch',
  },
  'haqqislam': {
    crew: 'field medics and escorts',
    approach: 'secured a passage before bringing their support team forward',
    counter: 'protected the route to their waiting personnel',
  },
  'hassassin-bahram': {
    crew: 'masked infiltrators',
    approach: 'used the noise of the fight to reach a side entrance',
    counter: 'watched the retreat route from deep cover',
  },
  'qapu-khalqi': {
    crew: 'port security contractors',
    approach: 'checked the cargo markings along the nearest route',
    counter: 'guarded the site as if it were a disputed shipment',
  },
  'ramah-taskforce': {
    crew: 'rescue-trained assault troops',
    approach: 'kept space for a support team behind the front line',
    counter: 'protected the shortest route back to safety',
  },
  'nomads': {
    crew: 'nomad field operators',
    approach: 'followed a flickering network trace toward the site',
    counter: 'kept a narrow comms route open under fire',
  },
  'bakunin-jurisdictional-command': {
    crew: 'Bakunin operatives',
    approach: 'slipped through the discarded equipment at the edge',
    counter: 'held cover among the broken fixtures',
  },
  'corregidor-jurisdictional-command': {
    crew: 'shipyard-hardened crews',
    approach: 'tested every gantry and ladder before crossing',
    counter: 'watched the nearest exit from a reinforced position',
  },
  'tunguska-jurisdictional-command': {
    crew: 'network security teams',
    approach: 'followed a private channel toward the disputed access',
    counter: 'guarded the terminal side of the approach',
  },
  'combined-army': {
    crew: 'alien assault troops',
    approach: 'advanced in eerie silence through the broken ground',
    counter: 'kept the nearest route under unblinking watch',
  },
  'morat-aggression-force': {
    crew: 'Morat shock fighters',
    approach: 'pushed directly toward the strongest visible position',
    counter: 'held the exposed lane without yielding ground',
  },
  'next-wave': {
    crew: 'strange forward elements',
    approach: 'followed an unfamiliar signal through the site',
    counter: 'watched the other force from an unexpected angle',
  },
  'onyx-contact-force': {
    crew: 'Onyx assault teams',
    approach: 'approached in strict formation through the open lane',
    counter: 'kept the passage under methodical observation',
  },
  'shasvastii-expeditionary-force': {
    crew: 'concealed expeditionary scouts',
    approach: 'emerged from cover only after the approach went quiet',
    counter: 'held their position without revealing every fighter',
  },
  'aleph': {
    crew: 'algorithm-guided teams',
    approach: 'compared the changing route to a live tactical map',
    counter: 'guarded the position their sensors marked as decisive',
  },
  'operations-subsection': {
    crew: 'subsection operatives',
    approach: 'tracked the signal across several possible routes',
    counter: 'watched the most likely opening through their instruments',
  },
  'steel-phalanx': {
    crew: 'phalanx veterans',
    approach: 'advanced close enough to protect one another',
    counter: 'held their line at the mouth of the passage',
  },
  'o-12': {
    crew: 'international security officers',
    approach: 'marked the site before moving to contain it',
    counter: 'kept the protected route under observation',
  },
  'starmada': {
    crew: 'fleet security teams',
    approach: 'followed the emergency traffic toward the site',
    counter: 'held the best route to an extraction point',
  },
  'torchlight-brigade': {
    crew: 'brigade responders',
    approach: 'moved toward the first distress signal they could confirm',
    counter: 'guarded a lane for the next team to enter',
  },
  'japanese-secessionist-army': {
    crew: 'secessionist fighters',
    approach: 'closed the distance behind a screen of cover',
    counter: 'held the approach with patient discipline',
  },
  'oban': {
    crew: 'Oban patrols',
    approach: 'checked the flanks before risking the central lane',
    counter: 'watched the nearer exit for a sudden counterattack',
  },
  'shindenbutai': {
    crew: 'Shindenbutai fighters',
    approach: 'pressed along the sheltered edge toward the objective',
    counter: 'kept their position ready for a sharp advance',
  },
  'tohaa': {
    crew: 'Tohaa envoys and guards',
    approach: 'examined the disturbed ground before moving closer',
    counter: 'held a protective line around their waiting team',
  },
  'dashat-company': {
    crew: 'Dashat hired guns',
    approach: 'measured the safest route against the contract deadline',
    counter: 'watched the asset from cover near the outer route',
  },
  'druze-bayram-security': {
    crew: 'Druze contract fighters',
    approach: 'marked the quickest way to the disputed asset',
    counter: 'held their firing line beside a fallback passage',
  },
  'ikari-company': {
    crew: 'Ikari mercenaries',
    approach: 'took the dangerous shortcut before it was blocked',
    counter: 'guarded the ground they had seized at a cost',
  },
  'starco': {
    crew: 'StarCo retrieval teams',
    approach: 'checked the salvage route before crossing the open site',
    counter: 'kept one escape path ready for their crew',
  },
  'white-company': {
    crew: 'White Company contractors',
    approach: 'followed a carefully marked route to the objective',
    counter: 'watched the access point from disciplined cover',
  },
}
