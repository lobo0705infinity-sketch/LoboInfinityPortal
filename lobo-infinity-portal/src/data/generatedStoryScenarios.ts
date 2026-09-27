import type { CanonicalMission } from '../config/missions.ts'

export const MISSION_GEIST_SOURCE_SNAPSHOT = {
  inspectedOn: '2026-09-27', siteBuild: 'geist-v2-20260924190254',
} as const

type Incident = {
  opening: string
  complication: string
  turn: string
  objectiveAction: string
  ground?: string
  position?: string
}

export type SourcedStoryScenario = {
  source: string
  season: 'ITS 18' | 'ITS 16' | 'Lobo League'
  requiresUnreportedSetup?: boolean
  objectiveSkill?: 'infectedCare' | 'civilianEscort'
  anchor: RegExp
  ground: string
  position: string
  gunfighting: string
  closeCombat: string
  endings: { heroWins: string; heroLoses: string; draw: string }
  incidents: readonly [Incident, Incident, Incident, Incident]
}

function incident(opening: string, complication: string, turn: string, objectiveAction: string,
  setting: Pick<Incident, 'ground' | 'position'> = {}): Incident {
  return { opening, complication, turn, objectiveAction, ...setting }
}

// Reviewed against the linked Mission Geist rules. The pages are live;
// source build and inspection date are recorded above for later comparison.
export const SOURCED_STORY_SCENARIOS: Partial<Record<CanonicalMission, SourcedStoryScenario>> = {
  'Area of Interest': {
    source: 'https://infinitygeist.com/mission/s18_area_of_interest', season: 'ITS 18',
    anchor: /communication antenna|relay mast/i,
    ground: 'the collapsed arcade', position: 'the breach in the far wall',
    gunfighting: 'fired at the gunner above the mast and covered the specialist crossing the broken paving',
    closeCombat: 'drove a defender from the base of the mast and held the courtyard for the specialist',
    endings: {
      heroWins: '{{heroPlayer}}’s squad gained the edge around the communication antenna and the ground it could score.',
      heroLoses: '{{otherPlayer}}’s squad gained the edge over {{heroPlayer}} around the communication antenna and its scored ground.',
      draw: 'Neither patrol gained an edge in the fight for the communication antenna and the surrounding ground.',
    },
    incidents: [
      { opening: 'The relay indicator blinked once before the panel went dark, leaving the contested ground without a clear signal.',
        complication: 'A fallen brace trapped the antenna switch against the base of the mast.',
        turn: 'A burst of gunfire shifted the brace and briefly exposed the control face.',
        objectiveAction: 'pulled the brace aside and keyed an activation request into the communication antenna' },
      { opening: 'A specialist left the control screen lit as both patrols fought to hold the ground around the mast.',
        complication: 'A rival specialist reached the mast first and left an unfinished command on its screen.',
        turn: 'The screen reset just as both teams found a clear line to the controls.',
        objectiveAction: 'cleared the unfinished command and entered a fresh code at the communication antenna' },
      { opening: 'The antenna housing shook under fire while each squad tried to hold the ground beneath it.',
        complication: 'A snapped connector hung from the relay panel beyond the first specialist’s reach.',
        turn: 'A near miss shook the connector down within reach as the opposing squad advanced.',
        objectiveAction: 'fitted the loose connector and tested the communication antenna before entering a new command' },
      { opening: 'A hurried withdrawal left a disputed signal at the mast, with both crews still fighting for the ground.',
        complication: 'The panel still showed the rival crew’s code after its operator fell back from the mast.',
        turn: 'A second fighter reached the switch while the disputed signal remained on screen.',
        objectiveAction: 'checked the disputed code and keyed a replacement into the communication antenna' },
    ],
  },
  'Akial Interference': {
    source: 'https://infinitygeist.com/mission/s18_akial_interference', season: 'ITS 18',
    requiresUnreportedSetup: true, anchor: /classified objective|Common Classified|Akial Antenna|Akial interference|filter the signal/i,
    ground: 'the Akial Antenna', position: 'the sheltered antenna approach',
    gunfighting: 'fired at the guard beside the Akial Antenna and covered the operator watching the Common cards',
    closeCombat: 'drove a defender from the Akial Antenna and held the approach for the operator',
    endings: {
      heroWins: '{{heroPlayer}}’s crew came out ahead in the contest for classified objectives at the Akial Antenna.',
      heroLoses: '{{otherPlayer}}’s crew came out ahead of {{heroPlayer}} in the contest for classified objectives at the Akial Antenna.',
      draw: 'The rival crews finished even in the contest for classified objectives at the Akial Antenna.',
    },
    incidents: [
      { opening: 'At the start of the round, both crews saw two new Common Classified cards as they approached the Akial Antenna.',
        complication: 'A specialist could see the public cards, but gunfire blocked the antenna controls used to filter one of them.',
        turn: 'A gap in the firing lane briefly opened access to the antenna controls.',
        objectiveAction: 'selected a public Common Classified card and keyed a filter request at the Akial Antenna' },
      { opening: 'An operator who had accomplished a Common Classified card with the matching symbol approached the Akial Antenna.',
        complication: 'The rival operator guarded the aerial while an accomplished public card remained vulnerable to interference.',
        turn: 'Static broke over the antenna screen just as the guard shifted from its controls.',
        objectiveAction: 'matched the accomplished Common Classified symbol and sent an Akial interference request through the antenna' },
      { opening: 'The public Common Classified cards remained in view while an operator tried to reach the Akial Antenna.',
        complication: 'A defender held the antenna base, preventing the specialist from filtering an unfavorable card.',
        turn: 'The defender moved into cover and left the filter controls exposed for a moment.',
        objectiveAction: 'tapped the unwanted Common Classified card and tried to filter it through the Akial Antenna' },
      { opening: 'Another round approached with two Common Classified cards due to change by the Akial Antenna.',
        complication: 'Neither operator could reach the aerial while guards traded fire across its service walkway.',
        turn: 'One guard fell back and left a narrow approach to the controls before the cards rotated.',
        objectiveAction: 'reached the Akial Antenna controls and keyed a filter request for one public Common Classified card' },
    ],
  },
  'B-Pong': {
    source: 'https://infinitygeist.com/mission/s18_b_pong', season: 'ITS 18',
    anchor: /tracking beacon|console/i,
    ground: 'the tracking beacon lane', position: 'the nearest console',
    gunfighting: 'fired at the guard beside the tracking beacon and sheltered the specialist by the console',
    closeCombat: 'drove a guard from the tracking beacon and opened a route toward the console',
    endings: {
      heroWins: '{{heroPlayer}}’s crew gained the advantage in the struggle over the tracking beacon and consoles.',
      heroLoses: '{{otherPlayer}}’s crew gained the advantage over {{heroPlayer}} in the struggle over the tracking beacon and consoles.',
      draw: 'Both crews found openings around the tracking beacon and consoles, but neither finished ahead.',
    },
    incidents: [
      { opening: 'The tracking beacon sat at the centerline as a console flickered behind an abandoned barricade.',
        complication: 'A cable tore loose beneath the console, leaving the unattended beacon beyond the specialist’s reach.',
        turn: 'The console reconnected while the beacon remained unattended across the lane.',
        objectiveAction: 'checked that nobody touched the tracking beacon before activating the console to nudge it toward the far half' },
      { opening: 'A tracking beacon stood between two consoles as fresh smoke rolled over the central lane.',
        complication: 'Smoke separated the specialist from the beacon while a guard watched the nearer console.',
        turn: 'A gust exposed the beacon base and a clear route to its contact ring.',
        objectiveAction: 'gripped the tracking beacon in contact and tried to move it toward the rival half' },
      { opening: 'A tracking beacon rested short of the far half while one console flashed through smoke.',
        complication: 'A cracked screen concealed the last console input as both specialists approached the unattended beacon.',
        turn: 'A pause in the smoke revealed the beacon resting beyond the console guard’s firing lane.',
        objectiveAction: 'touched the console control to nudge the unattended tracking beacon toward the far half' },
      { opening: 'The tracking beacon halted beneath an overhead gantry as the nearest console lost its display.',
        complication: 'A hanging cable blocked the specialist’s view while the rival team approached the beacon itself.',
        turn: 'The cable fell away and exposed a narrow path to the beacon’s contact ring.',
        objectiveAction: 'took hold of the tracking beacon and started shifting it away from the rival specialist' },
    ],
  },
  'Corporate Appropriation': {
    source: 'https://infinitygeist.com/mission/s18_corporate_appropriation', season: 'ITS 18',
    anchor: /prototype|panoply/i,
    ground: 'the enemy prototype cradle', position: 'the adjacent panoply',
    gunfighting: 'fired at the guard covering the prototype and sheltered the carrier near the panoply',
    closeCombat: 'drove a defender from the prototype cradle and opened an escape route for its carrier',
    endings: {
      heroWins: '{{heroPlayer}}’s crew edged the opposition in the fight over the prototype and panoplies.',
      heroLoses: '{{otherPlayer}}’s crew edged {{heroPlayer}} in the fight over the prototype and panoplies.',
      draw: 'The fight over the prototype and panoplies left the two crews evenly matched.',
    },
    incidents: [
      incident('An enemy prototype rolled from a damaged cradle as both crews entered the equipment bay.', 'A failed brake sent the prototype toward a service lift beneath the rival firing lane.', 'The lift began descending with the restraint open and its carrier still a step away.', 'caught the prototype restraint and tried to pull the enemy device clear of the descending lift'),
      incident('An enemy prototype stood beside a panoply whose locker seals had just failed.', 'A rival specialist searched the open locker while a guard blocked the prototype carrier’s exit.', 'The broken locker door swung across the lane, briefly screening a path to the prototype.', 'reached past the panoply door and tugged at the enemy prototype in its cradle'),
      incident('A prototype crate lay between two panoplies after an equipment transport overturned.', 'A damaged label obscured which container held the enemy prototype under the fallen transport.', 'A torn seal exposed a serial mark as the opposing squad approached the wreck.', 'grabbed the enemy prototype by its serial-marked crate and tried to draw it out from under the transport'),
      incident('The prototype cradle alarm sounded as the nearest panoply opened without a specialist nearby.', 'A loose clamp held the prototype in place while rival fighters searched the room.', 'A sudden power dip released the clamp halfway and opened a narrow route to the cradle.', 'slipped through the gap and worked the clamp loose to take the enemy prototype'),
    ],
  },
  'Critical Intervention': {
    source: 'https://infinitygeist.com/mission/s18_critical_intervention', season: 'ITS 18',
    requiresUnreportedSetup: true, anchor: /data console|data pack|server room/i,
    ground: 'the server room', position: 'the data console',
    gunfighting: 'fired at the guard covering the data console and shielded the specialist near the server racks',
    closeCombat: 'forced a defender from the data console and held the route out of the server room',
    endings: {
      heroWins: '{{heroPlayer}}’s crew held the overall advantage in the fight for the server room and its data pack.',
      heroLoses: '{{otherPlayer}}’s crew held the overall advantage over {{heroPlayer}} in the fight for the server room and its data pack.',
      draw: 'The server room and its data pack remained the center of a fight that neither crew won outright.',
    },
    incidents: [
      incident('The data console reported an unlocked pack, but its cradle stayed shut inside the server room.', 'A bent release bar caught the pack carrier’s glove while defenders closed on the doorway.', 'The bar gave a little under pressure, exposing the data pack without freeing it from the cradle.', 'pulled at the data console release bar and reached into the cradle for the data pack'),
      incident('A data pack waited beside the server-room console as the alarm sounded through an empty corridor.', 'A locked partition separated the attacker’s specialist from the pack while defenders approached the room.', 'A damaged hinge exposed a narrow opening just as the console displayed another lock warning.', 'worked the data console lock and reached through the partition for the data pack'),
      incident('The server room went dark around a data console showing one remaining active connection.', 'The attacker could not read the pack status while the defender reached the room’s far entrance.', 'Emergency lighting revealed the console face and a narrow passage to the pack cradle.', 'entered a release command at the data console and moved toward the data pack cradle'),
      incident('A dropped data pack lay beside the server-room threshold as its console began a lock sequence.', 'The attacker’s carrier reached for the pack while a defender covered the room from a damaged rack.', 'The rack shifted and briefly masked both teams from the blinking console display.', 'reached for the dropped data pack and dragged it toward the server-room threshold'),
    ],
  },
  'Crossing Lines': {
    source: 'https://infinitygeist.com/mission/s18_crossing_lines', season: 'ITS 18',
    anchor: /dead zone|antenna/i,
    ground: 'the disputed dead zone', position: 'the antenna at its edge',
    gunfighting: 'fired at the guard overlooking the dead zone and covered the specialist reaching the antenna',
    closeCombat: 'drove a defender from the antenna approach and held the dead zone for the squad',
    endings: {
      heroWins: '{{heroPlayer}}’s crew took the lead in the contest across the dead zones and antennas.',
      heroLoses: '{{otherPlayer}}’s crew took the lead over {{heroPlayer}} across the dead zones and antennas.',
      draw: 'The struggle across the dead zones and antennas gave neither crew the upper hand.',
    },
    incidents: [
      incident('A fallen sign blocked the antenna overlooking one of the two dead zones.', 'Its metal frame rolled into the scoring area and exposed the specialist trying to cross behind it.', 'A gap opened beneath the frame just as rival troops reached the other side of the zone.', 'slid under the sign and keyed an activation request at the antenna inside the dead zone'),
      incident('One dead zone lay in shadow while its communication antenna flashed through the smoke.', 'A rival patrol occupied the second zone while the first specialist struggled to see the antenna input.', 'The smoke thinned long enough to reveal the control panel and an empty approach lane.', 'entered a command at the antenna panel and moved into the disputed dead zone'),
      incident('A cable from the near antenna crossed the boundary of a contested dead zone.', 'A broken connector left the control face dark while opposing fighters advanced from the far zone.', 'A spare connector appeared beneath the cable shield just as a specialist reached the boundary.', 'fitted the spare antenna connector and tried to key an activation inside the dead zone'),
      incident('Two dead zones opened on either side of an antenna damaged in the first exchange.', 'A falling shutter separated the squad from the antenna as the other force entered the scored ground.', 'The shutter caught on a broken hinge and left one passage toward the antenna base.', 'reached the antenna beneath the shutter and tapped its controls from inside the dead zone'),
    ],
  },
  "Dead Man's Switch": {
    source: 'https://infinitygeist.com/mission/cm_lobo_dead_mans_switch', season: 'Lobo League',
    anchor: /quantum core|data pack|objective room|resonance/i,
    ground: 'the Objective Room', position: 'the Quantum Core',
    gunfighting: 'fired at the guard near the Objective Room and covered a specialist approaching the Core',
    closeCombat: 'drove a bodyguard away from the Quantum Core and protected the specialist approaching it',
    endings: {
      heroWins: '{{heroPlayer}}’s crew came out ahead in the fight for the Quantum Core and Objective Room.',
      heroLoses: '{{otherPlayer}}’s crew came out ahead of {{heroPlayer}} in the fight for the Quantum Core and Objective Room.',
      draw: 'The fight for the Quantum Core and Objective Room left neither crew ahead.',
    },
    incidents: [
      incident('The Quantum Core lay unattended in the Objective Room after its bearer slipped away under fire.', 'A loose floor plate hid the Core from the nearest specialist while rival fighters reached the room entrance.', 'The plate rocked and exposed its glow just as a Data Pack carrier came within sight.', 'located the Quantum Core beneath the plate and reached for it while the Data Pack carrier crossed the room'),
      incident('A Data Pack carrier approached the Objective Room while two Quantum Core seekers watched its door.', 'The nearest console flickered as the carrier drew near enough for Quantum Resonance to matter.', 'A rival fighter crossed the room and briefly separated the carrier from the Core.', 'worked the Data Pack console and reached toward the Quantum Core through the contested doorway'),
      incident('The Quantum Core lay between two Stunned fighters near the Objective Room entrance.', 'The next bearer could not fire or take a second Move while carrying the unstable payload.', 'A bodyguard stepped away from the room door and opened a slow route toward the Core.', 'stepped between the Stunned fighters and stretched a hand toward the Quantum Core'),
      incident('Both Data Pack consoles glowed outside the Objective Room while the Quantum Core remained unclaimed.', 'A dropped pack blocked one specialist at the threshold as an opposing squad took cover.', 'The pack slid clear and exposed the console control just as another trooper entered the room.', 'entered a request at the Data Pack console and pushed through the doorway toward the Quantum Core'),
    ],
  },
  Evacuation: {
    source: 'https://infinitygeist.com/mission/s18_evacuation', season: 'ITS 18',
    objectiveSkill: 'civilianEscort',
    anchor: /civilian|HVT|Extraction Console/i,
    ground: 'the approach to the Extraction Console', position: 'the waiting civilian escort',
    gunfighting: 'fired at the guard covering the Extraction Console and sheltered the specialist escorting a civilian',
    closeCombat: 'forced a defender from the Extraction Console and shielded the specialist escorting a civilian',
    endings: {
      heroWins: '{{heroPlayer}}’s crew gained the advantage in the race to bring civilians or enemy HVTs to the Extraction Consoles.',
      heroLoses: '{{otherPlayer}}’s crew gained the advantage over {{heroPlayer}} in the race to bring civilians or enemy HVTs to the Extraction Consoles.',
      draw: 'The rival escorts disputed civilians, enemy HVTs, and Extraction Consoles without either crew pulling ahead.',
    },
    incidents: [
      incident('After the first round, a specialist CivEvacing a civilian approached an Extraction Console behind a fallen barrier.', 'The barrier slid into the firing lane and kept the specialist from reaching the console in contact.', 'A gap opened below the barrier as the rival squad moved to cover the controls.', 'crawled beside the CivEvaced civilian and reached for the Extraction Console controls'),
      incident('A specialist CivEvacing a civilian sheltered behind a damaged handrail near the second Extraction Console.', 'The handrail pinned the escort short of the controls while patrols traded fire across the open passage.', 'The rail dropped away and briefly exposed a sheltered route to the console face.', 'pulled the CivEvaced civilian past the fallen rail and tried the Extraction Console input'),
      incident('An enemy HVT waited near the central corridor while both crews fought for an Extraction Console.', 'Smoke hid the HVT as a specialist tried to reach it and begin CivEvac before approaching the controls.', 'The smoke lifted and exposed the HVT, but a rival patrol still watched the console.', 'reached for the enemy HVT to initiate CivEvac while eyeing the Extraction Console beyond the patrol', { position: 'the enemy HVT beside the corridor' }),
      incident('A specialist CivEvacing a civilian stopped short of an Extraction Console when shooting resumed.', 'An overturned cart split the escort from the console and left both in the opposing squad’s firing lane.', 'The cart rolled aside and offered one brief opening at the console controls.', 'pulled the CivEvaced civilian around the cart and keyed a request at the Extraction Console'),
    ],
  },
  Hardlock: {
    source: 'https://infinitygeist.com/mission/s18_hard_lock', season: 'ITS 18',
    anchor: /beacon|console/i,
    ground: 'the enemy beacon position', position: 'the activated-console line',
    gunfighting: 'fired at the defender watching the enemy beacon and covered the console specialist',
    closeCombat: 'drove a guard from the enemy beacon and held its position for the advancing specialist',
    endings: {
      heroWins: '{{heroPlayer}}’s crew finished ahead in the contest for the enemy beacon and consoles.',
      heroLoses: '{{otherPlayer}}’s crew finished ahead of {{heroPlayer}} in the contest for the enemy beacon and consoles.',
      draw: 'Neither crew found a decisive edge at the enemy beacon and consoles.',
    },
    incidents: [
      incident('The enemy beacon stood beyond three consoles whose activation lights changed out of sequence.', 'A shattered display hid which console still answered the specialist approaching from the beacon side.', 'The nearest light settled for one breath as rival troops moved onto the beacon base.', 'pressed the lit console switch and forced a path toward the enemy beacon base'),
      incident('A beacon marker remained contested while the final open console drew specialists from both sides.', 'A fallen panel hid the active switch as defenders pressed into contact with the enemy beacon.', 'The panel tipped and revealed the console face just before another squad entered the beacon lane.', 'keyed the console control and pressed into contact at the enemy beacon'),
      incident('The enemy beacon flashed above consoles whose status display had gone dark.', 'A damaged power cable kept the nearest console unreachable while a rival specialist closed in.', 'A spark exposed a backup connector underneath the console housing at the beacon base.', 'plugged the backup connector into the console and tried its switch beside the enemy beacon'),
      incident('Two consoles stayed active after their beacon guard retreated into the central lane.', 'A broken barricade blocked the route to the enemy beacon while the other crew rebuilt its line.', 'The barricade shifted under fire and opened a gap beside the nearer console.', 'slipped past the active console and tried to seize contact at the enemy beacon'),
    ],
  },
  'Last Launch': {
    source: 'https://infinitygeist.com/mission/s18_last_launch', season: 'ITS 18',
    anchor: /launching tower|ID Scanner|ID Checker|extract/i,
    ground: 'the ID Scanner approach', position: 'the ID Checker inside the Launching Tower',
    gunfighting: 'fired at the guard covering the Launching Tower and sheltered the bearer of an ID Token',
    closeCombat: 'drove a guard off the route to the ID Checker and covered the bearer’s next move',
    endings: {
      heroWins: '{{heroPlayer}}’s crew finished ahead in the contest for ID downloads and access to the Launching Tower checker.',
      heroLoses: '{{otherPlayer}}’s crew finished ahead of {{heroPlayer}} in the contest for ID downloads and access to the Launching Tower checker.',
      draw: 'Neither crew pulled ahead in the contest for ID downloads and access to the Launching Tower checker.',
    },
    incidents: [
      incident('A specialist approached an ID Scanner while an escort waited outside the Launching Tower.', 'A fallen stair rail exposed the scanner and delayed the WIP download for an ID Token.', 'The rail pulled loose and offered a narrow approach before the patrol reached the scanner.', 'keyed a download request into the ID Scanner beneath the Launching Tower stairs'),
      incident('A trooper carrying an ID Token reached a Launching Tower gate with the ID Checker still across the room.', 'A rival patrol entered by the next gate and cut off the direct route to the checker.', 'A damaged inner partition shifted and exposed another path between the bearer and the tower center.', 'took the ID Token through the Launching Tower passage and reached toward the checker', { ground: 'the Launching Tower gate' }),
      incident('An ID Scanner flickered below the Launching Tower while the checker stood beyond its dark central gate.', 'A guard covered the scanner and forced a specialist to shelter before downloading an ID.', 'Emergency lighting revealed the scanner face as the opposing crew moved toward the tower.', 'entered a download request at the ID Scanner as the tower checker came into view'),
      incident('A wounded trooper carrying an ID Token took cover at the Launching Tower threshold.', 'A broken handrail and a rival guard separated the bearer from the ID Checker at the tower center.', 'A smoke trail briefly concealed the route inside without settling who could reach the checker.', 'carried the ID Token through the smoke and reached for the ID Checker controls', { ground: 'the Launching Tower threshold' }),
    ],
  },
  Neutralization: {
    source: 'https://infinitygeist.com/mission/s18_neutralization', season: 'ITS 18',
    anchor: /hyperthermal tech|Neutralization Area|neutralizing antenna/i,
    ground: 'the Hyperthermal Tech Box passage', position: 'the nearest Neutralization Area',
    gunfighting: 'fired at the guard between the Hyperthermal Tech Box and the Neutralization Area',
    closeCombat: 'drove a defender from the Neutralization Area and sheltered the tech bearer',
    endings: {
      heroWins: '{{heroPlayer}}’s crew earned the lead in the struggle to carry Hyperthermal Tech into a Neutralization Area.',
      heroLoses: '{{otherPlayer}}’s crew earned the lead over {{heroPlayer}} in the struggle to carry Hyperthermal Tech into a Neutralization Area.',
      draw: 'Neither crew pulled ahead in the struggle over Hyperthermal Tech and the Neutralization Areas.',
    },
    incidents: [
      incident('A specialist reached a Hyperthermal Tech Box while a Neutralization Area lay beyond the exposed crossing.', 'Fire struck the box housing and delayed the WIP extraction needed before anyone could carry the tech.', 'A damaged panel opened enough to reach the box as rival troops entered the lane.', 'reached into the Hyperthermal Tech Box and tried to extract its token before the crossing'),
      incident('A trooper carrying Hyperthermal Tech stopped just outside a Neutralization Area beside an antenna.', 'A rival patrol held the area boundary, while the antenna offered a separate fight for control.', 'The patrol changed cover and left a narrow passage into the circular zone.', 'took the Hyperthermal Tech toward the open gap in the Neutralization Area boundary', { ground: 'the Neutralization Area boundary' }),
      incident('A Hyperthermal Tech Box lay behind a barricade while a carrier waited for the extracted token.', 'A rival fighter watched the box as the specialist tried to reach it in contact for an extraction attempt.', 'The barricade shifted and exposed the box latch without clearing the route to the Neutralization Area.', 'worked the Hyperthermal Tech Box latch and tried to extract a token for the Neutralization Area'),
      incident('A Hyperthermal Tech bearer took cover near a Neutralization Area whose edge lay under fire.', 'The bearer could not neutralize the token while outside the area, and a rival squad watched the crossing.', 'A fallen rail opened a path into the circular zone before the guard could move closer.', 'carried the Hyperthermal Tech toward the opening inside the Neutralization Area', { ground: 'the Neutralization Area boundary' }),
    ],
  },
  Outbreak: {
    source: 'https://infinitygeist.com/mission/s18_outbreak', season: 'ITS 18',
    objectiveSkill: 'infectedCare',
    anchor: /infected|alpha infected/i,
    ground: 'the infected containment lane', position: 'the Alpha Infected position',
    gunfighting: 'fired at the guard threatening the medics and covered a scan of the Infected',
    closeCombat: 'drove a defender away from the Infected and held the path open for a medic',
    endings: {
      heroWins: '{{heroPlayer}}’s crew came out ahead in the effort to scan and stabilize the Infected.',
      heroLoses: '{{otherPlayer}}’s crew came out ahead of {{heroPlayer}} in the effort to scan and stabilize the Infected.',
      draw: 'The efforts to scan and stabilize the Infected left both crews even.',
    },
    incidents: [
      incident('An Infected patient moved behind a broken screen as both crews arrived with scanners.', 'A fallen stretcher blocked the medic’s path to contact for stabilization, while scanning remained a separate opportunity.', 'The screen slipped aside, showing the patient still close enough for the waiting medic to reach.', 'stepped around the stretcher and began a stabilization attempt on the Infected patient', { position: 'the patient behind the screen' }),
      incident('The Alpha Infected stood in a dim corridor beyond a toppled examination cart.', 'The cart hid the Alpha’s position whenever the scanning light passed across the doorway.', 'A handprint appeared against the glass as an opposing escort moved toward the corridor.', 'circled the cart and attempted to stabilize the Alpha Infected while the scanning light crossed the doorway'),
      incident('Two Infected patients waited beside a narrow corridor as a stabilizer alarm sounded.', 'The alarm drowned the medic’s instructions while a rival escort tried to take the nearest patient.', 'The alarm paused, leaving a moment to scan the farther patient without deciding who could stabilize either one.', 'reached the nearer Infected patient and attempted to stabilize them while the farther scan remained open', { position: 'the nearer Infected patient' }),
      incident('The Alpha Infected reached the edge of the containment area while its escort stopped under fire.', 'A damaged scanner obscured the Alpha while a medic sought a separate route to reach the patient in contact.', 'The screen cleared long enough for the medic to read the patient’s condition from cover.', 'left cover to reach the Alpha Infected and attempted to stabilize the patient'),
    ],
  },
  'Panic Room': {
    source: 'https://infinitygeist.com/mission/s16_panic_room', season: 'ITS 16',
    anchor: /panic room|essential personnel/i,
    ground: 'the contested Panic Room', position: 'its open central gate',
    gunfighting: 'fired at the guard covering the Panic Room gate and sheltered Essential Personnel moving inside',
    closeCombat: 'forced a defender from the Panic Room entrance and held it for Essential Personnel',
    endings: {
      heroWins: '{{heroPlayer}}’s crew gained the edge in the fight for the Panic Room and Essential Personnel.',
      heroLoses: '{{otherPlayer}}’s crew gained the edge over {{heroPlayer}} in the fight for the Panic Room and Essential Personnel.',
      draw: 'The Panic Room and Essential Personnel remained contested with no clear victor.',
    },
    incidents: [
      incident('The Panic Room’s four gates stood open as an Essential Personnel officer approached the center.', 'A fallen cabinet blocked one gate while the rival crew entered by the opposite opening.', 'The cabinet shifted against the wall and exposed just enough floor for the officer to step inside.', 'pulled Essential Personnel through the narrow Panic Room gate toward its disputed center'),
      incident('Essential Personnel took cover outside the Panic Room while two squads disputed its east gate.', 'A jammed panel kept the officer outside while defenders began to occupy the room.', 'The panel lifted from its hinge and revealed a narrow route along the inner wall.', 'led Essential Personnel along the inner Panic Room wall past the jammed panel'),
      incident('The Panic Room floor stood empty except for an Essential Personnel officer trapped behind cover.', 'A rival patrol moved through the west gate as a broken table blocked the officer’s path.', 'The table slid toward the wall and gave both sides a short view of the center.', 'stepped onto the open Panic Room floor beside Essential Personnel to dispute its control'),
      incident('A warning light flashed above the Panic Room gate where Essential Personnel waited to enter.', 'Smoke hid the room’s occupants while a rival team tried to bring in its own officer.', 'The light cut through the smoke long enough to show a safe approach near the wall.', 'escorted Essential Personnel through the smoke toward the Panic Room floor'),
    ],
  },
  Provisioning: {
    source: 'https://infinitygeist.com/mission/s18_provisioning', season: 'ITS 18',
    anchor: /supply box|tech-coffin|safe area/i,
    ground: 'the supply-box route', position: 'the nearest Tech-Coffin',
    gunfighting: 'fired on the guard watching the supply box and covered its carrier approaching the safe area',
    closeCombat: 'drove a guard from the supply box and protected the carrier moving toward safe ground',
    endings: {
      heroWins: '{{heroPlayer}}’s crew had the stronger result in the struggle to move supply boxes into a safe area.',
      heroLoses: '{{otherPlayer}}’s crew had the stronger result over {{heroPlayer}} in the struggle to move supply boxes into a safe area.',
      draw: 'The two crews finished even in the struggle over supply boxes and safe areas.',
    },
    incidents: [
      incident('A supply box emerged from a Tech-Coffin as its door stalled halfway open.', 'The box caught on a bent hinge while rival troops approached the carrier’s route to safety.', 'The hinge gave way and exposed the handles just as the first carrier reached the coffin.', 'grabbed the supply box by its handle and tried to carry it from the Tech-Coffin toward the safe area'),
      incident('Two supply boxes lay beneath a fallen loading rack beside the open Tech-Coffin.', 'The rack shifted under fire and threatened to seal the only route toward the safe area.', 'A loose strap exposed one box handle at the edge of the rack.', 'pulled the supply box from beneath the rack and turned toward the safe area'),
      incident('A supply-box carrier crouched between the Tech-Coffin and the safety boundary under fire.', 'A damaged crate spilled gear across the crossing just as an opposing patrol moved in.', 'The carrier spotted a narrow cleared strip through the scattered supplies.', 'carried the supply box through the scattered gear toward the safe area'),
      incident('The Tech-Coffin opened to reveal a supply box already half-buried in loose packing.', 'A rival squad covered the exit while the first specialist tried to free the box.', 'A packing sheet tore away and exposed enough of the handle to move the box.', 'caught the supply box handle in the Tech-Coffin and pulled it toward the safe area'),
    ],
  },
  Annihilation: {
    source: 'https://infinitygeist.com/mission/s18_annihilation', season: 'ITS 18',
    anchor: /lieutenant|surviv|army point|casualt/i,
    ground: 'the broken battle line', position: 'the enemy lieutenant’s cover',
    gunfighting: 'fired at the guard covering the enemy lieutenant and protected the surviving squad',
    closeCombat: 'drove an attacker from the surviving squad and kept the approach to the lieutenant clear',
    endings: {
      heroWins: '{{heroPlayer}}’s force emerged ahead after the fight over casualties and surviving Army Points.',
      heroLoses: '{{otherPlayer}}’s force emerged ahead of {{heroPlayer}} after the fight over casualties and surviving Army Points.',
      draw: 'The toll of casualties and surviving Army Points left both forces evenly matched.',
    },
    incidents: [
      incident('The enemy lieutenant crossed an open lane as a shattered barricade exposed the surviving squad.', 'A second volley pinned the squad just as the lieutenant’s guard reached the remaining cover.', 'The guard moved to another position, leaving one narrow shot and one route for the survivors.', 'fired toward the enemy lieutenant while drawing the surviving squad into cover'),
      incident('A battered squad held its last shelter while the opposing lieutenant directed fire from above.', 'An incoming burst broke the shelter and forced the survivors into a narrow passage.', 'A smoke trail briefly screened the passage as the enemy officer moved along the roof.', 'led the surviving squad through the smoke and fired at the enemy lieutenant above'),
      incident('The enemy force pushed over a broken barricade toward its own surviving command group.', 'Fallen cover obscured whether the lieutenant remained with the advancing fighters or behind them.', 'A command signal revealed the officer’s position as a surviving fighter reached the flank.', 'pushed the surviving squad into cover and fired through the gap toward the enemy lieutenant'),
      incident('Two damaged squads converged on a lieutenant’s position at the edge of a ruined street.', 'A disabled gun blocked the nearest path while the officer’s guard prepared another volley.', 'The wreck shifted enough to expose a gap before either squad reached the street.', 'crossed the gap with the surviving squad and fired toward the enemy lieutenant’s cover'),
    ],
  },
  Battleground: {
    source: 'https://infinitygeist.com/mission/s18_battleground', season: 'ITS 18',
    anchor: /sector|dominat/i,
    ground: 'the contested central scoring sector', position: 'the far sector boundary',
    gunfighting: 'fired at the guard holding the central sector and covered a squad moving inside it',
    closeCombat: 'drove a defender from the central sector and held the boundary for the squad',
    endings: {
      heroWins: '{{heroPlayer}}’s force gained the advantage in the contest for the three scoring sectors.',
      heroLoses: '{{otherPlayer}}’s force gained the advantage over {{heroPlayer}} in the contest for the three scoring sectors.',
      draw: 'Neither force finished ahead in the contest for the three scoring sectors.',
    },
    incidents: [
      incident('The ground that would count as the central sector lay empty after a support beam fell across its closest approach.', 'A rival patrol reached the far ground first and threatened to occupy the open center from behind.', 'The beam moved under fire and revealed a narrow approach toward the center.', 'stepped over the beam into the future central sector to dispute the end-of-battle count'),
      incident('Both patrols estimated where the central sector would be measured once the fighting ended.', 'A fallen wall concealed the shortest route into the middle as a rival force occupied its edge.', 'The wall shifted and exposed a passage wide enough for one fighter to cross.', 'crossed the wall gap into the middle ground that would count as the central sector'),
      incident('The far ground fell quiet while gunfire continued around the disputed center.', 'A rival squad left its position to reinforce the center just as a barrier blocked the hero’s approach.', 'The barrier broke open and revealed a route toward the area that would become the central sector.', 'moved into the future central sector and tried to keep the rival reinforcement outside'),
      incident('Dust obscured the center while surviving squads advanced from opposite directions.', 'A collapsed railing blocked one team while the other moved toward the expected central sector.', 'The dust cleared and showed where the railing stopped short of the middle ground.', 'slipped around the railing and took a position inside the expected central sector'),
    ],
  },
  Cutthroat: {
    source: 'https://infinitygeist.com/mission/s18_cutthroat', season: 'ITS 18',
    anchor: /lieutenant|army point|casualt/i,
    ground: 'the lieutenant’s exposed flank', position: 'the opposing lieutenant’s guarded position',
    gunfighting: 'fired at the guard covering the enemy lieutenant and sheltered the friendly command route',
    closeCombat: 'drove a defender from the opposing lieutenant’s flank and protected the friendly officer',
    endings: {
      heroWins: '{{heroPlayer}}’s fighters took the lead after the clash between the rival lieutenants.',
      heroLoses: '{{otherPlayer}}’s fighters took the lead over {{heroPlayer}} after the clash between the rival lieutenants.',
      draw: 'The clash between the rival lieutenants settled without a winner.',
    },
    incidents: [
      incident('An enemy lieutenant moved between two guards as fire swept across a narrow street.', 'A broken vehicle hid the officer while the friendly squad searched for a clear attack.', 'The officer stepped out to signal another patrol, briefly exposing the gap beneath the wreck.', 'fired through the gap toward the enemy lieutenant and stepped back to shield the friendly squad'),
      incident('The friendly lieutenant sheltered behind a damaged wall while the enemy force pressed close.', 'A falling beam split the guard line and opened a dangerous lane toward the command position.', 'The beam struck the street and left one covered route for the officer to retreat.', 'stepped across the exposed lane and covered the friendly lieutenant’s withdrawal'),
      incident('A rival lieutenant directed an assault from a roof above the remaining fighters.', 'The roof rail snapped under fire and hid the officer behind a bank of dust.', 'A voice from the far edge of the roof revealed where the command group had gathered.', 'fired up at the enemy lieutenant’s roof position to disrupt the assault'),
      incident('Two lieutenants held opposite ends of a ruined block while their squads traded costly volleys.', 'A fresh flank attack threatened the friendly officer just as the rival guard lost its cover.', 'A shutter fell between the officers, creating a short route that either squad could contest.', 'blocked the short route to the friendly lieutenant and fired toward the rival officer'),
    ],
  },
  Superiority: {
    source: 'https://infinitygeist.com/mission/s18_superiority', season: 'ITS 18',
    anchor: /quadrant|console/i,
    ground: 'the contested quadrant', position: 'the central console',
    gunfighting: 'fired at the defender watching the console and covered the squad moving into the quadrant',
    closeCombat: 'drove a guard from the quadrant center and held the console approach',
    endings: {
      heroWins: '{{heroPlayer}}’s force held the edge in the contest for the quadrants and consoles.',
      heroLoses: '{{otherPlayer}}’s force held the edge over {{heroPlayer}} in the contest for the quadrants and consoles.',
      draw: 'The fight across the quadrants and consoles left neither force with an edge.',
    },
    incidents: [
      incident('A console stood between two quadrants whose defenders had fallen back behind cover.', 'A broken panel hid the console input while rival fighters moved across the nearer sector boundary.', 'The panel swung clear just as a specialist reached the console from the far quadrant.', 'keyed the console input and stepped into the contested quadrant'),
      incident('A squad entered a quadrant near the center while its console showed a failed hacking attempt.', 'The console alarm revealed the specialist’s position before the squad could establish a secure perimeter.', 'A second input prompt appeared as the rival squad crossed the opposite quadrant line.', 'tried the new console prompt and held a position inside the quadrant'),
      incident('The far quadrant emptied when a console signal drew both patrols toward its boundary.', 'The nearest specialist found the console blocked by a fallen shutter under the opposing force’s fire.', 'The shutter lifted with the next burst and exposed a narrow space at the control face.', 'reached through the shutter to try the console controls beside the adjacent quadrant'),
      incident('A hacked console flashed from an open quadrant as a second squad arrived to challenge its hold.', 'An overturned crate hid the scoring line and left both commanders unsure where their fighters stood.', 'The crate shifted away, revealing the sector edge as the opposing specialist approached the console.', 'crossed into the quadrant beside the hacked console to dispute its hold'),
    ],
  },
  'Uplink Center': {
    source: 'https://infinitygeist.com/mission/s18_uplink_center', season: 'ITS 18',
    anchor: /communication antenna|tech-coffin/i,
    ground: 'the contested line between the communication antennas', position: 'the contested Tech-Coffin',
    gunfighting: 'fired at the guard covering the communication antenna and sheltered the fighter approaching the Tech-Coffin',
    closeCombat: 'drove a defender from the communication antenna base and held the Tech-Coffin approach',
    endings: {
      heroWins: '{{heroPlayer}}’s crew pulled ahead in the fight over the communication antennas and Tech-Coffin.',
      heroLoses: '{{otherPlayer}}’s crew pulled ahead of {{heroPlayer}} in the fight over the communication antennas and Tech-Coffin.',
      draw: 'Neither crew pulled ahead in the fight over the communication antennas and Tech-Coffin.',
    },
    incidents: [
      incident('A communication antenna came alive beside the central Tech-Coffin as rival squads approached from opposite sides.', 'A fallen brace blocked the space needed to make sole contact with the coffin while an opposing specialist reached for the antenna.', 'The brace moved and exposed a narrow route to the coffin base.', 'slid past the communication antenna and pressed toward sole contact at the Tech-Coffin'),
      incident('A Tech-Coffin stood beneath an antenna awaiting its next activation.', 'A fallen shutter blocked the route to coffin contact while both squads converged on the aerial.', 'The shutter shifted and exposed a passage between the coffin and antenna base.', 'reached under the shutter for the communication antenna switch and pressed toward the Tech-Coffin'),
      incident('Two communication antennas flashed beside a Tech-Coffin screened by a broken rail.', 'A rival specialist reached the farther antenna while the nearest squad sought contact with the coffin.', 'The rail moved under fire and briefly exposed the coffin base and active antenna panel.', 'ducked below the rail to reach the Tech-Coffin while trying the communication antenna controls'),
      incident('An antenna transmitted above the central Tech-Coffin as rival fighters closed on its base.', 'The specialist could not reach the antenna controls while an enemy model disputed contact with the coffin.', 'A guard shifted cover and briefly exposed separate routes to the antenna and coffin.', 'tried the communication antenna switch before reaching toward the disputed Tech-Coffin base'),
    ],
  },
  'Double Bind': {
    source: 'https://infinitygeist.com/mission/s18_double_bind', season: 'ITS 18',
    // The September 24 ITS 18 hotfix requires each side to choose one of three
    // objective sets when Deployment is chosen. Public games omit that choice.
    requiresUnreportedSetup: true, anchor: /antenna|zone of influence/i,
    ground: 'the antenna and zone-of-influence line', position: 'the contested aerial',
    gunfighting: 'fired at the guard covering the antenna and sheltered a specialist near the contested zone',
    closeCombat: 'drove a defender from the antenna base and held the adjacent zone for the squad',
    endings: {
      heroWins: '{{heroPlayer}}’s crew earned the advantage around the antennas and zones of influence.',
      heroLoses: '{{otherPlayer}}’s crew earned the advantage over {{heroPlayer}} around the antennas and zones of influence.',
      draw: 'The rival crews disputed the antennas and zones of influence without a clear winner.',
    },
    incidents: [
      incident('An antenna stood at the edge of a zone of influence where both squads had taken cover.', 'A specialist approached the aerial while the rival force shifted enough bodies into the scoring zone.', 'A broken barrier opened a narrow path between the antenna base and the contested zone.', 'keyed an antenna request and crossed the barrier into the zone of influence'),
      incident('Two antennas showed rival activations above a zone of influence full of moving fighters.', 'A fallen panel blocked one aerial’s controls just as the other force sent reserves into the zone.', 'The panel rocked aside and exposed a short path toward the active antenna.', 'touched the exposed antenna controls and pushed into the disputed zone of influence'),
      incident('A zone of influence emptied as both sides tried to reach the antenna beyond it.', 'A disabled carrier blocked the aerial base while a rival squad returned to the scored zone.', 'The carrier shifted and exposed the controls at the moment both squads crossed the boundary.', 'reached over the carrier for the antenna controls and entered the zone of influence'),
      incident('The nearest antenna flashed above a zone of influence divided by broken cover.', 'A specialist reached the base while opposing troops held enough space to dispute the zone.', 'A gap opened in the cover and briefly connected the aerial approach with scoring ground.', 'keyed the antenna controls and stepped through the gap into the zone of influence'),
    ],
  },
  'The Dig': {
    source: 'https://infinitygeist.com/mission/s18_the_dig', season: 'ITS 18',
    // September 24 ITS 18 hotfix: Analyze Hyperthermal Tech is performed in
    // contact with a Console before any neutralization, with Player Tokens.
    anchor: /hyperthermal tech|analysis console|analy/i,
    ground: 'the buried hyperthermal tech site', position: 'the analysis console',
    gunfighting: 'fired at the guard covering the analysis console and sheltered the specialist approaching the buried tech',
    closeCombat: 'drove a defender away from the analysis console and held the path to the buried tech',
    endings: {
      heroWins: '{{heroPlayer}}’s crew gained the edge in the struggle to analyze hyperthermal tech at the consoles and neutralize marked tech in contact.',
      heroLoses: '{{otherPlayer}}’s crew gained the edge over {{heroPlayer}} in the struggle to analyze hyperthermal tech at the consoles and neutralize marked tech in contact.',
      draw: 'Neither crew gained a lead in the effort to analyze hyperthermal tech at the consoles and neutralize marked tech in contact.',
    },
    incidents: [
      incident('A hyperthermal tech unit emerged from the dig beside a console still covered in stone dust.', 'The console reader skipped during analysis while the rival crew approached the live tech.', 'A buried contact appeared beneath the dust, offering one chance to finish the analysis.', 'pressed the exposed contact and attempted a WIP analysis of the hyperthermal tech at the console'),
      incident('A buried tech signal lit the dig before either crew reached its analysis console.', 'A broken cable divided the console from the hyperthermal tech as an enemy squad crossed the shaft.', 'A loose contact emerged from the dust and exposed where the analysis had stopped.', 'reached the analysis console controls and began a reading of the buried hyperthermal tech'),
      incident('Two hyperthermal tech units glowed beneath the dig while the nearest analysis console stayed dark.', 'Fallen stone hid the input face just as rival specialists reached the excavation rim.', 'The stones shifted to reveal an unfinished analysis prompt, with neither unit marked for a contact neutralization.', 'cleared the analysis console input and attempted a WIP reading of the hyperthermal tech'),
      incident('A hyperthermal tech indicator glowed beneath the dig while both teams disputed the nearest console.', 'Loose rock covered the control face and obscured whether anyone had analyzed the live unit.', 'A stone shifted and revealed an unfinished analysis prompt beside an unmarked tech indicator.', 'brushed away the rock and attempted a WIP analysis of the hyperthermal tech at the console'),
    ],
  },
  'Data Harvest': {
    source: 'https://infinitygeist.com/mission/s18_data_harvest', season: 'ITS 18',
    anchor: /data-harvester|designated zone/i,
    ground: 'the enemy designated zone', position: 'the active data-harvester',
    gunfighting: 'fired at the guard covering the data-harvester and protected its route into the enemy zone',
    closeCombat: 'drove a defender from the designated zone and held space for the data-harvester carrier',
    endings: {
      heroWins: '{{heroPlayer}}’s crew gained the advantage in the contest for active data-harvesters in the designated zones.',
      heroLoses: '{{otherPlayer}}’s crew gained the advantage over {{heroPlayer}} in the contest for active data-harvesters in the designated zones.',
      draw: 'Neither crew finished ahead in the contest for active data-harvesters in the designated zones.',
    },
    incidents: [
      incident('A data-harvester reached the enemy designated zone after its carrier crossed a damaged bridge.', 'The harvester’s activity light flickered while a rival patrol approached from the far side.', 'A short signal returned when the carrier placed it behind cover inside the zone.', 'reached for the active data-harvester inside the designated zone and tried to steady its connection'),
      incident('Two data-harvesters stood near opposite designated zones as rival fighters converged on one active device.', 'The active unit sat beyond a broken railing where a specialist could reach it only under fire.', 'The railing shifted and revealed a narrow path to the harvester inside the zone.', 'slipped past the railing toward the active data-harvester in the designated zone'),
      incident('A data-harvester carrier reached the enemy half while defenders held the designated zone.', 'The rival squad guarded the zone boundary and denied a clear place to deposit the inactive harvester.', 'A gap opened beside their cover, exposing ground wholly inside the designated zone.', 'carried the data-harvester through the gap and tried to deposit it wholly inside the designated zone'),
      incident('An active data-harvester remained alone in a designated zone after both escorts withdrew.', 'A patrol closed on its exposed casing while the nearest friendly specialist searched for a return route.', 'Smoke shifted across the zone marker and left the unit briefly hidden from the approaching patrol.', 'returned through the smoke and tried to protect the active data-harvester inside the designated zone'),
    ],
  },
}
