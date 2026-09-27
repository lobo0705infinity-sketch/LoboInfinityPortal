// Fictional tactical choices for mission stories outside Area of Interest.
// These describe an unnamed force, not verified moves, gear, or units in a
// submitted roster. {ground} and {position} bind the choice to the mission's
// contested ground and defended position without inventing a completed goal.
// Broad faction inspiration: https://infinityuniverse.com/en
export type MissionArmyMethod = {
  maneuver: string
  defense: string
  followThrough: string
  winClause: string
  drawBeat: string
}

function method(maneuver: string, defense: string, followThrough: string,
  winClause: string, drawBeat: string): MissionArmyMethod {
  return { maneuver, defense, followThrough, winClause, drawBeat }
}

export const MISSION_ARMY_METHODS: Record<string, MissionArmyMethod> = {
  panoceania: method(
    'A measured volley opened a protected lane toward {ground}.',
    'The defenders watched the approach to {position} for a clean shot.',
    'The covering line kept {ground} in view as the forward fighters moved.',
    'its measured firing lane stayed covered through the last exchange',
    'held a surveyed lane under fire'),
  'military-orders': method(
    'An armored escort took the hardest fire on the way to {ground}.',
    'The defenders closed ranks around {position} instead of yielding shelter.',
    'The escort held the approach to {ground} as another threat emerged.',
    'its armored screen remained between the enemy and the advance',
    'kept an armored escort at the front'),
  'kestrel-colonial-force': method(
    'A scout drew the watch toward {position} while another fighter crossed toward {ground}.',
    'The defenders watched the route past {position} and sent one guard around its edge.',
    'The distant scout kept attention from the crossing toward {ground}.',
    'its second route stayed open after the first drew enemy fire',
    'probed for an unwatched crossing'),
  'neoterra-capitaline-army': method(
    'A perimeter detail divided the approach to {ground} into guarded sectors.',
    'The defenders tightened their cordon around {position} when a fighter tested it.',
    'The outer guards moved with the line facing {ground}, leaving no opening behind it.',
    'its outer cordon closed around the decisive ground',
    'maintained a cordon beyond the fighting'),
  'shock-army-of-acontecimento': method(
    'Veterans worked through cover toward {ground} without offering one fixed target.',
    'The defenders watched the breaks in cover near {position} instead of firing blindly.',
    'Each fighter held a covered step toward {ground} until another could cross.',
    'its patrol secured successive pockets of cover',
    'kept advancing through broken cover'),
  'svalarheima-winter-force': method(
    'A patient patrol checked its footing before crossing toward {ground}.',
    'The defenders guarded the narrowest passage beside {position}.',
    'The rear guard kept watch on the last exposed step toward {ground}.',
    'its patient advance controlled the narrow route',
    'waited behind hard cover for another opening'),
  'varuna-immediate-reaction-division': method(
    'A response team marked a safe exit while its front moved toward {ground}.',
    'The defenders kept a withdrawal lane clear behind {position}.',
    'The forward element could still fall back from {ground} without crossing open fire.',
    'its protected exit survived the final counterpush',
    'kept a guarded escape lane within reach'),
  'yu-jing': method(
    'An assault team alternated volleys along the approach to {ground}.',
    'The defenders shifted their firing line in time with the movement near {position}.',
    'A fresh volley covered the last exposed stretch toward {ground}.',
    'its staggered line held through the final exchange',
    'maintained a disciplined line under pressure'),
  'imperial-service': method(
    'An investigator read the patrol around {position} and found an interval toward {ground}.',
    'The defenders checked every approach to {position} before committing their reserve.',
    'The guards used the change of watch to close the gap toward {ground}.',
    'its guard detail closed the last uncovered interval',
    'kept the opposing movements under watch'),
  'invincible-army': method(
    'A heavy column absorbed return fire on the narrow route toward {ground}.',
    'The defenders concentrated fire before the lead fighter could pass {position}.',
    'The column sheltered its forward element on the exposed approach to {ground}.',
    'its heavy line remained anchored at the front',
    'refused to yield the exposed approach'),
  'white-banner': method(
    'A patrol tested two elevations for a path toward {ground}.',
    'The defenders guarded both flanks of {position} with one fighter held back.',
    'The flank watch shifted to cover the clearer route toward {ground}.',
    'its high and low approaches stayed covered',
    'kept looking around the guarded route'),
  ariadna: method(
    'Scouts read the terrain between their cover and {ground} for a quiet crossing.',
    'The defenders used the terrain around {position} to conceal their watch.',
    'Hand signals moved the covering fighters closer to {ground} without exposing the patrol.',
    'its concealed approach survived the last search',
    'held a quiet route across the ground'),
  'caledonian-highlander-army': method(
    'A charging fighter drew fire away from the gap toward {ground}.',
    'The defenders braced at {position} with a shooter behind the front.',
    'The breach beside {ground} held just long enough for another fighter to cross.',
    'its sudden breach split the opposing guard',
    'pressed hard against the guarded entrance'),
  'force-de-reponse-rapide-merovingienne': method(
    'A response patrol marked a fallback position before advancing toward {ground}.',
    'The defenders covered the return route from {position} as carefully as its approach.',
    'The reserve remained within reach of {ground} when fresh fire caught the advance.',
    'its fallback position protected the last advance',
    'held a reserve within reach of the fight'),
  kosmoflot: method(
    'A raider marked an off-angle crossing toward {ground} outside the main sightline.',
    'The defenders shifted their watch toward the far edge of {position}.',
    'The outside fighter held an angle on the route into {ground}.',
    'its off-angle route remained open at the end',
    'held a distant approach under fire'),
  'tartary-army-corps': method(
    'Veterans pinned a guard near {position} before moving toward {ground}.',
    'The defenders held their ground at {position} instead of chasing the first fighter.',
    'The pinned guard stayed occupied while the forward group edged toward {ground}.',
    'its steady pressure kept the opposing guard fixed',
    'kept the nearest guard occupied'),
  'usariadna-ranger-force': method(
    'Rangers split around {position}; one scout drew the guard away from {ground}.',
    'The defenders watched the cover around {position} for the patrol’s wider flank.',
    'The outer rangers folded toward {ground} when the lead fighters met resistance.',
    'its ranger screen closed around the remaining route',
    'kept a long way around under watch'),
  haqqislam: method(
    'An escort kept a clear route back from {ground} as the forward group advanced.',
    'The defenders watched {position} while preserving a lane for anyone forced back.',
    'The escort stayed close enough to pull a fighter clear of {ground} if fire returned.',
    'its protected withdrawal route remained open',
    'kept an escort ready near the front'),
  'hassassin-bahram': method(
    'A hidden fighter drew the watch off the route to {ground}.',
    'The defenders ignored the first figure near {position} and watched for another approach.',
    'The feint left a brief opening toward {ground} before the guard could turn.',
    'its concealed approach escaped the last guard',
    'kept the true route out of sight'),
  'qapu-khalqi': method(
    'A security detail sent one guard toward {ground} and another to the exit.',
    'The defenders watched both {position} and the route back from it.',
    'The exit guard stayed in place while the lead crossed toward {ground}.',
    'its two guarded routes remained connected',
    'covered both the advance and retreat'),
  'ramah-taskforce': method(
    'A quick escort crossed toward {ground} and signaled the next fighter through.',
    'The defenders kept a relief fighter close enough to reinforce {position}.',
    'A fresh escort took the exposed place on the route to {ground}.',
    'its rotating escort preserved the opening',
    'held its relief fighters near the front'),
  nomads: method(
    'An operator watched the guard at {position} and timed a crossing toward {ground}.',
    'The defenders checked each movement around {position} before leaving their post.',
    'The operator waited to signal until the fighters near {ground} cleared the line.',
    'its timed crossing carried the forward group through',
    'tracked each shift in the opposing line'),
  'bakunin-jurisdictional-command': method(
    'One fighter rushed at {position} while another crossed toward {ground} unseen.',
    'The defenders held fire on the decoy at {position} and waited for quieter movement.',
    'The diversion still threatened to draw a shot as fighters neared {ground}.',
    'its noisy feint concealed the decisive crossing',
    'kept a decoy between the front and guard'),
  'corregidor-jurisdictional-command': method(
    'A work crew shifted loose cover into a short screen toward {ground}.',
    'The defenders braced movable cover beside {position}.',
    'The makeshift screen hid the crossing toward {ground} as the front found another angle.',
    'its improvised cover sheltered the final move',
    'kept its makeshift screen intact'),
  'tunguska-jurisdictional-command': method(
    'A security operator compared the watch at {position} with a second route to {ground}.',
    'The defenders guarded access to {position} rather than follow a false opening.',
    'The squad waited for confirmation before shifting its guard toward {ground}.',
    'its guarded access route stayed clear',
    'kept the changing watch under scrutiny'),
  'combined-army': method(
    'An alien assault group drew fire at {position} while another element approached {ground}.',
    'The defenders faced the advance toward {position} without losing sight of its flank.',
    'The outer element pressed toward {ground} when the assault group increased pressure.',
    'its two-pronged pressure broke the opposing watch',
    'kept defenders facing two directions'),
  'morat-aggression-force': method(
    'A shock group drove through the firing lane on its way to {ground}.',
    'The defenders poured fire into the lead fighters rather than leave {position}.',
    'The pressure beside {ground} gave the rest another moment to move.',
    'its front survived the concentrated return fire',
    'pressed the nearest guard backward'),
  'next-wave': method(
    'A raider drew the watch off {position} while another approached {ground}.',
    'The defenders watched the blind side of {position} for a second approach.',
    'The route toward {ground} stayed concealed until the lead fighters drew close.',
    'its diversion drew the last watch away',
    'kept a second approach in reserve'),
  'onyx-contact-force': method(
    'An assault line pinned a guard on the approach to {ground}.',
    'The defenders contested the lane past {position} instead of surrendering its angle.',
    'The line kept the guard fixed while the forward element edged toward {ground}.',
    'its controlled line held the center',
    'maintained pressure along the center'),
  'shasvastii-expeditionary-force': method(
    'A scout waited for the watch on {position} to turn before crossing toward {ground}.',
    'The defenders stayed concealed around {position} until the nearest fighter committed.',
    'The forward scout remained unseen while the others approached {ground}.',
    'its unseen approach passed the nearest guard',
    'kept a concealed watch on the route'),
  aleph: method(
    'An observer timed the guard at {position} and sent fighters toward {ground} in the gap.',
    'The defenders adjusted their watch on {position} to close each timing window.',
    'The group moved toward {ground} just before the predicted return of fire.',
    'its precise timing protected the decisive advance',
    'measured each opening beneath enemy fire'),
  'operations-subsection': method(
    'A lone operator crossed toward {ground} and marked a precise route back.',
    'The defenders tracked first contact near {position} while watching the rear.',
    'The advance element signaled near {ground}, letting the rear move independently.',
    'its isolated advance element rejoined the line',
    'kept its advance element in reach'),
  'steel-phalanx': method(
    'A veteran charged toward {ground} to draw fire from the following fighters.',
    'The defenders watched the leader near {position} without uncovering the flank.',
    'The veteran held the approach to {ground} as the rest crossed.',
    'its leading fighter kept the breach open',
    'held its front line inside the guard’s reach'),
  'o-12': method(
    'A security cordon contained the approach to {ground} before moving forward.',
    'The defenders marked a boundary around {position} to keep intruders away.',
    'The cordon shifted toward {ground} without exposing its exit.',
    'its cordon contained the final counterpush',
    'held a boundary between the forces'),
  starmada: method(
    'A fleet detail marked a return lane while the front approached {ground}.',
    'The defenders held {position} while leaving themselves a route out.',
    'The return lane from {ground} remained guarded as the lead fighters moved.',
    'its guarded way back stayed open',
    'maintained a protected way out'),
  'torchlight-brigade': method(
    'A response team split between the line at {ground} and a relief position.',
    'The defenders kept a responder near {position} for the next breach.',
    'A relief fighter moved toward {ground} when the forward guard lost cover.',
    'its relief line answered the final breach',
    'kept a relief position close to the front'),
  'japanese-secessionist-army': method(
    'A close fighter threatened the guard at {position} while others approached {ground}.',
    'The defenders watched the fighter near {position} and kept another weapon on the flank.',
    'The close threat held the guard away from {ground} as the rest crossed.',
    'its close feint opened a route past the guard',
    'kept a fighter within reach of the guard'),
  oban: method(
    'Scouts split around {position} and waited for the guard to choose a route to {ground}.',
    'The defenders spread their watch to both sides of {position}.',
    'The unchosen scout covered the exposed route toward {ground}.',
    'its split approach outlasted the nearest watch',
    'held two approaches just outside the guard’s view'),
  shindenbutai: method(
    'A forward fighter found a blind angle past {position} and signaled toward {ground}.',
    'The defenders watched {position} for a sudden close move.',
    'The forward fighter guarded the path to {ground} against a counterattack.',
    'its blind-side advance cleared the final obstacle',
    'held a blind angle beside the fighting'),
  tohaa: method(
    'Three fighters rotated around the lead element on the approach to {ground}.',
    'The defenders tracked the shifting screen near {position} and tried to split it.',
    'The three-point screen closed toward {ground} when the opposing guard shifted.',
    'its rotating screen kept the advance together',
    'kept rotating its three-point escort'),
  'dashat-company': method(
    'A hired guard covered the path to {ground} while another group traded ground for fire.',
    'The defenders held {position} and refused an expensive chase.',
    'Two hired groups covered different angles toward {ground} as the lead moved.',
    'its overlapping hired guns protected the advance',
    'held two firing angles through the exchange'),
  'druze-bayram-security': method(
    'A contract team fixed a firing angle across the approach to {ground}.',
    'The defenders held their best cover beside {position}, making the crossing costly.',
    'The fixed angle covered the crossing toward {ground} as the lead advanced.',
    'its contract line held against the final push',
    'kept a fixed angle on the approach'),
  'ikari-company': method(
    'A reckless fighter rushed past {position}, pulling its guard off the route to {ground}.',
    'The defenders let the rush pass {position} and waited for the fighters behind it.',
    'The forward fighter kept the guard busy while the others hurried toward {ground}.',
    'its sudden breach survived the counterattack',
    'pressed ahead despite the exposed crossing'),
  starco: method(
    'A retrieval team marked a way back before committing its front toward {ground}.',
    'The defenders watched the exit beside {position} for a withdrawal.',
    'The marked route from {ground} stayed open as the forward group committed.',
    'its retrieval route stayed protected to the end',
    'held a marked path away from the fight'),
  'white-company': method(
    'A guard team covered two approaches to {ground} and chose the quieter one.',
    'The defenders denied the easy lane toward {position} without leaving their post.',
    'A second covering fighter kept watch over the crossing toward {ground}.',
    'its steady guard line survived the last exchange',
    'kept both approaches under watch'),
}

