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
  objectiveSkill?: 'infectedCare'
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
      heroWins: '{{heroPlayer}}’s squad prevailed in the fight around the communication antenna and its scoring ground.',
      heroLoses: '{{otherPlayer}}’s squad prevailed over {{heroPlayer}} in the fight around the communication antenna and its scoring ground.',
      draw: 'The fight for the communication antenna and its surrounding ground ended level.',
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
      heroWins: '{{heroPlayer}}’s crew prevailed after the contest for classified objectives at the Akial Antenna.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the contest for classified objectives at the Akial Antenna.',
      draw: 'The contest for classified objectives at the Akial Antenna ended level.',
    },
    incidents: [
      { opening: 'At the start of the round, both crews saw two new Common Classified cards as they approached the Akial Antenna.',
        complication: 'A specialist could see the public cards, but gunfire blocked the antenna controls used to filter one of them.',
        turn: 'A gap in the firing lane briefly opened access to the antenna controls.',
        objectiveAction: 'checked the public Common Classified cards and prepared to filter one at the Akial Antenna' },
      { opening: 'An operator who had accomplished a Common Classified card with the matching symbol approached the Akial Antenna.',
        complication: 'The rival operator guarded the aerial while an accomplished public card remained vulnerable to interference.',
        turn: 'Static broke over the antenna screen just as the guard shifted from its controls.',
        objectiveAction: 'compared the accomplished Common Classified symbols and prepared to emit Akial interference' },
      { opening: 'The public Common Classified cards remained in view while an operator tried to reach the Akial Antenna.',
        complication: 'A defender held the antenna base, preventing the specialist from filtering an unfavorable card.',
        turn: 'The defender moved into cover and left the filter controls exposed for a moment.',
        objectiveAction: 'checked which Common Classified card could be replaced and prepared to filter the signal' },
      { opening: 'Another round approached with two Common Classified cards due to change by the Akial Antenna.',
        complication: 'Neither operator could reach the aerial while guards traded fire across its service walkway.',
        turn: 'One guard fell back and left a narrow approach to the controls before the cards rotated.',
        objectiveAction: 'reached the Akial Antenna and reviewed the public Common Classified cards before requesting a filter' },
    ],
  },
  'B-Pong': {
    source: 'https://infinitygeist.com/mission/s18_b_pong', season: 'ITS 18',
    anchor: /tracking beacon|console/i,
    ground: 'the tracking beacon lane', position: 'the nearest console',
    gunfighting: 'fired at the guard beside the tracking beacon and sheltered the specialist by the console',
    closeCombat: 'drove a guard from the tracking beacon and opened a route toward the console',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the struggle over the tracking beacon and consoles.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the struggle over the tracking beacon and consoles.',
      draw: 'The struggle over the tracking beacon and consoles ended level.',
    },
    incidents: [
      { opening: 'The tracking beacon sat at the centerline as a console flickered behind an abandoned barricade.',
        complication: 'A cable tore loose beneath the console, leaving the unattended beacon beyond the specialist’s reach.',
        turn: 'The console reconnected while the beacon remained unattended across the lane.',
        objectiveAction: 'checked that nobody touched the tracking beacon before activating the console to nudge it toward the far half' },
      { opening: 'A tracking beacon stood between two consoles as fresh smoke rolled over the central lane.',
        complication: 'Smoke separated the specialist from the beacon while a guard watched the nearer console.',
        turn: 'A gust exposed the beacon base and a clear route to its contact ring.',
        objectiveAction: 'reached the tracking beacon in contact and prepared to relocate it toward the rival half' },
      { opening: 'A tracking beacon rested short of the far half while one console flashed through smoke.',
        complication: 'A cracked screen concealed the last console input as both specialists approached the unattended beacon.',
        turn: 'A pause in the smoke revealed the beacon resting beyond the console guard’s firing lane.',
        objectiveAction: 'checked the unattended tracking beacon and prepared a console nudge toward the far half' },
      { opening: 'The tracking beacon halted beneath an overhead gantry as the nearest console lost its display.',
        complication: 'A hanging cable blocked the specialist’s view while the rival team approached the beacon itself.',
        turn: 'The cable fell away and exposed a narrow path to the beacon’s contact ring.',
        objectiveAction: 'reached the tracking beacon and prepared a direct relocation before the rival specialist arrived' },
    ],
  },
  'Corporate Appropriation': {
    source: 'https://infinitygeist.com/mission/s18_corporate_appropriation', season: 'ITS 18',
    anchor: /prototype|panoply/i,
    ground: 'the enemy prototype cradle', position: 'the adjacent panoply',
    gunfighting: 'fired at the guard covering the prototype and sheltered the carrier near the panoply',
    closeCombat: 'drove a defender from the prototype cradle and opened an escape route for its carrier',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the fight over the prototype and panoplies.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the fight over the prototype and panoplies.',
      draw: 'The contest for the prototype and panoplies ended level.',
    },
    incidents: [
      incident('An enemy prototype rolled from a damaged cradle as both crews entered the equipment bay.', 'A failed brake sent the prototype toward a service lift beneath the rival firing lane.', 'The lift began descending with the restraint open and its carrier still a step away.', 'checked the prototype restraint and prepared a safe capture before the lift dropped'),
      incident('An enemy prototype stood beside a panoply whose locker seals had just failed.', 'A rival specialist searched the open locker while a guard blocked the prototype carrier’s exit.', 'The broken locker door swung across the lane, briefly screening a path to the prototype.', 'inspected the prototype cradle and marked a route past the panoply for its carrier'),
      incident('A prototype crate lay between two panoplies after an equipment transport overturned.', 'A damaged label obscured which container held the enemy prototype under the fallen transport.', 'A torn seal exposed a serial mark as the opposing squad approached the wreck.', 'identified the enemy prototype beneath the transport and directed its carrier toward cover'),
      incident('The prototype cradle alarm sounded as the nearest panoply opened without a specialist nearby.', 'A loose clamp held the prototype in place while rival fighters searched the room.', 'A sudden power dip released the clamp halfway and opened a narrow route to the cradle.', 'checked the prototype clamp and prepared the carrier to secure it near the panoply'),
    ],
  },
  'Critical Intervention': {
    source: 'https://infinitygeist.com/mission/s18_critical_intervention', season: 'ITS 18',
    requiresUnreportedSetup: true, anchor: /data console|data pack|server room/i,
    ground: 'the server room', position: 'the data console',
    gunfighting: 'fired at the guard covering the data console and shielded the specialist near the server racks',
    closeCombat: 'forced a defender from the data console and held the route out of the server room',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the contest for the server room and its data pack.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the contest for the server room and its data pack.',
      draw: 'The fight for the server room and its data pack ended level.',
    },
    incidents: [
      incident('The data console reported an unlocked pack, but its cradle stayed shut inside the server room.', 'A bent release bar caught the pack carrier’s glove while defenders closed on the doorway.', 'The bar gave a little under pressure, exposing the data pack without freeing it from the cradle.', 'checked the data console release bar and prepared to extract the data pack'),
      incident('A data pack waited beside the server-room console as the alarm sounded through an empty corridor.', 'A locked partition separated the attacker’s specialist from the pack while defenders approached the room.', 'A damaged hinge exposed a narrow opening just as the console displayed another lock warning.', 'located the data pack behind the partition and checked the console lock'),
      incident('The server room went dark around a data console showing one remaining active connection.', 'The attacker could not read the pack status while the defender reached the room’s far entrance.', 'Emergency lighting revealed the console face and a narrow passage to the pack cradle.', 'read the data console status and guided the carrier toward the data pack'),
      incident('A dropped data pack lay beside the server-room threshold as its console began a lock sequence.', 'The attacker’s carrier reached for the pack while a defender covered the room from a damaged rack.', 'The rack shifted and briefly masked both teams from the blinking console display.', 'checked the data pack seal and marked a covered route out of the server room'),
    ],
  },
  'Crossing Lines': {
    source: 'https://infinitygeist.com/mission/s18_crossing_lines', season: 'ITS 18',
    anchor: /dead zone|antenna/i,
    ground: 'the disputed dead zone', position: 'the antenna at its edge',
    gunfighting: 'fired at the guard overlooking the dead zone and covered the specialist reaching the antenna',
    closeCombat: 'drove a defender from the antenna approach and held the dead zone for the squad',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed in the contest across the dead zones and antennas.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} in the contest across the dead zones and antennas.',
      draw: 'The contest across the dead zones and antennas ended level.',
    },
    incidents: [
      incident('A fallen sign blocked the antenna overlooking one of the two dead zones.', 'Its metal frame rolled into the scoring area and exposed the specialist trying to cross behind it.', 'A gap opened beneath the frame just as rival troops reached the other side of the zone.', 'located the antenna behind the fallen sign and marked a path into the dead zone'),
      incident('One dead zone lay in shadow while its communication antenna flashed through the smoke.', 'A rival patrol occupied the second zone while the first specialist struggled to see the antenna input.', 'The smoke thinned long enough to reveal the control panel and an empty approach lane.', 'checked the antenna activation and directed the squad into the disputed dead zone'),
      incident('A cable from the near antenna crossed the boundary of a contested dead zone.', 'A broken connector left the control face dark while opposing fighters advanced from the far zone.', 'A spare connector appeared beneath the cable shield just as a specialist reached the boundary.', 'found the antenna connector and prepared its activation inside the dead zone'),
      incident('Two dead zones opened on either side of an antenna damaged in the first exchange.', 'A falling shutter separated the squad from the antenna as the other force entered the scored ground.', 'The shutter caught on a broken hinge and left one passage toward the antenna base.', 'inspected the antenna beneath the shutter and called the squad into the dead zone'),
    ],
  },
  "Dead Man's Switch": {
    source: 'https://infinitygeist.com/mission/cm_lobo_dead_mans_switch', season: 'Lobo League',
    anchor: /quantum core|data pack|objective room|resonance/i,
    ground: 'the Objective Room', position: 'the Quantum Core',
    gunfighting: 'fired at the guard near the Objective Room and covered a specialist approaching the Core',
    closeCombat: 'drove a bodyguard away from the Quantum Core and protected the specialist approaching it',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the fight for the Quantum Core and Objective Room.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the fight for the Quantum Core and Objective Room.',
      draw: 'The fight over the Quantum Core and Objective Room ended level.',
    },
    incidents: [
      incident('The Quantum Core lay unattended in the Objective Room after its bearer slipped away under fire.', 'A loose floor plate hid the Core from the nearest specialist while rival fighters reached the room entrance.', 'The plate rocked and exposed its glow just as a Data Pack carrier came within sight.', 'found the Quantum Core beneath the plate and prepared a specialist to claim it safely'),
      incident('A Data Pack carrier approached the Objective Room while two Quantum Core seekers watched its door.', 'The nearest console flickered as the carrier drew near enough for Quantum Resonance to matter.', 'A rival fighter crossed the room and briefly separated the carrier from the Core.', 'checked the Data Pack console and marked a route for the carrier toward the Quantum Core'),
      incident('The Quantum Core lay between two Stunned fighters near the Objective Room entrance.', 'The next bearer could not fire or take a second Move while carrying the unstable payload.', 'A bodyguard stepped away from the room door and opened a slow route toward the Core.', 'located the Quantum Core between the Stunned fighters and guided a specialist inside'),
      incident('Both Data Pack consoles glowed outside the Objective Room while the Quantum Core remained unclaimed.', 'A dropped pack blocked one specialist at the threshold as an opposing squad took cover.', 'The pack slid clear and exposed the console control just as another trooper entered the room.', 'checked the Data Pack console and prepared to contest the Quantum Core inside'),
    ],
  },
  Evacuation: {
    source: 'https://infinitygeist.com/mission/s18_evacuation', season: 'ITS 18',
    anchor: /civilian|HVT|Extraction Console/i,
    ground: 'the approach to the Extraction Console', position: 'the waiting civilian escort',
    gunfighting: 'fired at the guard covering the Extraction Console and sheltered the specialist escorting a civilian',
    closeCombat: 'forced a defender from the Extraction Console and shielded the specialist escorting a civilian',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed amid the struggle to bring civilians or enemy HVTs to the Extraction Consoles.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} amid the struggle to bring civilians or enemy HVTs to the Extraction Consoles.',
      draw: 'The struggle to bring civilians or enemy HVTs to the Extraction Consoles ended level.',
    },
    incidents: [
      incident('After the first round, a specialist CivEvacing a civilian approached an Extraction Console behind a fallen barrier.', 'The barrier slid into the firing lane and kept the specialist from reaching the console in contact.', 'A gap opened below the barrier as the rival squad moved to cover the controls.', 'checked the Extraction Console and guided the CivEvaced civilian toward its contact point'),
      incident('A specialist CivEvacing a civilian sheltered behind a damaged handrail near the second Extraction Console.', 'The handrail pinned the escort short of the controls while patrols traded fire across the open passage.', 'The rail dropped away and briefly exposed a sheltered route to the console face.', 'found a path for the specialist and civilian to reach the Extraction Console together'),
      incident('An enemy HVT waited near the central corridor while both crews fought for an Extraction Console.', 'Smoke hid the HVT as a specialist tried to reach it and begin CivEvac before approaching the controls.', 'The smoke lifted and exposed the HVT, but a rival patrol still watched the console.', 'located the enemy HVT and mapped a route for CivEvac to the Extraction Console', { position: 'the enemy HVT beside the corridor' }),
      incident('A specialist CivEvacing a civilian stopped short of an Extraction Console when shooting resumed.', 'An overturned cart split the escort from the console and left both in the opposing squad’s firing lane.', 'The cart rolled aside and offered one brief opening at the console controls.', 'guided the CivEvaced civilian into contact with the Extraction Console and prepared its activation'),
    ],
  },
  Hardlock: {
    source: 'https://infinitygeist.com/mission/s18_hard_lock', season: 'ITS 18',
    anchor: /beacon|console/i,
    ground: 'the enemy beacon position', position: 'the activated-console line',
    gunfighting: 'fired at the defender watching the enemy beacon and covered the console specialist',
    closeCombat: 'drove a guard from the enemy beacon and held its position for the advancing specialist',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the contest for the enemy beacon and consoles.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the contest for the enemy beacon and consoles.',
      draw: 'The contest for the enemy beacon and consoles ended level.',
    },
    incidents: [
      incident('The enemy beacon stood beyond three consoles whose activation lights changed out of sequence.', 'A shattered display hid which console still answered the specialist approaching from the beacon side.', 'The nearest light settled for one breath as rival troops moved onto the beacon base.', 'read the activated console and marked an approach to the enemy beacon'),
      incident('A beacon marker remained contested while the final open console drew specialists from both sides.', 'A fallen panel hid the active switch as defenders pressed into contact with the enemy beacon.', 'The panel tipped and revealed the console face just before another squad entered the beacon lane.', 'checked the console control and directed the squad to contest the enemy beacon'),
      incident('The enemy beacon flashed above consoles whose status display had gone dark.', 'A damaged power cable kept the nearest console unreachable while a rival specialist closed in.', 'A spark exposed a backup connector underneath the console housing at the beacon base.', 'located the console connector and prepared an activation beside the enemy beacon'),
      incident('Two consoles stayed active after their beacon guard retreated into the central lane.', 'A broken barricade blocked the route to the enemy beacon while the other crew rebuilt its line.', 'The barricade shifted under fire and opened a gap beside the nearer console.', 'inspected the activated console and guided the squad toward the enemy beacon'),
    ],
  },
  'Last Launch': {
    source: 'https://infinitygeist.com/mission/s18_last_launch', season: 'ITS 18',
    anchor: /launching tower|ID Scanner|ID Checker|extract/i,
    ground: 'the ID Scanner approach', position: 'the ID Checker inside the Launching Tower',
    gunfighting: 'fired at the guard covering the Launching Tower and sheltered the bearer of an ID Token',
    closeCombat: 'drove a guard off the route to the ID Checker and covered the bearer’s next move',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the contest to carry an ID to the Launching Tower checker.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the contest to carry an ID to the Launching Tower checker.',
      draw: 'The contest to bring an ID to the Launching Tower checker ended level.',
    },
    incidents: [
      incident('A specialist approached an ID Scanner while an escort waited outside the Launching Tower.', 'A fallen stair rail exposed the scanner to the opposing crew and delayed the WIP download needed for an ID Token.', 'The rail pulled loose and offered a narrow approach before the patrol reached the scanner.', 'checked the ID Scanner and prepared to download an ID for the tower crossing'),
      incident('A trooper carrying an ID Token reached a Launching Tower gate with the ID Checker still across the room.', 'A rival patrol entered by the next gate and cut off the direct route to the checker.', 'A damaged inner partition shifted and exposed another path between the bearer and the tower center.', 'mapped the Launching Tower passage and guided the ID bearer toward the checker', { ground: 'the Launching Tower gate' }),
      incident('An ID Scanner flickered below the Launching Tower while the checker stood beyond its dark central gate.', 'A guard covered the scanner and forced a specialist to shelter before downloading an ID.', 'Emergency lighting revealed the scanner face as the opposing crew moved toward the tower.', 'found the ID Scanner controls and prepared a download before anyone approached the ID Checker'),
      incident('A wounded trooper carrying an ID Token took cover at the Launching Tower threshold.', 'A broken handrail and a rival guard separated the bearer from the ID Checker at the tower center.', 'A smoke trail briefly concealed the route inside without settling who could reach the checker.', 'checked the ID Token and marked a covered route into contact with the ID Checker', { ground: 'the Launching Tower threshold' }),
    ],
  },
  Neutralization: {
    source: 'https://infinitygeist.com/mission/s18_neutralization', season: 'ITS 18',
    anchor: /hyperthermal tech|Neutralization Area|neutralizing antenna/i,
    ground: 'the Hyperthermal Tech Box passage', position: 'the nearest Neutralization Area',
    gunfighting: 'fired at the guard between the Hyperthermal Tech Box and the Neutralization Area',
    closeCombat: 'drove a defender from the Neutralization Area and sheltered the tech bearer',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed in the struggle to carry Hyperthermal Tech into a Neutralization Area.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} in the struggle to carry Hyperthermal Tech into a Neutralization Area.',
      draw: 'The struggle over Hyperthermal Tech and the Neutralization Areas ended level.',
    },
    incidents: [
      incident('A specialist reached a Hyperthermal Tech Box while a Neutralization Area lay beyond the exposed crossing.', 'Fire struck the box housing and delayed the WIP extraction needed before anyone could carry the tech.', 'A damaged panel opened enough to reach the box as rival troops entered the lane.', 'checked the Hyperthermal Tech Box and marked a route for its bearer into the Neutralization Area'),
      incident('A trooper carrying Hyperthermal Tech stopped just outside a Neutralization Area beside an antenna.', 'A rival patrol held the area boundary, while the antenna offered a separate fight for control.', 'The patrol changed cover and left a narrow passage into the circular zone.', 'measured the Neutralization Area boundary and guided the Hyperthermal Tech bearer toward it', { ground: 'the Neutralization Area boundary' }),
      incident('A Hyperthermal Tech Box lay behind a barricade while a carrier waited for the extracted token.', 'A rival fighter watched the box as the specialist tried to reach it in contact for an extraction attempt.', 'The barricade shifted and exposed the box latch without clearing the route to the Neutralization Area.', 'inspected the Hyperthermal Tech Box and prepared an extraction before the carrier crossed the zone'),
      incident('A Hyperthermal Tech bearer took cover near a Neutralization Area whose edge lay under fire.', 'The bearer could not neutralize the token while outside the area, and a rival squad watched the crossing.', 'A fallen rail opened a path into the circular zone before the guard could move closer.', 'checked the Hyperthermal Tech bearer’s route and marked where they could enter the Neutralization Area', { ground: 'the Neutralization Area boundary' }),
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
      heroWins: '{{heroPlayer}}’s crew prevailed after the contest to scan and stabilize the Infected.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the contest to scan and stabilize the Infected.',
      draw: 'The contest to scan and stabilize the Infected ended level.',
    },
    incidents: [
      incident('An Infected patient moved behind a broken screen as both crews arrived with scanners.', 'A fallen stretcher blocked the medic’s path to contact for stabilization, while scanning remained a separate opportunity.', 'The screen slipped aside, showing the patient still close enough for the waiting medic to reach.', 'checked the Infected patient’s position and prepared to stabilize them beyond the stretcher', { position: 'the patient behind the screen' }),
      incident('The Alpha Infected stood in a dim corridor beyond a toppled examination cart.', 'The cart hid the Alpha’s position whenever the scanning light passed across the doorway.', 'A handprint appeared against the glass as an opposing escort moved toward the corridor.', 'located the Alpha Infected and prepared to stabilize the patient in contact while the scan remained open'),
      incident('Two Infected patients waited beside a narrow corridor as a stabilizer alarm sounded.', 'The alarm drowned the medic’s instructions while a rival escort tried to take the nearest patient.', 'The alarm paused, leaving a moment to scan the farther patient without deciding who could stabilize either one.', 'checked the nearer Infected patient and prepared to stabilize them while a teammate watched the farther scan', { position: 'the nearer Infected patient' }),
      incident('The Alpha Infected reached the edge of the containment area while its escort stopped under fire.', 'A damaged scanner obscured the Alpha while a medic sought a separate route to reach the patient in contact.', 'The screen cleared long enough for the medic to read the patient’s condition from cover.', 'checked the Alpha Infected condition and marked a route into contact to stabilize the patient'),
    ],
  },
  'Panic Room': {
    source: 'https://infinitygeist.com/mission/s16_panic_room', season: 'ITS 16',
    anchor: /panic room|essential personnel/i,
    ground: 'the contested Panic Room', position: 'its open central gate',
    gunfighting: 'fired at the guard covering the Panic Room gate and sheltered Essential Personnel moving inside',
    closeCombat: 'forced a defender from the Panic Room entrance and held it for Essential Personnel',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the fight for the Panic Room and Essential Personnel.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the fight for the Panic Room and Essential Personnel.',
      draw: 'The fight over the Panic Room and Essential Personnel ended level.',
    },
    incidents: [
      incident('The Panic Room’s four gates stood open as an Essential Personnel officer approached the center.', 'A fallen cabinet blocked one gate while the rival crew entered by the opposite opening.', 'The cabinet shifted against the wall and exposed just enough floor for the officer to step inside.', 'checked the Panic Room entrance and guided Essential Personnel into the contested zone'),
      incident('Essential Personnel took cover outside the Panic Room while two squads disputed its east gate.', 'A jammed panel kept the officer outside while defenders began to occupy the room.', 'The panel lifted from its hinge and revealed a narrow route along the inner wall.', 'found a path into the Panic Room for Essential Personnel and signaled the occupying squad'),
      incident('The Panic Room floor stood empty except for an Essential Personnel officer trapped behind cover.', 'A rival patrol moved through the west gate as a broken table blocked the officer’s path.', 'The table slid toward the wall and gave both sides a short view of the center.', 'located Essential Personnel in the Panic Room and marked a route to dominate its floor'),
      incident('A warning light flashed above the Panic Room gate where Essential Personnel waited to enter.', 'Smoke hid the room’s occupants while a rival team tried to bring in its own officer.', 'The light cut through the smoke long enough to show a safe approach near the wall.', 'inspected the Panic Room gate and guided Essential Personnel through the safe approach'),
    ],
  },
  Provisioning: {
    source: 'https://infinitygeist.com/mission/s18_provisioning', season: 'ITS 18',
    anchor: /supply box|tech-coffin|safe area/i,
    ground: 'the supply-box route', position: 'the nearest Tech-Coffin',
    gunfighting: 'fired on the guard watching the supply box and covered its carrier approaching the safe area',
    closeCombat: 'drove a guard from the supply box and protected the carrier moving toward safe ground',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the struggle to move supply boxes into a safe area.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the struggle to move supply boxes into a safe area.',
      draw: 'The struggle over supply boxes and safe areas ended level.',
    },
    incidents: [
      incident('A supply box emerged from a Tech-Coffin as its door stalled halfway open.', 'The box caught on a bent hinge while rival troops approached the carrier’s route to safety.', 'The hinge gave way and exposed the handles just as the first carrier reached the coffin.', 'checked the Tech-Coffin hinge and guided the supply-box carrier toward the safe area'),
      incident('Two supply boxes lay beneath a fallen loading rack beside the open Tech-Coffin.', 'The rack shifted under fire and threatened to seal the only route toward the safe area.', 'A loose strap exposed one box handle at the edge of the rack.', 'located the supply box beneath the rack and prepared its passage into the safe area'),
      incident('A supply-box carrier crouched between the Tech-Coffin and the safety boundary under fire.', 'A damaged crate spilled gear across the crossing just as an opposing patrol moved in.', 'The carrier spotted a narrow cleared strip through the scattered supplies.', 'mapped a route for the supply-box carrier into the safe area'),
      incident('The Tech-Coffin opened to reveal a supply box already half-buried in loose packing.', 'A rival squad covered the exit while the first specialist tried to free the box.', 'A packing sheet tore away and exposed enough of the handle to move the box.', 'checked the supply box in the Tech-Coffin and signaled a carrier toward the safe area'),
    ],
  },
  Annihilation: {
    source: 'https://infinitygeist.com/mission/s18_annihilation', season: 'ITS 18',
    anchor: /lieutenant|surviv|army point|casualt/i,
    ground: 'the broken battle line', position: 'the enemy lieutenant’s cover',
    gunfighting: 'fired at the guard covering the enemy lieutenant and protected the surviving squad',
    closeCombat: 'drove an attacker from the surviving squad and kept the approach to the lieutenant clear',
    endings: {
      heroWins: '{{heroPlayer}}’s force prevailed after the fight over casualties and surviving Army Points.',
      heroLoses: '{{otherPlayer}}’s force prevailed over {{heroPlayer}} after the fight over casualties and surviving Army Points.',
      draw: 'The fight over casualties and surviving Army Points ended level.',
    },
    incidents: [
      incident('The enemy lieutenant crossed an open lane as a shattered barricade exposed the surviving squad.', 'A second volley pinned the squad just as the lieutenant’s guard reached the remaining cover.', 'The guard moved to another position, leaving one narrow shot and one route for the survivors.', 'located the enemy lieutenant’s route and marked cover for the surviving squad'),
      incident('A battered squad held its last shelter while the opposing lieutenant directed fire from above.', 'An incoming burst broke the shelter and forced the survivors into a narrow passage.', 'A smoke trail briefly screened the passage as the enemy officer moved along the roof.', 'mapped the surviving squad’s passage and identified the enemy lieutenant above it'),
      incident('The enemy force pushed over a broken barricade toward its own surviving command group.', 'Fallen cover obscured whether the lieutenant remained with the advancing fighters or behind them.', 'A command signal revealed the officer’s position as a surviving fighter reached the flank.', 'identified the lieutenant behind the barricade and directed the survivors toward cover'),
      incident('Two damaged squads converged on a lieutenant’s position at the edge of a ruined street.', 'A disabled gun blocked the nearest path while the officer’s guard prepared another volley.', 'The wreck shifted enough to expose a gap before either squad reached the street.', 'checked the surviving squad’s route and marked the enemy lieutenant’s defended position'),
    ],
  },
  Battleground: {
    source: 'https://infinitygeist.com/mission/s18_battleground', season: 'ITS 18',
    anchor: /sector|dominat/i,
    ground: 'the contested central scoring sector', position: 'the far sector boundary',
    gunfighting: 'fired at the guard holding the central sector and covered a squad moving inside it',
    closeCombat: 'drove a defender from the central sector and held the boundary for the squad',
    endings: {
      heroWins: '{{heroPlayer}}’s force prevailed after the contest for the three scoring sectors.',
      heroLoses: '{{otherPlayer}}’s force prevailed over {{heroPlayer}} after the contest for the three scoring sectors.',
      draw: 'The contest for the three scoring sectors ended level.',
    },
    incidents: [
      incident('The ground that would count as the central sector lay empty after a support beam fell across its closest approach.', 'A rival patrol reached the far ground first and threatened to occupy the open center from behind.', 'The beam moved under fire and revealed a narrow approach toward the center.', 'checked the central sector approach and signaled where the squad would need to finish'),
      incident('Both patrols estimated where the central sector would be measured once the fighting ended.', 'A fallen wall concealed the shortest route into the middle as a rival force occupied its edge.', 'The wall shifted and exposed a passage wide enough for one fighter to cross.', 'compared the expected sector limits and directed the squad into the middle ground'),
      incident('The far ground fell quiet while gunfire continued around the disputed center.', 'A rival squad left its position to reinforce the center just as a barrier blocked the hero’s approach.', 'The barrier broke open and revealed a route toward the area that would become the central sector.', 'mapped the expected sector boundary and prepared the squad to hold it at the end'),
      incident('Dust obscured the center while surviving squads advanced from opposite directions.', 'A collapsed railing blocked one team while the other moved toward the expected central sector.', 'The dust cleared and showed where the railing stopped short of the middle ground.', 'estimated the central sector’s limits and guided the squad around the railing'),
    ],
  },
  Cutthroat: {
    source: 'https://infinitygeist.com/mission/s18_cutthroat', season: 'ITS 18',
    anchor: /lieutenant|army point|casualt/i,
    ground: 'the lieutenant’s exposed flank', position: 'the opposing lieutenant’s guarded position',
    gunfighting: 'fired at the guard covering the enemy lieutenant and sheltered the friendly command route',
    closeCombat: 'drove a defender from the opposing lieutenant’s flank and protected the friendly officer',
    endings: {
      heroWins: '{{heroPlayer}}’s fighters prevailed after the clash between the rival lieutenants.',
      heroLoses: '{{otherPlayer}}’s fighters prevailed over {{heroPlayer}} after the clash between the rival lieutenants.',
      draw: 'The clash between the rival lieutenants ended level.',
    },
    incidents: [
      incident('An enemy lieutenant moved between two guards as fire swept across a narrow street.', 'A broken vehicle hid the officer while the friendly squad searched for a clear attack.', 'The officer stepped out to signal another patrol, briefly exposing the gap beneath the wreck.', 'identified the enemy lieutenant’s route and marked cover for the surviving squad'),
      incident('The friendly lieutenant sheltered behind a damaged wall while the enemy force pressed close.', 'A falling beam split the guard line and opened a dangerous lane toward the command position.', 'The beam struck the street and left one covered route for the officer to retreat.', 'checked the lieutenant’s escape lane and directed the guard to hold its opening'),
      incident('A rival lieutenant directed an assault from a roof above the remaining fighters.', 'The roof rail snapped under fire and hid the officer behind a bank of dust.', 'A voice from the far edge of the roof revealed where the command group had gathered.', 'located the enemy lieutenant’s roof position and marked the assault lane below it'),
      incident('Two lieutenants held opposite ends of a ruined block while their squads traded costly volleys.', 'A fresh flank attack threatened the friendly officer just as the rival guard lost its cover.', 'A shutter fell between the officers, creating a short route that either squad could contest.', 'compared the lieutenant positions and guided the squad away from the exposed flank'),
    ],
  },
  Superiority: {
    source: 'https://infinitygeist.com/mission/s18_superiority', season: 'ITS 18',
    anchor: /quadrant|console/i,
    ground: 'the contested quadrant', position: 'the central console',
    gunfighting: 'fired at the defender watching the console and covered the squad moving into the quadrant',
    closeCombat: 'drove a guard from the quadrant center and held the console approach',
    endings: {
      heroWins: '{{heroPlayer}}’s force prevailed after the contest for the quadrants and consoles.',
      heroLoses: '{{otherPlayer}}’s force prevailed over {{heroPlayer}} after the contest for the quadrants and consoles.',
      draw: 'The contest for the quadrants and consoles ended level.',
    },
    incidents: [
      incident('A console stood between two quadrants whose defenders had fallen back behind cover.', 'A broken panel hid the console input while rival fighters moved across the nearer sector boundary.', 'The panel swung clear just as a specialist reached the console from the far quadrant.', 'checked the console input and directed the squad to dominate the contested quadrant'),
      incident('A squad entered a quadrant near the center while its console showed a failed hacking attempt.', 'The console alarm revealed the specialist’s position before the squad could establish a secure perimeter.', 'A second input prompt appeared as the rival squad crossed the opposite quadrant line.', 'read the console prompt and guided fighters into the quadrant around the specialist'),
      incident('The far quadrant emptied when a console signal drew both patrols toward its boundary.', 'The nearest specialist found the console blocked by a fallen shutter under the opposing force’s fire.', 'The shutter lifted with the next burst and exposed a narrow space at the control face.', 'located the console access and marked the route to dominate the adjacent quadrant'),
      incident('A hacked console flashed from an open quadrant as a second squad arrived to challenge its hold.', 'An overturned crate hid the scoring line and left both commanders unsure where their fighters stood.', 'The crate shifted away, revealing the sector edge as the opposing specialist approached the console.', 'checked the quadrant boundary and confirmed the console status before calling reserves forward'),
    ],
  },
  'Uplink Center': {
    source: 'https://infinitygeist.com/mission/s18_uplink_center', season: 'ITS 18',
    anchor: /communication antenna|tech-coffin/i,
    ground: 'the contested line between the communication antennas', position: 'the contested Tech-Coffin',
    gunfighting: 'fired at the guard covering the communication antenna and sheltered the fighter approaching the Tech-Coffin',
    closeCombat: 'drove a defender from the communication antenna base and held the Tech-Coffin approach',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the fight over the communication antennas and Tech-Coffin.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the fight over the communication antennas and Tech-Coffin.',
      draw: 'The fight over the communication antennas and Tech-Coffin ended level.',
    },
    incidents: [
      incident('A communication antenna came alive beside the central Tech-Coffin as rival squads approached from opposite sides.', 'A fallen brace blocked the space needed to make sole contact with the coffin while an opposing specialist reached for the antenna.', 'The brace moved and exposed a narrow route to the coffin base.', 'checked the communication antenna status and guided a fighter into contact with the Tech-Coffin'),
      incident('A Tech-Coffin stood beneath an antenna awaiting its next activation.', 'A fallen shutter blocked the route to coffin contact while both squads converged on the aerial.', 'The shutter shifted and exposed a passage between the coffin and antenna base.', 'located a clear contact point at the Tech-Coffin and checked the communication antenna activation'),
      incident('Two communication antennas flashed beside a Tech-Coffin screened by a broken rail.', 'A rival specialist reached the farther antenna while the nearest squad sought contact with the coffin.', 'The rail moved under fire and briefly exposed the coffin base and active antenna panel.', 'inspected the Tech-Coffin approach and marked the communication antenna route'),
      incident('An antenna transmitted above the central Tech-Coffin as rival fighters closed on its base.', 'The specialist could not reach the antenna controls while an enemy model disputed contact with the coffin.', 'A guard shifted cover and briefly exposed separate routes to the antenna and coffin.', 'checked the communication antenna approach and guided a fighter toward sole Tech-Coffin contact'),
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
      heroWins: '{{heroPlayer}}’s crew prevailed after the contest around the antennas and zones of influence.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the contest around the antennas and zones of influence.',
      draw: 'The contest around the antennas and zones of influence ended level.',
    },
    incidents: [
      incident('An antenna stood at the edge of a zone of influence where both squads had taken cover.', 'A specialist approached the aerial while the rival force shifted enough bodies into the scoring zone.', 'A broken barrier opened a narrow path between the antenna base and the contested zone.', 'checked the antenna signal and marked the route across the zone of influence'),
      incident('Two antennas showed rival activations above a zone of influence full of moving fighters.', 'A fallen panel blocked one aerial’s controls just as the other force sent reserves into the zone.', 'The panel rocked aside and exposed a short path toward the active antenna.', 'read the antenna activation and directed a specialist through the zone of influence'),
      incident('A zone of influence emptied as both sides tried to reach the antenna beyond it.', 'A disabled carrier blocked the aerial base while a rival squad returned to the scored zone.', 'The carrier shifted and exposed the controls at the moment both squads crossed the boundary.', 'located the antenna controls and prepared to contest the zone of influence'),
      incident('The nearest antenna flashed above a zone of influence divided by broken cover.', 'A specialist reached the base while opposing troops held enough space to dispute the zone.', 'A gap opened in the cover and briefly connected the aerial approach with scoring ground.', 'checked the antenna status and mapped a route to hold the zone of influence'),
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
      heroWins: '{{heroPlayer}}’s crew prevailed after the fight to analyze the hyperthermal tech at the consoles.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the fight to analyze the hyperthermal tech at the consoles.',
      draw: 'The fight to analyze the hyperthermal tech at the consoles ended level.',
    },
    incidents: [
      incident('A hyperthermal tech unit emerged from the dig beside a console still covered in stone dust.', 'The console reader skipped during analysis while the rival crew approached the live tech.', 'A buried contact appeared beneath the dust, offering one chance to finish the analysis.', 'worked at the analysis console to prepare a WIP roll before any trooper reached a marked hyperthermal tech unit'),
      incident('A buried tech signal lit the dig before either crew reached its analysis console.', 'A broken cable divided the console from the hyperthermal tech as an enemy squad crossed the shaft.', 'A loose contact emerged from the dust and exposed where the analysis had stopped.', 'reached the analysis console controls and began a reading of the buried hyperthermal tech'),
      incident('Two hyperthermal tech units glowed beneath the dig while the nearest analysis console stayed dark.', 'Fallen stone hid the input face just as rival specialists reached the excavation rim.', 'The stones shifted to reveal an unfinished analysis prompt, with neither unit marked for a contact neutralization.', 'cleared the analysis console input and prepared to analyze a hyperthermal tech before approaching it in contact'),
      incident('A hyperthermal tech indicator glowed beneath the dig while both teams disputed the nearest console.', 'Loose rock covered the control face and obscured whether anyone had analyzed the live unit.', 'A stone shifted and revealed an unfinished analysis prompt beside an unmarked tech indicator.', 'checked the analysis console controls and prepared the WIP reading before a trooper approached the hyperthermal tech'),
    ],
  },
  'Data Harvest': {
    source: 'https://infinitygeist.com/mission/s18_data_harvest', season: 'ITS 18',
    anchor: /data-harvester|designated zone/i,
    ground: 'the enemy designated zone', position: 'the active data-harvester',
    gunfighting: 'fired at the guard covering the data-harvester and protected its route into the enemy zone',
    closeCombat: 'drove a defender from the designated zone and held space for the data-harvester carrier',
    endings: {
      heroWins: '{{heroPlayer}}’s crew prevailed after the contest for active data-harvesters in the designated zones.',
      heroLoses: '{{otherPlayer}}’s crew prevailed over {{heroPlayer}} after the contest for active data-harvesters in the designated zones.',
      draw: 'The contest for active data-harvesters in the designated zones ended level.',
    },
    incidents: [
      incident('A data-harvester reached the enemy designated zone after its carrier crossed a damaged bridge.', 'The harvester’s activity light flickered while a rival patrol approached from the far side.', 'A short signal returned when the carrier placed it behind cover inside the zone.', 'checked the data-harvester connection and marked a protected position in the designated zone'),
      incident('Two data-harvesters stood near opposite designated zones as rival fighters converged on one active device.', 'The active unit sat beyond a broken railing where a specialist could reach it only under fire.', 'The railing shifted and revealed a narrow path to the harvester inside the zone.', 'checked the active data-harvester’s position and guided a fighter into the designated zone'),
      incident('A data-harvester carrier reached the enemy half while defenders held the designated zone.', 'The rival squad guarded the zone boundary and denied a clear place to deposit the inactive harvester.', 'A gap opened beside their cover, exposing ground wholly inside the designated zone.', 'checked the designated zone and guided the carrier toward a place to deposit the data-harvester'),
      incident('An active data-harvester remained alone in a designated zone after both escorts withdrew.', 'A patrol closed on its exposed casing while the nearest friendly specialist searched for a return route.', 'Smoke shifted across the zone marker and left the unit briefly hidden from the approaching patrol.', 'located the data-harvester and mapped a route to keep it active in the designated zone'),
    ],
  },
}
