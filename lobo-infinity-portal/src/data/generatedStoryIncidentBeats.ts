import type { CanonicalMission } from '../config/missions.ts'

// The fourth beat belongs to the incident, not the mission frame. Keep the
// objective unresolved here: the actual result selects one of three endings.
export const INCIDENT_CONSEQUENCES: Record<Exclude<CanonicalMission, 'Area of Interest'>,
  readonly [string, string, string, string]> = {
  'Akial Interference': [
    'The antenna answered with static; neither operator could confirm the interference attempt.',
    'The interference request remained on the screen as the rival operator reached the aerial.',
    'The selected public card stayed in place while both specialists disputed antenna access.',
    'The filter request waited beside the public cards as the other crew closed in.',
  ],
  'B-Pong': [
    'The beacon stayed at the center while the severed console offered no reliable nudge.',
    'The exposed beacon remained within reach of either specialist after the smoke shifted.',
    'The cracked display could not tell either crew where the next nudge would finish.',
    'The rival specialist crossed beneath the gantry before either side secured the beacon.',
  ],
  'Corporate Appropriation': [
    'The service lift kept dropping, taking the unclaimed prototype toward the lower deck.',
    'The locker door swung back, threatening to close the carrier’s screened exit.',
    'The transport settled over the crate before anyone could lift the prototype clear.',
    'The clamp jammed again as a defender reached the cradle from the opposite aisle.',
  ],
  'Critical Intervention': [
    'The release bar held the data pack while the defender reached the server-room door.',
    'The partition began to close before the carrier could pass the pack through.',
    'The active connection blinked under emergency light as another guard entered the room.',
    'The fallen rack screened the doorway, but the console lock continued its sequence.',
  ],
  'Crossing Lines': [
    'The fallen frame still cut off the second dead zone from the antenna approach.',
    'The rival patrol remained inside the far zone while the control panel blinked.',
    'The connector sparked against the boundary as more troops entered the other zone.',
    'The shutter slipped lower, threatening to seal the only route to the antenna.',
  ],
  "Dead Man's Switch": [
    'The plate settled behind the Core, leaving the Data Pack carrier exposed at the door.',
    'The carrier could see the Core through smoke but had not reached the Objective Room.',
    'The slow bearer’s route remained open for a moment as the bodyguard turned back.',
    'The dropped pack stayed outside while another trooper contested the Core inside.',
  ],
  Evacuation: [
    'The barrier slid again, leaving the CivEvacing specialist short of the console.',
    'The handrail fell across the route while the civilian remained in contact with the escort.',
    'The enemy HVT stood between rival escorts, still beyond CivEvac and the console.',
    'The cart rolled farther from cover, leaving the specialist short of console contact.',
  ],
  Hardlock: [
    'The console display steadied, but rival boots remained at the enemy beacon.',
    'The newly exposed switch drew another specialist away from the contested beacon.',
    'The backup connector sparked while the defender still guarded the beacon base.',
    'The barricade shifted back toward the passage as the rival console light returned.',
  ],
  'Last Launch': [
    'The stair rail dropped behind the specialist before an ID could be downloaded.',
    'The partition shifted again with the bearer still short of the ID Checker.',
    'The emergency lamp faltered before the specialist could finish the ID download.',
    'The ID bearer stopped at the broken rail while boots sounded inside the tower.',
  ],
  Neutralization: [
    'The box remained unopened while the Neutralization Area was still out of reach.',
    'The bearer stayed outside the area as rivals approached its circular boundary.',
    'The Tech Box latch caught again, leaving the carrier without a token to deliver.',
    'The bearer remained on the outer edge, with the tech still unneutralized.',
  ],
  Outbreak: [
    'The stretcher rolled back toward the patient before the medic reached contact.',
    'The Alpha moved behind the cart again as the scanning light crossed the doorway.',
    'The rival escort reached the nearer patient while the farther scan remained open.',
    'The damaged scanner dimmed again while the medic sought a direct path to the Alpha.',
  ],
  'Panic Room': [
    'The cabinet stopped against the gate, leaving the officer inside a disputed room.',
    'The loose panel rattled while the defender counted bodies already inside.',
    'The table still screened the west gate as the rival patrol reached the center.',
    'The warning light failed again before either officer could hold the floor.',
  ],
  Provisioning: [
    'The coffin door caught once more with the supply box still near its threshold.',
    'The rack tilted toward the safe-area route as a second carrier came forward.',
    'Scattered gear remained between the carrier and the safety boundary.',
    'The torn packing snagged on the handle as the rival squad crossed the exit.',
  ],
  Annihilation: [
    'The enemy lieutenant slipped behind the wreck with survivors still pinned nearby.',
    'The smoke thinned over the passage before the last friendly fighter crossed.',
    'The command signal died, leaving the surviving squad under fire at the barricade.',
    'The gun wreck settled into the gap as the officer’s guard shifted position.',
  ],
  Battleground: [
    'The far patrol began crossing toward the center before the beam settled.',
    'The passage narrowed as the rival force filled the edge of the central sector.',
    'The open route narrowed as both squads advanced toward the center.',
    'Dust gathered along the railing again, obscuring the last steps toward the middle ground.',
  ],
  Cutthroat: [
    'The enemy lieutenant withdrew behind the vehicle as the friendly guard held fire.',
    'The broken beam still left the friendly officer within sight of the enemy squad.',
    'The rooftop guard crossed in front of its lieutenant before the next volley.',
    'Both command groups changed cover while the shutter remained between them.',
  ],
  Superiority: [
    'The console prompt stayed unanswered while the rival fighters crossed into the near quadrant.',
    'The alarm carried into the next quadrant before anyone confirmed the hack.',
    'The shutter drifted shut again with the far quadrant still thinly held.',
    'The exposed scoring line left both squads a final route into the quadrant.',
  ],
  'Uplink Center': [
    'The brace shifted back as a rival fighter approached the coffin base.',
    'The shutter began slipping back over the coffin as rival troops crossed below.',
    'The rail shifted above the Tech-Coffin while the far antenna stayed active.',
    'The guard moved toward the coffin, threatening the sole contact its rival needed.',
  ],
  'Double Bind': [
    'The broken barrier no longer screened the troops holding the zone of influence.',
    'The rival reserves entered the zone while the exposed antenna still blinked.',
    'The carrier settled beside the aerial as the rival squad crossed the zone.',
    'The gap drew more fighters toward the antenna without settling control of the zone.',
  ],
  'The Dig': [
    'Dust drifted over the reader again before either crew confirmed its analysis token.',
    'The console held a partial reading as the rival crew approached the cable break.',
    'The exposed input showed no completed analysis as the rival specialist reached the rim.',
    'The prompt stayed unfinished while loose stone slid back across the console face.',
  ],
  'Data Harvest': [
    'The activity light blinked again as the rival patrol reached the damaged bridge.',
    'The railing still separated the active harvester from its waiting escort.',
    'The carrier waited outside the zone while defenders converged on the open passage.',
    'Smoke shifted off the casing, leaving the harvester exposed to the approaching patrol.',
  ],
}