// A second, authored decision for each force. Alternating these by mission
// changes what a force actually does, instead of concealing the same move
// behind a new object name. Both slots denote places, never a guard or unit.
export const MISSION_ARMY_ALTERNATE_MANEUVERS: Record<string, string> = {
  panoceania: 'Two gunners measured the approach from {position}, then moved their covering fire ahead of the specialist bound for {ground}.',
  'military-orders': 'The escort drew the heaviest volley near {position}; its second rank kept advancing toward {ground} behind that armor.',
  'kestrel-colonial-force': 'The exposed route past {position} failed, so a second scout signaled a quieter turn toward {ground}.',
  'neoterra-capitaline-army': 'Rather than rush {ground}, the perimeter team pinned a threat near {position} and narrowed the unguarded gap.',
  'shock-army-of-acontecimento': 'A veteran covered the next break beyond {position}; the others crossed it one by one toward {ground}.',
  'svalarheima-winter-force': 'The patrol held at {position} until its rear fighter found firm footing for a crossing toward {ground}.',
  'varuna-immediate-reaction-division': 'The response team doubled back from {position} to clear a return route before pressing on toward {ground}.',
  'yu-jing': 'One firing element checked the threat at {position} while another advanced toward {ground} between volleys.',
  'imperial-service': 'The investigator used a change of watch at {position} to send a reserve along the route to {ground}.',
  'invincible-army': 'The front absorbed a fresh burst near {position}; a shielded fighter took the opening toward {ground}.',
  'white-banner': 'The high route past {position} drew fire, leaving the low patrol a moment to edge toward {ground}.',
  ariadna: 'A scout signaled from {position}, and the quiet patrol crossed toward {ground} while the guard searched elsewhere.',
  'caledonian-highlander-army': 'The first rush struck the guard at {position}; a following fighter used the breach to approach {ground}.',
  'force-de-reponse-rapide-merovingienne': 'With the reserve sheltered near {position}, the response patrol could challenge {ground} without losing its fallback route.',
  kosmoflot: 'The far raider kept a different angle on {position}, allowing the forward group to approach {ground} out of its sightline.',
  'tartary-army-corps': 'A veteran fixed the nearest shooter by {position}; the rest advanced toward {ground} under that pressure.',
  'usariadna-ranger-force': 'The wider ranger patrol passed behind {position} and closed from the side as the lead neared {ground}.',
  haqqislam: 'The escort recovered a fighter pinned by {position}, then reopened the route that led toward {ground}.',
  'hassassin-bahram': 'A second shadow drew the guard toward {position}, giving the concealed fighter a brief route to {ground}.',
  'qapu-khalqi': 'The rear guard secured an exit near {position} before the contract team committed its lead toward {ground}.',
  'ramah-taskforce': 'When the first escort stopped at {position}, a relief fighter took its place and carried the advance toward {ground}.',
  nomads: 'The operator saw the guard shift beside {position} and signaled the crossing toward {ground} before the watch reset.',
  'bakunin-jurisdictional-command': 'The loud diversion at {position} drew a response, and the quieter fighter made for {ground} through the resulting gap.',
  'corregidor-jurisdictional-command': 'A crew braced salvaged cover at {position}; behind it, the forward fighter closed on {ground}.',
  'tunguska-jurisdictional-command': 'A security operator held the team at {position} until a second observation confirmed a clear approach to {ground}.',
  'combined-army': 'The first alien element held the defenders at {position}; another advanced toward {ground} through the pressure on their flank.',
  'morat-aggression-force': 'The lead fighter endured a burst at {position}, and the shock group drove straight on toward {ground}.',
  'next-wave': 'A raider showed itself by {position} to draw fire while the hidden approach to {ground} stayed open.',
  'onyx-contact-force': 'The assault line drove its fire into the gap at {position}, advancing toward {ground} only when the guard pulled back.',
  'shasvastii-expeditionary-force': 'The scout let the guard pass {position} before signaling a concealed crossing toward {ground}.',
  aleph: 'The observer predicted the next volley from {position}, then moved the team toward {ground} in the short interval.',
  'operations-subsection': 'The advance operator marked a retreat from {position} before committing alone to the route toward {ground}.',
  'steel-phalanx': 'A leading veteran stood under fire at {position} long enough for the others to break toward {ground}.',
  'o-12': 'The cordon held an outer boundary at {position} and sent a guarded element through toward {ground}.',
  starmada: 'A fleet detail posted a guard at {position}; its front then pushed toward {ground} with a way back secured.',
  'torchlight-brigade': 'The relief fighter moved up from {position} and took the exposed lane toward {ground} from the wounded front.',
  'japanese-secessionist-army': 'The nearest fighter threatened a close strike at {position}, diverting attention from the crossing toward {ground}.',
  oban: 'Two scouts tested opposite sides of {position}; the unchallenged one signaled the route to {ground}.',
  shindenbutai: 'A forward fighter slipped around {position} and interrupted the guard before the rest approached {ground}.',
  tohaa: 'The rotating trio passed the lead between them at {position}, keeping the same protected approach to {ground}.',
  'dashat-company': 'Two hired gunners traded angles across {position} so the forward group could cover the last stretch to {ground}.',
  'druze-bayram-security': 'The contract gunner kept a fixed angle over {position}, making room for another fighter to cross toward {ground}.',
  'ikari-company': 'A fast rush pulled the defender away from {position}; the following fighter crossed toward {ground} before it returned.',
  starco: 'The retrieval team marked the return route at {position}, then sent its lead to secure an approach to {ground}.',
  'white-company': 'One guard covered the lane at {position} as a second chose the quieter approach to {ground}.',
}

