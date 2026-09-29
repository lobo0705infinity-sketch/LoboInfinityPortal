// Fictional Area of Interest tactics, not a claim that a unit, skill, or move
// appeared in a recorded game. Keep all actions feasible for an unnamed squad.
// Broad faction themes: https://infinityuniverse.com/en
// Tohaa coordinated groups: https://infinityuniverse.com/en/news/tohaa-combat-force-repack-alpha
// Next Wave's sabotage and flexible attacks: https://infinityuniverse.com/en/factions/combined-army/next-wave
export type AreaArmyMethod = {
  initiative: string
  response: string
  followThrough: string
  winBeat: string
  drawBeat: string
}

function method(initiative: string, response: string, followThrough: string,
  winBeat: string, drawBeat: string): AreaArmyMethod {
  return { initiative, response, followThrough, winBeat, drawBeat }
}

export const AREA_ARMY_METHODS: Record<string, AreaArmyMethod> = {
  panoceania: method(
    'A surveyor marked the safest shot across the mast before the specialist left cover.',
    'The defenders measured the exposed crossing and waited for a clean firing angle.',
    'The covering shots tracked each guard who tried to interrupt the specialist.',
    'cleared a precise firing lane to the switch', 'held the surveyed lane under fire'),
  'military-orders': method(
    'An armored escort took the nearest impact and walked the specialist toward the controls.',
    'The defenders closed ranks at the base rather than surrender the switch.',
    'The escort remained beside the panel while the specialist checked its uncertain light.',
    'made the armored escort hold the relay base', 'kept its escort between the switch and incoming fire'),
  'kestrel-colonial-force': method(
    'A scout showed movement at one route while the specialist crossed by another.',
    'The defenders left the obvious approach watched and sent a guard around its edge.',
    'The scout kept drawing attention away from the operator at the panel.',
    'opened a second route to the switch', 'kept probing for an unwatched crossing'),
  'neoterra-capitaline-army': method(
    'A perimeter team marked firing sectors before releasing its specialist toward the mast.',
    'The defenders tightened the perimeter whenever a fighter crossed its boundary.',
    'The outer cordon shifted with the specialist so the panel stayed in view.',
    'sealed the perimeter around the controls', 'held a cordon beyond the mast'),
  'shock-army-of-acontecimento': method(
    'A seasoned patrol read the cover in short stages and passed the specialist forward.',
    'The defenders watched the cover breaks instead of firing at every movement.',
    'Each advancing fighter passed an open angle to the next before the operator moved.',
    'secured successive pockets of cover near the mast', 'kept advancing through broken cover'),
  'svalarheima-winter-force': method(
    'A patient patrol checked the exposed footing and moved its operator between cover points.',
    'The defenders watched the narrowest passage and made every crossing deliberate.',
    'The patrol held the difficult approach while the specialist checked the signal.',
    'controlled the narrow approach to the panel', 'waited behind cover for a safe crossing'),
  'varuna-immediate-reaction-division': method(
    'A fast response team opened an exit first, then sent the specialist toward the mast.',
    'The defenders kept their withdrawal route clear while denying the same route to an attacker.',
    'The open exit let an escort return to the panel without leaving the operator alone.',
    'kept an exit open beside the antenna', 'held an escape lane under pressure'),
  'yu-jing': method(
    'An assault team advanced by alternating volleys, making room for its operator.',
    'The defenders met each crossing with a timed shift of their firing line.',
    'The next volley came as the specialist reached for the uncertain control.',
    'maintained a staggered firing line at the mast', 'held a timed line against the crossing'),
  'imperial-service': method(
    'An investigator traced the disputed command while guards secured the route to the panel.',
    'The defenders checked each approach against the control log before changing positions.',
    'The operator kept the last command in view as the guards narrowed the gap.',
    'traced the disputed command and guarded its access route', 'kept the disputed command under watch'),
  'invincible-army': method(
    'A heavy column absorbed fire across the open route so its specialist could follow.',
    'The defenders concentrated their shots on the lead fighter and left the rear guarded.',
    'The column stayed between the operator and the far firing lane.',
    'anchored a heavy line at the antenna', 'refused to yield its exposed approach'),
  'white-banner': method(
    'A patrol worked the high and low approaches at once to find the safe route in.',
    'The defenders watched the flanks and left one fighter covering the controls.',
    'The flanking watch shifted uphill or down as the specialist tested the signal.',
    'held both flanks of the panel', 'kept looking for a way around the guarded route'),
  ariadna: method(
    'A scout followed the ground beside the obvious route and signaled a quieter crossing.',
    'The defenders used the cover itself to hide their watch on the switch.',
    'Hand signals moved the covering fighters without giving away the operator.',
    'used the ground to screen its approach', 'held a concealed route toward the controls'),
  'caledonian-highlander-army': method(
    'A charging fighter drew the guard away while the specialist followed through the gap.',
    'The defenders posted a shooter near the panel and readied a countercharge.',
    'The sudden breach held the guard back for another moment at the controls.',
    'forced a gap through the relay guard', 'pressed hard against the guarded entrance'),
  'force-de-reponse-rapide-merovingienne': method(
    'A response patrol reserved a fallback position before pushing its specialist forward.',
    'The defenders covered the return route as carefully as the antenna itself.',
    'The reserve held its ground while the operator worked within reach of the exit.',
    'kept its reserve behind the contested switch', 'kept a fallback position within reach'),
  kosmoflot: method(
    'A raider moved outside the main sightline and marked a crossing for the operator.',
    'The defenders shifted their watch from the obvious route to the far edge.',
    'The outside fighter held that distant angle while the specialist touched the panel.',
    'turned the far approach into cover for the switch', 'held an off-angle route under fire'),
  'tartary-army-corps': method(
    'Veterans fixed a guard in place before moving their operator along the covered side.',
    'The defenders held their ground and refused to chase the first moving fighter.',
    'The guard stayed pinned while the specialist listened for the relay response.',
    'pinned the guard beyond the controls', 'kept the guard occupied beside the mast'),
  'usariadna-ranger-force': method(
    'Rangers traced a low route around the mast and sent the operator behind their screen.',
    'The defenders kept eyes on the nearest cover, expecting a wide patrol.',
    'The screen spread out again as soon as the specialist reached the controls.',
    'established a wide ranger screen at the mast', 'held the long route around the controls'),
  haqqislam: method(
    'An escort protected the specialist and kept a clear path for anyone forced to withdraw.',
    'The defenders left room to recover their operator while contesting the antenna.',
    'The escort stayed close enough to pull the specialist clear if the panel sparked.',
    'kept its operator covered without closing the withdrawal route', 'kept an escort ready beside the controls'),
  'hassassin-bahram': method(
    'A hidden fighter drew the watch away from the route the real operator needed.',
    'The defenders kept their weapons on the panel and ignored the first exposed figure.',
    'The feint left only a heartbeat for the specialist to enter the disputed command.',
    'exploited the unguarded side of the controls', 'kept the true approach out of sight'),
  'qapu-khalqi': method(
    'A security detail assigned one guard to the operator and another to the exit.',
    'The defenders watched both the switch and the route a carrier would need.',
    'The second guard stayed near the exit while the first covered the operator.',
    'locked down the route beside the mast', 'held its two guarded routes open'),
  'ramah-taskforce': method(
    'A quick escort crossed first and signaled the specialist through the opening.',
    'The defenders kept a relief fighter close enough to answer a sudden breach.',
    'The escort traded places with the relief fighter as the panel changed state.',
    'kept a rotating escort beside the uncertain relay', 'kept its relief fighter near the switch'),
  nomads: method(
    'An operator followed the control signal while a second fighter masked the crossing.',
    'The defenders watched the indicator for a false change before moving away.',
    'The operator compared the flicker with the guard’s movement before calling the squad in.',
    'read the disputed signal and screened the operator', 'tracked each change in the relay signal'),
  'bakunin-jurisdictional-command': method(
    'One fighter made a noisy approach while the specialist slipped along its blind side.',
    'The defenders sent a decoy across the exposed lane while their guard watched the quieter approach.',
    'The diversion stayed close enough to draw a shot when the operator reached the switch.',
    'turned a diversion into an opening at the panel', 'kept a decoy between the guard and operator'),
  'corregidor-jurisdictional-command': method(
    'A work crew shifted loose cover into a short screen for the operator.',
    'The defenders shifted loose cover beside the switch and guarded the end of their screen.',
    'The makeshift screen stayed in place while the specialist tested the panel.',
    'screened the operator from fire with improvised cover', 'kept its makeshift screen intact'),
  'tunguska-jurisdictional-command': method(
    'A security operator compared the disputed signal with the panel’s last entry.',
    'The defenders guarded the access point rather than follow a stray relay flicker.',
    'The squad waited for the operator’s confirmation before shifting its guard.',
    'guarded the access point while checking its signal', 'kept the last control entry in sight'),
  'combined-army': method(
    'An alien assault group drew fire at the mast while its operator took another route.',
    'The defenders held their ground against the advance and watched for a second approach.',
    'The flanking operator reached the panel as the assault group increased pressure.',
    'fixed the guard and secured the second approach', 'kept the defenders facing two directions'),
  'morat-aggression-force': method(
    'A shock group drove into the firing lane and made the mast its next cover.',
    'The defenders poured fire into the lead fighter rather than abandon the switch.',
    'The pressure at the base gave the specialist another moment at the controls.',
    'pressed the relay guard through concentrated fire', 'pressed the guard back against the mast'),
  'next-wave': method(
    'A raider disturbed the far cover before the specialist approached the real switch.',
    'The defenders watched for tampering beyond the obvious route and kept a guard on the panel.',
    'The second approach remained hidden until the specialist reached the control face.',
    'used a diversion to reach the disputed controls', 'kept a second approach in reserve'),
  'onyx-contact-force': method(
    'An assault line advanced in measured bursts to push a guard off the panel.',
    'The defenders contested the central lane rather than give up its firing angle.',
    'The line stayed fixed on the guard while the specialist checked the light.',
    'drove a controlled line through the center', 'kept pressure on the central lane'),
  'shasvastii-expeditionary-force': method(
    'A scout waited for the guard to turn before guiding the specialist across.',
    'The defenders concealed their positions and fired only when the switch was approached.',
    'The scout stayed out of sight as the operator reached toward the panel.',
    'sent its operator toward the switch unseen', 'kept its concealed watch on the controls'),
  aleph: method(
    'An observer timed the guard’s turns and sent the specialist during the shortest gap.',
    'The defenders adjusted their line whenever the operator found a new timing window.',
    'The squad watched the predicted return of fire as the specialist checked the relay.',
    'timed its entry to the panel', 'measured each opening beneath the guard’s fire'),
  'operations-subsection': method(
    'A lone operator crossed ahead of the rest and marked a precise route back.',
    'The defenders tracked the first contact while keeping the switch guarded.',
    'The advance element signaled once, letting the specialist move without the whole line.',
    'covered the operator during a narrow advance', 'kept its advance element close to the switch'),
  'steel-phalanx': method(
    'A veteran led a direct charge to draw fire away from the specialist.',
    'The defenders concentrated on the lead fighter but could not leave the base uncovered.',
    'The veteran held the space gained by the charge as the panel flickered.',
    'kept its leading fighter at the contested base', 'kept its front line inside the guard’s reach'),
  'o-12': method(
    'A security cordon contained the nearest approach before its specialist tested the panel.',
    'The defenders marked a second boundary and kept intruders away from the controls.',
    'The cordon shifted to include the switch without losing sight of the exit.',
    'contained the approach around the relay', 'held the boundary between guard and operator'),
  starmada: method(
    'A fleet detail opened a safe return lane before sending its operator toward the controls.',
    'The defenders kept their line close enough to protect the route out.',
    'The return lane stayed clear while the operator waited for the signal.',
    'kept the relay and its return lane guarded', 'maintained a guarded way out of the site'),
  'torchlight-brigade': method(
    'A rapid team divided between the switch and a waiting relief position.',
    'The defenders held a responder in reserve for the next breach.',
    'The relief fighter moved when the specialist lost cover at the panel.',
    'rotated its response team around the switch', 'kept a relief position close to the mast'),
  'japanese-secessionist-army': method(
    'A close fighter threatened the guard while the specialist advanced through its blind angle.',
    'The defenders kept one weapon on the approaching fighter and another on the panel.',
    'The close threat held the guard in place until the operator reached the switch.',
    'opened the controls with a close feint', 'kept a fighter within reach of the guard'),
  oban: method(
    'Scouts took separate approaches and waited for the guard to choose one.',
    'The defenders spread their watch to cover both ends of the mast.',
    'The unchosen scout covered the specialist from the side the guard left exposed.',
    'opened a split approach toward the relay', 'held two approaches just outside the guard’s view'),
  shindenbutai: method(
    'A forward fighter found a blind angle and waved the specialist toward it.',
    'The defenders watched for a sudden close move near the base.',
    'The forward fighter stayed near enough to interrupt anyone reaching for the operator.',
    'kept the guard occupied at close range', 'held a blind angle beside the relay'),
  tohaa: method(
    'Three fighters exchanged positions around the specialist, keeping the switch covered from either side.',
    'The defenders rotated a three-fighter screen around the panel and watched both flanks.',
    'The three-point screen closed around the operator as the relay changed color.',
    'kept its three-point screen at the controls', 'kept rotating its three-point escort'),
  'dashat-company': method(
    'A hired guard covered the operator while a second team bargained for ground with fire.',
    'The defenders guarded the valuable panel and refused a costly chase.',
    'The two covering groups kept separate angles as the specialist worked.',
    'screened the mast with overlapping hired guns', 'kept two firing angles on the switch'),
  'druze-bayram-security': method(
    'A contract team established a hard firing angle before committing its specialist.',
    'The defenders held the best cover and made every crossing costly.',
    'The firing angle stayed fixed while the operator checked the disputed command.',
    'locked a firing angle across the relay', 'held its contract line under pressure'),
  'ikari-company': method(
    'A reckless fighter rushed one side to pull the guard off the operator’s route.',
    'The defenders sent a reckless fighter into the open to draw fire away from their specialist.',
    'The forward fighter kept the guard busy as the operator made a hurried attempt.',
    'made its sudden breach hold at the switch', 'kept pressing despite the exposed crossing'),
  starco: method(
    'A retrieval team marked the way out before moving the specialist toward the mast.',
    'The defenders kept an exit watched in case the operator tried to slip away.',
    'The marked route stayed clear while the squad waited on the panel’s answer.',
    'marked a route back while its operator checked the controls', 'held a marked path away from the controls'),
  'white-company': method(
    'A guard team covered two approaches and let its specialist choose the quieter one.',
    'The defenders denied the easy lane without abandoning the switch.',
    'The second covering fighter kept watch while the specialist read the indicator.',
    'set a steady guard line beside the panel', 'kept both approaches under watch'),
}
