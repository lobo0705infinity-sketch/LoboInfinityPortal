// Fictional tactical choices for mission stories outside Area of Interest.
// These describe an unnamed force, not verified moves, gear, or units in a
// submitted roster. Keep them independent of a particular mission apparatus.
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
    'A measured volley carved a protected lane through the opposing fire.',
    'The defenders waited for a clean shot before leaving their position.',
    'The covering line tracked each exposed guard as the forward fighters moved.',
    'its measured firing lane stayed covered through the last exchange',
    'held a surveyed lane under fire'),
  'military-orders': method(
    'An armored escort stepped into the hardest fire and made space behind it.',
    'The defenders closed ranks and refused to yield their nearest shelter.',
    'The escort stayed near the lead fighter as the next threat emerged.',
    'its armored screen remained between the enemy and the advance',
    'kept an armored escort at the front'),
  'kestrel-colonial-force': method(
    'A scout drew attention down one route while another fighter crossed elsewhere.',
    'The defenders watched the obvious route and sent one guard around its edge.',
    'The distant scout kept the enemy looking away from the real advance.',
    'its second route stayed open after the first drew enemy fire',
    'probed for an unwatched crossing'),
  'neoterra-capitaline-army': method(
    'A perimeter detail divided the approach into overlapping guarded sectors.',
    'The defenders tightened their cordon whenever a fighter tested its edge.',
    'The outer guards moved with the front line instead of leaving a gap.',
    'its outer cordon closed around the decisive ground',
    'maintained a cordon beyond the fighting'),
  'shock-army-of-acontecimento': method(
    'Veterans passed from cover to cover without offering one fixed target.',
    'The defenders watched the breaks in cover instead of firing at every movement.',
    'Each fighter held the next covered step long enough for another to cross.',
    'its patrol secured successive pockets of cover',
    'kept advancing through broken cover'),
  'svalarheima-winter-force': method(
    'A patient patrol checked the footing before crossing each exposed gap.',
    'The defenders guarded the narrowest passage and made every step deliberate.',
    'The rear guard watched the difficult crossing until everyone reached shelter.',
    'its patient advance controlled the narrow route',
    'waited behind hard cover for another opening'),
  'varuna-immediate-reaction-division': method(
    'A response team opened a safe exit before its forward element pushed in.',
    'The defenders kept a withdrawal lane clear while contesting the approach.',
    'The open exit let the forward element return without losing its cover.',
    'its protected exit survived the final counterpush',
    'kept a guarded escape lane within reach'),
  'yu-jing': method(
    'An assault team advanced behind alternating volleys, each covering the next crossing.',
    'The defenders met the movement with timed shifts of their firing line.',
    'A fresh volley came as the forward fighters reached the exposed ground.',
    'its staggered line held through the final exchange',
    'maintained a disciplined line under pressure'),
  'imperial-service': method(
    'An investigator read the opposing patrol pattern and sent guards through its weakest interval.',
    'The defenders checked each approach before committing their reserve.',
    'The guards narrowed the gap only when the opposing watch shifted.',
    'its guard detail closed the last uncovered interval',
    'kept the opposing movements under watch'),
  'invincible-army': method(
    'A heavy column absorbed return fire and kept a narrow route open.',
    'The defenders concentrated their shots on the lead fighter without exposing the rear.',
    'The column stood between its forward element and the far firing lane.',
    'its heavy line remained anchored at the front',
    'refused to yield the exposed approach'),
  'white-banner': method(
    'A patrol tested two elevations and found a way past the closest watch.',
    'The defenders guarded both flanks with one fighter held back.',
    'The flank watch shifted with the fighters who found the clearer route.',
    'its high and low approaches stayed covered',
    'kept looking around the guarded route'),
  ariadna: method(
    'Scouts read the ground beside the obvious route and signaled a quieter crossing.',
    'The defenders used the terrain itself to conceal their watch.',
    'Hand signals moved the covering fighters without exposing the lead patrol.',
    'its concealed approach survived the last search',
    'held a quiet route across the ground'),
  'caledonian-highlander-army': method(
    'A charging fighter drew the loudest guns while the rest pushed through the gap.',
    'The defenders braced for the rush and kept a shooter behind the front.',
    'The breach held just long enough for the next fighter to cross.',
    'its sudden breach split the opposing guard',
    'pressed hard against the guarded entrance'),
  'force-de-reponse-rapide-merovingienne': method(
    'A response patrol reserved a fallback position before advancing its front.',
    'The defenders covered the return route as carefully as the forward ground.',
    'The reserve stayed in reach when the advance met fresh fire.',
    'its fallback position protected the last advance',
    'held a reserve within reach of the fight'),
  kosmoflot: method(
    'A raider moved outside the main sightline and marked an off-angle crossing.',
    'The defenders shifted their watch from the obvious route toward the far edge.',
    'The outside fighter kept that distant angle while the rest moved.',
    'its off-angle route remained open at the end',
    'held a distant approach under fire'),
  'tartary-army-corps': method(
    'Veterans pinned a guard in place before moving along the covered side.',
    'The defenders held their ground rather than chase the first moving fighter.',
    'The pinned guard stayed occupied as the forward group changed position.',
    'its steady pressure kept the opposing guard fixed',
    'kept the nearest guard occupied'),
  'usariadna-ranger-force': method(
    'Rangers spread wide and made the guarded route only one of several choices.',
    'The defenders watched the nearest cover while expecting a wide patrol.',
    'The broad screen closed inward when the lead fighters met resistance.',
    'its ranger screen closed around the remaining route',
    'kept a long way around under watch'),
  haqqislam: method(
    'An escort guarded the forward group and kept a clear way back.',
    'The defenders left room to retrieve anyone caught on the exposed ground.',
    'The escort stayed close enough to pull its people clear if fire returned.',
    'its protected withdrawal route remained open',
    'kept an escort ready near the front'),
  'hassassin-bahram': method(
    'A hidden fighter drew the watch away from the route the others needed.',
    'The defenders ignored the first exposed figure and watched for another approach.',
    'The feint left only a heartbeat for the real crossing.',
    'its concealed approach escaped the last guard',
    'kept the true route out of sight'),
  'qapu-khalqi': method(
    'A security detail assigned one guard to the advance and another to the exit.',
    'The defenders watched both the forward ground and the return route.',
    'The second guard stayed near the exit while the first covered the front.',
    'its two guarded routes remained connected',
    'covered both the advance and retreat'),
  'ramah-taskforce': method(
    'A quick escort crossed first and signaled the rest through the opening.',
    'The defenders kept a relief fighter near enough to answer a sudden breach.',
    'A fresh escort took the exposed place as the front moved again.',
    'its rotating escort preserved the opening',
    'held its relief fighters near the front'),
  nomads: method(
    'An operator watched the guard’s movement and timed a crossing against it.',
    'The defenders checked the first change before abandoning their post.',
    'The operator held back a signal until the crossing fighters were clear.',
    'its timed crossing carried the forward group through',
    'tracked each shift in the opposing line'),
  'bakunin-jurisdictional-command': method(
    'One fighter made a conspicuous rush while another crossed on its blind side.',
    'The defenders held fire on the decoy and waited for quieter movement.',
    'The diversion stayed close enough to draw a shot at the critical moment.',
    'its noisy feint concealed the decisive crossing',
    'kept a decoy between the front and guard'),
  'corregidor-jurisdictional-command': method(
    'A work crew shifted loose cover into a short screen for the next crossing.',
    'The defenders braced movable cover beside their strongest position.',
    'The makeshift screen held as the forward fighters found another angle.',
    'its improvised cover sheltered the final move',
    'kept its makeshift screen intact'),
  'tunguska-jurisdictional-command': method(
    'A security operator compared the opposing watch with a second route forward.',
    'The defenders guarded their access route rather than follow a false opening.',
    'The squad waited for the operator’s confirmation before shifting its guard.',
    'its guarded access route stayed clear',
    'kept the changing watch under scrutiny'),
  'combined-army': method(
    'An alien assault group drew fire while another element took a separate route.',
    'The defenders faced the main advance without forgetting its second approach.',
    'The outer element appeared when the assault group increased pressure.',
    'its two-pronged pressure broke the opposing watch',
    'kept defenders facing two directions'),
  'morat-aggression-force': method(
    'A shock group drove straight into the firing lane and made its next cover by force.',
    'The defenders poured fire into the lead fighters rather than abandon their position.',
    'The pressure at the front gave the rest another moment to move.',
    'its front survived the concentrated return fire',
    'pressed the nearest guard backward'),
  'next-wave': method(
    'A raider disturbed the far cover before the real advance began elsewhere.',
    'The defenders watched for tampering beyond the obvious approach.',
    'The second route remained hidden until the lead fighters were close.',
    'its diversion drew the last watch away',
    'kept a second approach in reserve'),
  'onyx-contact-force': method(
    'An assault line advanced in measured bursts to drive a guard back.',
    'The defenders contested the central lane instead of surrendering its angle.',
    'The line stayed fixed on the guard while the forward element moved.',
    'its controlled line held the center',
    'maintained pressure along the center'),
  'shasvastii-expeditionary-force': method(
    'A scout waited for the guard to turn before leading a quiet crossing.',
    'The defenders concealed their positions until the nearest fighter committed.',
    'The forward scout stayed out of sight as the rest closed in.',
    'its unseen approach passed the nearest guard',
    'kept a concealed watch on the route'),
  aleph: method(
    'An observer timed the guard’s turns and sent fighters through the shortest gap.',
    'The defenders adjusted whenever the opposing force found another timing window.',
    'The group moved again just before the predicted return of fire.',
    'its precise timing protected the decisive advance',
    'measured each opening beneath enemy fire'),
  'operations-subsection': method(
    'A lone operator crossed ahead and marked a precise route back.',
    'The defenders tracked the first contact while keeping the rest in view.',
    'The advance element signaled once, letting the rear move independently.',
    'its isolated advance element rejoined the line',
    'kept its advance element in reach'),
  'steel-phalanx': method(
    'A veteran led a direct charge to draw fire away from the following fighters.',
    'The defenders concentrated on the leader without uncovering the flank.',
    'The veteran held the space gained by the charge as the rest crossed.',
    'its leading fighter kept the breach open',
    'held its front line inside the guard’s reach'),
  'o-12': method(
    'A security cordon contained the nearest approach before moving forward.',
    'The defenders marked a second boundary to keep intruders away.',
    'The cordon shifted without losing sight of the protected exit.',
    'its cordon contained the final counterpush',
    'held a boundary between the forces'),
  starmada: method(
    'A fleet detail opened a safe return lane before sending its front ahead.',
    'The defenders stayed close enough to protect their route out.',
    'The return lane remained guarded while the lead fighters moved.',
    'its guarded way back stayed open',
    'maintained a protected way out'),
  'torchlight-brigade': method(
    'A response team split between the forward line and a waiting relief position.',
    'The defenders kept a responder in reserve for the next breach.',
    'A relief fighter moved in when the forward guard lost cover.',
    'its relief line answered the final breach',
    'kept a relief position close to the front'),
  'japanese-secessionist-army': method(
    'A close fighter threatened the guard while the others took its blind angle.',
    'The defenders kept one weapon on the approaching fighter and another on the flank.',
    'The close threat held the guard in place until the rest crossed.',
    'its close feint opened a route past the guard',
    'kept a fighter within reach of the guard'),
  oban: method(
    'Scouts split their approaches and waited for the guard to choose one.',
    'The defenders spread their watch to both ends of the front.',
    'The unchosen scout covered the route the guard had left exposed.',
    'its split approach outlasted the nearest watch',
    'held two approaches just outside the guard’s view'),
  shindenbutai: method(
    'A forward fighter found a blind angle and signaled the rest toward it.',
    'The defenders watched for a sudden close move near their post.',
    'The forward fighter stayed close enough to interrupt a counterattack.',
    'its blind-side advance cleared the final obstacle',
    'held a blind angle beside the fighting'),
  tohaa: method(
    'Three fighters exchanged positions around the lead element to cover its movement.',
    'The defenders tracked the shifting screen and tried to separate its members.',
    'The three-point screen closed again when the opposing guard shifted.',
    'its rotating screen kept the advance together',
    'kept rotating its three-point escort'),
  'dashat-company': method(
    'A hired guard covered the front while a second group traded ground for fire.',
    'The defenders guarded the valuable ground and refused an expensive chase.',
    'The two covering groups maintained different angles as the lead moved.',
    'its overlapping hired guns protected the advance',
    'held two firing angles through the exchange'),
  'druze-bayram-security': method(
    'A contract team established a hard firing angle before committing the front.',
    'The defenders held their best cover and made every crossing costly.',
    'The firing angle stayed fixed as the lead fighters crossed.',
    'its contract line held against the final push',
    'kept a fixed angle on the approach'),
  'ikari-company': method(
    'A reckless fighter rushed one side and pulled the guard off the other.',
    'The defenders let the rush pass and waited for the fighters behind it.',
    'The forward fighter kept the guard busy as the rest hurried through.',
    'its sudden breach survived the counterattack',
    'pressed ahead despite the exposed crossing'),
  starco: method(
    'A retrieval team marked the way out before moving its front forward.',
    'The defenders watched the exit in case the opposing force slipped away.',
    'The marked route remained clear while the forward group committed.',
    'its retrieval route stayed protected to the end',
    'held a marked path away from the fight'),
  'white-company': method(
    'A guard team covered two approaches and chose the quieter one for its advance.',
    'The defenders denied the easy lane without abandoning their post.',
    'A second covering fighter kept watch as the lead crossed.',
    'its steady guard line survived the last exchange',
    'kept both approaches under watch'),
}