// Two more decisions for each force. A mission and incident rotate the four
// authored choices, so the same crew does not use the same noun-swapped move
// each time it appears near a different objective. The incident's obstruction
// and the opposing defense supply the immediate reason for the choice.
export const MISSION_ARMY_PIVOT_MANEUVERS: Record<string, readonly [string, string]> = {
  panoceania: [
    'Survey troops shifted a firing lane away from {position} to screen a closer approach to {ground}.',
    'An observer called the advance back from {ground} until a second gunner covered its blind side.' ],
  'military-orders': [
    'One knight held the exposed crossing near {position} while the escort turned toward {ground}.',
    'The armored lead yielded its place to a fresh escort before pressing closer to {ground}.' ],
  'kestrel-colonial-force': [
    'A scout left a false trail by {position}; the patrol followed the unseen path toward {ground}.',
    'The colonial patrol pulled back from the obvious gap and tested a farther route into {ground}.' ],
  'neoterra-capitaline-army': [
    'The security detail closed an outer gap before sending a small unit toward {ground}.',
    'Instead of pursuing the first movement at {position}, the cordon screened the route into {ground}.' ],
  'shock-army-of-acontecimento': [
    'Veterans cut across the broken cover near {position} to reach the blind side of {ground}.',
    'One fighter drew the near watch while another bounded between shelters toward {ground}.' ],
  'svalarheima-winter-force': [
    'The patrol abandoned an unstable crossing by {position} and followed firmer ground toward {ground}.',
    'A rear fighter took the forward watch as the first patrol withdrew from the exposed route to {ground}.' ],
  'varuna-immediate-reaction-division': [
    'Marines cleared a route back from {ground} before their forward detail crossed the open lane.',
    'A relief element took over at {position}, freeing the first response team to advance toward {ground}.' ],
  'yu-jing': [
    'A second firing element took over the volley as the first team moved toward {ground}.',
    'The assault line paused at {position} to draw the enemy response before shifting fire toward {ground}.' ],
  'imperial-service': [
    'An investigator followed the change of watch at {position} and sent guards along the quiet side of {ground}.',
    'The detail held back its reserve until the guard near {position} exposed a route into {ground}.' ],
  'invincible-army': [
    'The heavy column tightened around its exposed lead and pressed toward {ground} under fire.',
    'A shielded fighter took the last vulnerable step while the rest held the approach to {ground}.' ],
  'white-banner': [
    'The high patrol drew fire by {position}, allowing the lower group to close on {ground}.',
    'After testing the low route, a scout took the steeper flank toward {ground} instead.' ],
  ariadna: [
    'Scouts used the noise at {position} to slip another patrol across toward {ground}.',
    'The lead vanished into cover, leaving the guard unsure which trail led to {ground}.' ],
  'caledonian-highlander-army': [
    'A charging fighter held the nearest gun at {position} while comrades made for {ground}.',
    'The first rush broke off and drew pursuit away from the second strike toward {ground}.' ],
  'force-de-reponse-rapide-merovingienne': [
    'A reserve kept the route back from {ground} open while the response patrol probed ahead.',
    'The patrol exchanged places with its sheltered relief squad before testing the gap at {position}.' ],
  kosmoflot: [
    'A distant raider held the watch at {position} as another crossed toward {ground} from the side.',
    'The outside fighter shifted its angle instead of following the crowded approach into {ground}.' ],
  'tartary-army-corps': [
    'A veteran drew return fire near {position}; the rest closed on {ground} during the reload.',
    'The patrol refused to chase the retreating guard and held its lane into {ground}.' ],
  'usariadna-ranger-force': [
    'Rangers moved their wider patrol behind {position} while the lead kept pressure on {ground}.',
    'The nearest fighter yielded ground to pull a guard away from the side route into {ground}.' ],
  haqqislam: [
    'The escort recovered a pinned fighter before sending its relief group toward {ground}.',
    'A field team held shelter near {position} while its protected lead crossed toward {ground}.' ],
  'hassassin-bahram': [
    'A concealed fighter waited for the guard at {position} to chase the visible decoy.',
    'The false approach ended at {position}; another shadow reached for the route toward {ground}.' ],
  'qapu-khalqi': [
    'A contract gunner fixed the pursuit at {position} while an escort tested the exit from {ground}.',
    'The contract team held a return lane behind {position} and sent a new lead toward {ground}.' ],
  'ramah-taskforce': [
    'Relief fighters took the exposed place from the first escort near {position} before approaching {ground}.',
    'The rescue detail doubled back for its pinned lead, then reopened a route to {ground}.' ],
  nomads: [
    'An operator masked the movement near {position} while a second group crossed toward {ground}.',
    'The team cut its visible approach and waited for the watch at {position} to turn elsewhere.' ],
  'bakunin-jurisdictional-command': [
    'A loud feint at {position} drew the watch; a quiet operative used the gap toward {ground}.',
    'The diversion crossed ahead of the main group and forced the guard away from {ground}.' ],
  'corregidor-jurisdictional-command': [
    'A work crew hauled cover beside {position} while its lead crossed toward {ground}.',
    'The crew left a decoy barricade at {position} and moved its real shield toward {ground}.' ],
  'tunguska-jurisdictional-command': [
    'A security operator tested the line at {position} before exposing anyone on the route to {ground}.',
    'The team withdrew its first approach when a second observer found a safer entry to {ground}.' ],
  'combined-army': [
    'An alien element pressed the front at {position} while another closed on {ground} from the side.',
    'The first wave drew the guard into the open, leaving a second element a route toward {ground}.' ],
  'morat-aggression-force': [
    'A shock fighter drove into the fire at {position}, forcing the defenders to look away from {ground}.',
    'The formation refused the side exit and pushed its weight across the approach to {ground}.' ],
  'next-wave': [
    'A raider crossed in sight at {position} while the hidden group made for {ground}.',
    'The feint fell back from {position}, drawing pursuit off the approach to {ground}.' ],
  'onyx-contact-force': [
    'The assault line focused its fire on {position} before a second element crossed to {ground}.',
    'One alien element held the defender in place as the main line changed angle toward {ground}.' ],
  'shasvastii-expeditionary-force': [
    'A concealed scout let the patrol pass {position} before reaching toward {ground}.',
    'A false movement by {position} drew the search away from the hidden route into {ground}.' ],
  aleph: [
    'An observer anticipated the next volley at {position} and sent the team through its pause toward {ground}.',
    'The force broke its advance into timed crossings rather than crowding the route to {ground}.' ],
  'operations-subsection': [
    'An advance operative cut back from {position} to open a different approach toward {ground}.',
    'The reserve waited at the fallback point while its lead tested the guarded route into {ground}.' ],
  'steel-phalanx': [
    'A veteran took the near watch at {position} while another fighter drove toward {ground}.',
    'The forward fighter held the exposed step and dared the guard to abandon {ground}.' ],
  'o-12': [
    'The cordon closed an outer gap beside {position} before a detail advanced toward {ground}.',
    'An inspection team challenged the movement at {position} while a guarded group crossed toward {ground}.' ],
  starmada: [
    'A fleet detail posted a rear watch and sent its front through the gap toward {ground}.',
    'The first team yielded the exposed route at {position} to a fresh guard moving toward {ground}.' ],
  'torchlight-brigade': [
    'Relief fighters crossed the threatened lane at {position} to replace the stalled front near {ground}.',
    'The rescue detail pulled a wounded fighter clear before returning to the route into {ground}.' ],
  'japanese-secessionist-army': [
    'A close threat at {position} made the guard turn as the main group pressed toward {ground}.',
    'The forward fighter shortened the distance at {position} while another took the uncovered route to {ground}.' ],
  oban: [
    'Two scouts split at {position}, leaving the challenged route to the noisier fighter.',
    'A hidden patrol waited for the guard to follow the wrong trail before closing on {ground}.' ],
  shindenbutai: [
    'An advance fighter slipped through the gap beside {position} before the guard could reset.',
    'A second operative challenged the watch at {position} while the first moved toward {ground}.' ],
  tohaa: [
    'The trio rotated its exposed lead at {position} before one fighter crossed toward {ground}.',
    'A protected member drew back while the other two kept a route open toward {ground}.' ],
  'dashat-company': [
    'Hired guns traded positions at {position}, giving the forward group another angle into {ground}.',
    'The second contract team held the escape lane while the first pressed toward {ground}.' ],
  'druze-bayram-security': [
    'A contract gunner fixed the guard by {position} while a second fighter crossed toward {ground}.',
    'The team shifted its paid guns to the return lane before exposing the lead near {ground}.' ],
  'ikari-company': [
    'A reckless dash past {position} dragged the watch away from the route into {ground}.',
    'Another fighter rushed the opening while the guard pursued the first toward {position}.' ],
  starco: [
    'A retrieval team held its exit by {position} while the lead tested the approach to {ground}.',
    'The second team covered the withdrawal before the first crossed the last lane into {ground}.' ],
  'white-company': [
    'A guard detail exchanged places by {position}, holding both approaches while one crossed toward {ground}.',
    'The team left its quietest lane covered and sent a reserve around the other side of {ground}.' ],
}