// Fire and defensive movement must answer the obstacle in this incident. A
// single reusable mission-level firefight made otherwise distinct stories
// read alike when several army pairings appeared together.
export const INCIDENT_CROSSFIRE: typeof INCIDENT_CONSEQUENCES = {
  'Akial Interference': [
    'Shots struck the aerial guard as the new cards came into view.',
    'The rival operator fired from beside the mast when interference clouded the screen.',
    'A short volley swept the antenna base and forced the filter operator back.',
    'Guards exchanged fire across the walkway while the next card change approached.',
  ],
  'B-Pong': [
    'A gunner covered the cut cable, keeping the specialist from the unattended beacon.',
    'Fire reached through the smoke as the approaching specialist left the console behind.',
    'The cracked display reflected muzzle flashes from the beacon lane.',
    'Shots hit the gantry as both specialists crossed toward the contact ring.',
  ],
  'Corporate Appropriation': [
    'Fire drove the carrier away from the moving lift and its unsecured prototype.',
    'The panoply guard fired through the broken door at the prototype cradle.',
    'Rounds struck the overturned transport while both crews searched its damaged labels.',
    'A defender swept the power panel with fire as the cradle clamp loosened.',
  ],
  'Critical Intervention': [
    'A defender fired from the racks while the carrier fought the bent release bar.',
    'Gunfire pinned the specialist against the partition with the pack on its far side.',
    'The guard shot at the emergency lamps before the carrier reached the dark console.',
    'The fallen rack caught incoming rounds beside the dropped pack and closing lock.',
  ],
  'Crossing Lines': [
    'Fire passed beneath the fallen sign as fighters ran for opposite dead zones.',
    'Shots crossed the smoke between the occupied zone and the exposed antenna input.',
    'The cable shield took hits while the far-zone patrol advanced on the connector.',
    'A rival gunner fired through the shutter gap at the specialist below the antenna.',
  ],
  "Dead Man's Switch": [
    'The guard fired through the room doorway before anyone lifted the exposed Core.',
    'Shots struck the console beside the Data Pack carrier crossing toward the room.',
    'A bodyguard fired above the Stunned fighters while another trooper approached the Core.',
    'Incoming rounds scattered the dropped pack beside the Objective Room threshold.',
  ],
  Evacuation: [
    'A guard fired across the sliding barrier at the specialist escorting a civilian to the console.',
    'Rounds struck the handrail beside the specialist CivEvacing a civilian.',
    'A patrol fired through the smoke between the HVT and the Extraction Console.',
    'Shots splintered the cart as the specialist approached the console with a civilian.',
  ],
  Hardlock: [
    'A defender fired from the beacon base while a specialist read the shattered display.',
    'The fallen panel drew fire from both squads as the final console became accessible.',
    'Rounds struck the cable housing between the dark console and the enemy beacon.',
    'A rival gunner covered the broken barricade from the active-console line.',
  ],
  'Last Launch': [
    'Shots struck the scanner housing while a specialist prepared the ID download.',
    'The patrol fired through the Launching Tower gate at the ID bearer.',
    'A guard watched the dark scanner while the specialist reached for its controls.',
    'Rounds struck the broken handrail above the wounded ID bearer.',
  ],
  Neutralization: [
    'Gunfire struck the Tech Box between the specialist and the first Neutralization Area.',
    'A rival patrol fired across the circular boundary at the exposed tech bearer.',
    'Shots swept the box latch while the specialist waited to extract its contents.',
    'A guard fired across the Neutralization Area at the carrier by its edge.',
  ],
  Outbreak: [
    'A rival escort fired across the fallen stretcher as the medic raised a scanner.',
    'Rounds struck the examination cart while the Alpha moved behind its shadow.',
    'A guard fired over the stabilizer alarm at the escorts near the patients.',
    'Shots passed the damaged scanner as the medic read the Alpha’s condition.',
  ],
  'Panic Room': [
    'Fire passed through the open gates as the officer took shelter behind the cabinet.',
    'A guard fired past the jammed panel to stop Essential Personnel entering.',
    'Rounds struck the broken table while the officer searched for floor space.',
    'Shots crossed the warning light as both officers neared the smoky entrance.',
  ],
  Provisioning: [
    'Fire hammered the Tech-Coffin as its hinge trapped the first supply box.',
    'A defender shot beneath the loading rack at a waiting carrier.',
    'Rounds scattered the loose gear between the Tech-Coffin and safety boundary.',
    'An opposing gunner covered the packing sheet and the box handle beneath it.',
  ],
  Annihilation: [
    'A guard fired beside the broken barricade while the enemy lieutenant changed cover.',
    'The officer directed fire into the passage opened by the shattered shelter.',
    'A survivor fired past the barricade while the command signal revealed its source.',
    'The disabled gun absorbed a volley as the lieutenant’s guard prepared another.',
  ],
  Battleground: [
    'A rival gunner fired along the fallen beam to deny the central sector.',
    'Shots crossed the rubble while both patrols tested the narrow passage.',
    'Fire reached the barrier from the far sector as reinforcements entered the center.',
    'Both squads fired across the dusty middle without seeing the other’s last move.',
  ],
  Cutthroat: [
    'A guard fired from beside the vehicle to shield the enemy lieutenant.',
    'Shots hit the fallen beam as the friendly officer sought an escape lane.',
    'A rooftop gunner swept the street below the rival command position.',
    'Fire crossed the shutter while both lieutenants withdrew toward cover.',
  ],
  Superiority: [
    'Shots struck the broken console panel as the rival squad crossed the quadrant line.',
    'A defender fired at the hacking specialist while the alarm gave away the position.',
    'The shutter rattled under fire as both forces moved toward the far quadrant.',
    'Rounds hit the crate just as its movement exposed the scored boundary.',
  ],
  'Uplink Center': [
    'A rival gunner covered the coffin base while an operator approached the aerial.',
    'Shots struck the shutter between the coffin and antenna as both squads converged.',
    'The rail took fire while the second antenna signaled across the coffin.',
    'Rounds struck the cover beside the disputed Tech-Coffin contact point.',
  ],
  'Double Bind': [
    'Fire crossed the barrier between the antenna and the occupied zone.',
    'A defender shot toward the fallen panel while reserves entered the scored ground.',
    'Both crews fired past the disabled carrier toward the antenna base.',
    'Shots reached through the cover gap as the rival force disputed the zone.',
  ],
  'The Dig': [
    'A gunner swept the console reader while stone dust concealed its contact.',
    'Rounds struck the broken cable above the buried hyperthermal tech.',
    'Rival specialists fired across the excavation rim while the scan remained unfinished.',
    'Shots dislodged more stone onto the contested analysis console.',
  ],
  'Data Harvest': [
    'The rival patrol fired across the bridge at the harvester’s exposed activity lamp.',
    'Shots struck the railing as a fighter moved to shield the active device.',
    'The defenders fired at the carrier before the inactive harvester reached the zone.',
    'A guard fired through thinning smoke toward the harvester inside the zone.',
  ],
}

// The incident-specific stake connects the opening obstacle to the scoring
// objective. It stays conditional so the game's reported result determines
// which crew finally succeeded.
export const INCIDENT_STAKES: typeof INCIDENT_CONSEQUENCES = {
  'Akial Interference': [
    'The new Common Classified cards could still be pursued while the antenna offered a chance to interfere.',
    'An operator with an accomplished Common card of the matching symbol could emit interference against an accomplished public card.',
    'Filtering an unfavorable Common card depended on reaching the aerial before the rival operator did.',
    'The approaching card change made an antenna filter tempting, even with each private objective unresolved.',
  ],
  'B-Pong': [
    'If no one touched the beacon, an activated console could nudge it away from the centerline.',
    'The contact ring offered a direct relocation even without winning access to either console.',
    'A console nudge could move the unattended beacon without the specialist reaching its contact ring.',
    'With the console dark, a specialist in contact could still relocate the beacon beneath the gantry.',
  ],
  'Corporate Appropriation': [
    'Losing the descending lift would put the enemy prototype beyond the carrier’s immediate reach.',
    'The open panoply mattered only if the carrier could reach the prototype and then escape.',
    'The crate needed a carrier before either crew could bring the enemy prototype home.',
    'A loosened clamp offered access to the prototype while the nearest panoply stayed contested.',
  ],
  'Critical Intervention': [
    'The attacker could not extract the data pack until the release bar yielded inside the server room.',
    'The defender could keep the pack inside by holding the partition and its console lock.',
    'The one lit connection offered a route to the pack before the defender sealed the room.',
    'With the lock sequence running, a carrier needed the dropped pack beyond the threshold.',
  ],
  'Crossing Lines': [
    'A specialist needed the antenna approach while the rest of the squad contested both dead zones.',
    'Holding the shadowed zone alone would leave the rival patrol free to occupy the other.',
    'A repaired antenna could strengthen the claim if the squad also held the scored ground.',
    'The shutter could deny antenna access while the other crew moved into the dead zones.',
  ],
  "Dead Man's Switch": [
    'A specialist had to reach the Quantum Core while the Data Pack carrier approached the Objective Room.',
    'The nearby console might aid a carrier, but the Quantum Core still decided the room fight.',
    'Taking the Core would slow its bearer while the Data Pack consoles remained outside the disputed exit.',
    'The lit Data Pack consoles offered options while the unclaimed Quantum Core drew fighters inside.',
  ],
  Evacuation: [
    'The CivEvacing specialist still needed console contact and a successful WIP roll to extract the civilian.',
    'The handrail kept the CivEvacing specialist from the console contact needed for extraction.',
    'Extracting the enemy HVT required a Specialist to CivEvac it into contact with the console.',
    'The specialist had to reach the Extraction Console while still CivEvacing the civilian.',
  ],
  Hardlock: [
    'The three consoles could score separately while control of the enemy beacon stayed in dispute.',
    'The open console offered an activation even as the enemy beacon drew both squads forward.',
    'Without a clear console input, the specialist could not rely on the beacon fight alone.',
    'Two active consoles gave the squad a claim, but the enemy beacon remained exposed.',
  ],
  'Last Launch': [
    'A specialist needed to download an ID Token at a scanner before its bearer could extract at the tower checker.',
    'The ID bearer had to reach the checker at the center of the Launching Tower to extract.',
    'The scanner download came before any bearer could use the ID Checker inside the tower.',
    'A wounded ID bearer still needed to reach the checker at the tower center for extraction.',
  ],
  Neutralization: [
    'A specialist had to extract Hyperthermal Tech from the box before its bearer could enter a Neutralization Area.',
    'The carried tech would neutralize inside the area, while antenna control remained a separate objective.',
    'The specialist needed contact with the Tech Box before anyone could carry its token into the area.',
    'The bearer needed to enter the Neutralization Area without entering a Null State.',
  ],
  Outbreak: [
    'The medic could stabilize the patient in contact, whether or not a separate scan succeeded.',
    'Finding the Alpha Infected was only the first step toward a confirmed scan and escort.',
    'Scanning and stabilization offered separate ways to help the Infected while both escorts contested access.',
    'The Alpha could be stabilized in contact even with its separate scan uncertain.',
  ],
  'Panic Room': [
    'The officer had to enter the Panic Room while its rivals tried to dominate the floor.',
    'The jammed east gate kept Essential Personnel outside the room the squad needed to hold.',
    'One officer inside would not settle the room if the rival patrol dominated its center.',
    'A safe entrance could bring Essential Personnel in before either squad held the floor.',
  ],
  Provisioning: [
    'A freed supply box still needed a carrier to bring it inside the safe area.',
    'The unstable loading rack might trap both supply boxes before either reached protected ground.',
    'The carrier’s crossing mattered only if the box finished inside the safety boundary.',
    'A box held by its packing could not count until a carrier reached the safe area.',
  ],
  Annihilation: [
    'An exposed lieutenant and the squad’s remaining strength both mattered as the exchange continued.',
    'The survivors could be lost before the rival officer came within reach.',
    'Identifying the lieutenant offered an attack while the friendly squad tried to stay intact.',
    'The disabled gun could cost the last survivors their route toward the enemy officer.',
  ],
  Battleground: [
    'The central sector could decide control even if the rival patrol reached the far ground.',
    'The sector limits would only be marked at the end, while both patrols fought for the center.',
    'Abandoning the far sector to reinforce the center would leave a different claim open.',
    'The dust hid which fighters might finish inside the future central sector.',
  ],
  Cutthroat: [
    'The enemy lieutenant’s position mattered, but friendly survivors still needed protection from the guard.',
    'A breach in the guard line put the friendly lieutenant and remaining strength at risk.',
    'The rooftop officer could direct more losses unless the friendly squad preserved its command.',
    'Either exposed lieutenant could change the score while both squads bled for the block.',
  ],
  Superiority: [
    'The console could score at the end, while domination of more quadrants than the rival was checked each round.',
    'The alarm exposed the specialist as rivals crossed into the same scoring quadrant.',
    'The console behind the shutter could score separately from the struggle over the adjacent quadrant.',
    'The exposed boundary could affect which crew dominated more quadrants at the round’s end.',
  ],
  'Uplink Center': [
    'The activated antenna scored separately from sole silhouette contact with the Tech-Coffin.',
    'A specialist could activate the antenna, while any non-Null model alone in contact could control the coffin.',
    'An activated antenna would not settle which side alone touched the Tech-Coffin.',
    'A rival model at the coffin could deny control even if the antenna stayed active.',
  ],
  'Double Bind': [
    'Aerial control and the adjacent zone supported different plans chosen before the troops arrived.',
    'The divided zone could be contested while the rival crew defended its own antenna plan.',
    'The blocked aerial still offered an objective if that side had chosen antenna control.',
    'The antenna route could open without settling the other side’s selected zone objective.',
  ],
  'The Dig': [
    'A successful console analysis would let the rival choose an unanalysed tech to mark before any trooper could neutralize it in contact.',
    'The damaged console could stall analysis and leave the hyperthermal tech without a player token for contact neutralization.',
    'An unfinished analysis left both units unmarked for any trooper to neutralize in contact.',
    'Without its own analysis token on the hyperthermal tech, neither side could neutralize that unit in contact.',
  ],
  'Data Harvest': [
    'The crew needed the harvester wholly inside the enemy designated zone to keep it active.',
    'The active harvester would score in the designated zone unless an eligible rival neutralized it.',
    'Depositing the inactive harvester wholly inside the designated zone would make it active.',
    'The exposed harvester could be disabled before its operators returned to the designated zone.',
  ],
}
