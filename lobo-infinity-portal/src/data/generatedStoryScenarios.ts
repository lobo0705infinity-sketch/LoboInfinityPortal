import type { CanonicalMission } from '../config/missions.ts'

export const MISSION_GEIST_SOURCE_SNAPSHOT = {
  inspectedOn: '2026-09-27', siteBuild: 'geist-v2-20260924190254',
} as const

type Incident = {
  opening: string
  complication: string
  turn: string
  objectiveAction: string
}

export type SourcedStoryScenario = {
  source: string
  season: 'ITS 18' | 'ITS 16' | 'Lobo League'
  requiresUnreportedSetup?: boolean
  anchor: RegExp
  ground: string
  position: string
  gunfighting: string
  closeCombat: string
  endings: { heroWins: string; heroLoses: string; draw: string }
  incidents: readonly [Incident, Incident, Incident, Incident]
}

function incident(opening: string, complication: string, turn: string, objectiveAction: string): Incident {
  return { opening, complication, turn, objectiveAction }
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
      heroWins: '{{heroPlayer}}’s squad brought the communication antenna online and held the courtyard until the enemy withdrew.',
      heroLoses: '{{otherPlayer}}’s squad took the controls and forced {{heroPlayer}} behind the broken wall.',
      draw: 'The signal died with both squads still fighting among the fallen masonry.',
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
      heroWins: '{{heroPlayer}}’s crew completed its classified objective before the round closed.',
      heroLoses: '{{otherPlayer}}’s crew denied {{heroPlayer}}’s classified objective and completed its own.',
      draw: 'Both crews withdrew with incomplete classified objectives and no clear advantage.',
    },
    incidents: [
      { opening: 'At the start of the round, both crews saw two new Common Classified cards as they approached the Akial Antenna.',
        complication: 'A specialist could see the public cards, but gunfire blocked the antenna needed to disrupt the rival plan.',
        turn: 'A gap in the firing lane briefly opened access to the antenna controls.',
        objectiveAction: 'checked the public Common Classified cards and prepared an interference request at the Akial Antenna' },
      { opening: 'A disputed Common Classified card drew both operators toward the Akial Antenna.',
        complication: 'The rival operator guarded the aerial as interference threatened a card that might already have been accomplished.',
        turn: 'Static broke over the antenna screen just as the guard shifted from its controls.',
        objectiveAction: 'reviewed the public Common Classified card and prepared to emit Akial interference' },
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
      heroWins: '{{heroPlayer}}’s crew relocated the tracking beacon into the enemy half and held its console when the round closed.',
      heroLoses: '{{otherPlayer}}’s crew relocated the tracking beacon into {{heroPlayer}}’s half and held its console at the round’s end.',
      draw: 'The tracking beacon remained near the center and neither crew secured a console as the round closed.',
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
      heroWins: '{{heroPlayer}}’s crew captured the enemy prototype and extracted its carrier.',
      heroLoses: '{{otherPlayer}}’s crew retained the prototype while {{heroPlayer}} left the panoply behind.',
      draw: 'Neither crew brought a captured prototype safely out of the bay.',
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
      heroWins: '{{heroPlayer}}’s crew carried the data pack clear of the server room.',
      heroLoses: '{{otherPlayer}}’s crew locked the console and held {{heroPlayer}} outside the server room.',
      draw: 'The data pack remained near the console while neither crew retained the server room.',
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
      heroWins: '{{heroPlayer}}’s crew dominated the dead zones and activated an antenna.',
      heroLoses: '{{otherPlayer}}’s crew held the dead zones as {{heroPlayer}} lost the antenna.',
      draw: 'The dead zones remained divided with neither crew holding the antenna advantage.',
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
      heroWins: '{{heroPlayer}}’s crew controlled the Quantum Core inside the Objective Room.',
      heroLoses: '{{otherPlayer}}’s crew held the Quantum Core as {{heroPlayer}} fell back from the room.',
      draw: 'The Quantum Core remained unclaimed while both crews contested the Objective Room.',
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
    anchor: /civilian|HVT|extract/i,
    ground: 'the civilian extraction route', position: 'the waiting civilian group',
    gunfighting: 'fired at the weapon threatening the civilian route and covered the next person moving to safety',
    closeCombat: 'forced a defender from the civilian route and kept the extraction line clear',
    endings: {
      heroWins: '{{heroPlayer}}’s crew extracted its civilians safely across the line.',
      heroLoses: '{{otherPlayer}}’s crew extracted the civilians while {{heroPlayer}}’s escorts fell back.',
      draw: 'Both escorts withdrew with civilians still short of the extraction route.',
    },
    incidents: [
      incident('A civilian group waited by the extraction marker when a fallen barrier divided the lane.', 'The barrier began to slide under incoming fire, closing the gap between the civilians and their escort.', 'A person on the far side signaled a second opening before rival troops reached the marker.', 'checked the civilian extraction route and guided the waiting group toward the opening'),
      incident('Civilians took shelter beside a narrow evacuation path while patrols traded fire across it.', 'A damaged handrail blocked the nearest passage and forced the escort to turn into open ground.', 'The rail dropped away to expose a sheltered route that the other team had not yet covered.', 'found a path for the civilians through the extraction lane and called the escort forward'),
      incident('The enemy HVT waited near an extraction point as both escorts reached the same crossing.', 'A smoke cloud hid the HVT while an opposing patrol tried to cut the route to safety.', 'The smoke lifted and revealed a short protected approach for the nearest specialist.', 'located the enemy HVT and prepared the extraction route before the rival escort closed'),
      incident('A civilian reached the last covered station before the extraction line as shooting resumed.', 'An overturned cart split the escort and left the civilian exposed to the next volley.', 'The cart rolled aside and offered one clear crossing before the opposing squad could advance.', 'guided the civilian across the extraction marker while the escort held the passage'),
    ],
  },
  Hardlock: {
    source: 'https://infinitygeist.com/mission/s18_hard_lock', season: 'ITS 18',
    anchor: /beacon|console/i,
    ground: 'the enemy beacon position', position: 'the activated-console line',
    gunfighting: 'fired at the defender watching the enemy beacon and covered the console specialist',
    closeCombat: 'drove a guard from the enemy beacon and held its position for the advancing specialist',
    endings: {
      heroWins: '{{heroPlayer}}’s crew controlled the enemy beacon and kept its activated consoles.',
      heroLoses: '{{otherPlayer}}’s crew reclaimed the beacon and denied {{heroPlayer}} the console line.',
      draw: 'Both crews contested the beacon while the consoles showed rival activations.',
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
    anchor: /launching tower|extract/i,
    ground: 'the launching tower approach', position: 'the extraction line',
    gunfighting: 'fired at the guard overlooking the launching tower and covered the specialist withdrawing',
    closeCombat: 'drove a defender from the launching tower exit and held the route for the specialists',
    endings: {
      heroWins: '{{heroPlayer}}’s crew extracted its specialists and held the launching tower.',
      heroLoses: '{{otherPlayer}}’s crew secured the launching tower as {{heroPlayer}} lost the extraction route.',
      draw: 'Both forces withdrew from the launching tower with specialists stranded on the approach.',
    },
    incidents: [
      incident('The launching tower shook under distant engines while two specialists waited beside its extraction marker.', 'A fallen stair rail kept one specialist on the exposed platform as the opposing crew climbed toward it.', 'The rail pulled loose, creating a path down just as a withdrawal signal began repeating.', 'checked the launching tower exit and guided the trapped specialist toward extraction'),
      incident('A launching tower beacon blinked through the smoke as the last specialists left cover.', 'A rival patrol reached the lower stair and cut off the quickest extraction route.', 'A damaged ladder swung free, exposing another path around the patrol toward the marker.', 'mapped the launching tower ladder and signaled the specialist along the extraction line'),
      incident('The launching tower lights went out as the final extraction group crossed beneath its gantry.', 'A guard held the walkway while the group searched for the marker beyond the dark stairwell.', 'An emergency lamp lit the far landing and showed the nearest safe route for the specialists.', 'found the extraction marker and guided the specialists past the launching tower'),
      incident('A wounded specialist sheltered below the launching tower with the withdrawal call already sounding.', 'The route down from the tower passed a broken handrail under a rival squad’s firing lane.', 'A smoke trail hid the landing briefly enough to bring the specialist to the rail.', 'checked the specialist’s route and prepared a covered move to the extraction line'),
    ],
  },
  Neutralization: {
    source: 'https://infinitygeist.com/mission/s18_neutralization', season: 'ITS 18',
    anchor: /hyperthermal tech|neutralizing antenna/i,
    ground: 'the hyperthermal tech site', position: 'the neutralizing antenna',
    gunfighting: 'fired at the guard beside the hyperthermal tech and covered the specialist approaching its controls',
    closeCombat: 'drove a defender from the hyperthermal tech and guarded the technician beside the antenna',
    endings: {
      heroWins: '{{heroPlayer}}’s crew neutralized the hyperthermal tech and held the antenna.',
      heroLoses: '{{otherPlayer}}’s crew held the neutralizing antenna as {{heroPlayer}} withdrew from the tech.',
      draw: 'Both crews left the hyperthermal tech active while disputing the antenna.',
    },
    incidents: [
      incident('A hyperthermal tech unit flickered beside a neutralizing antenna whose signal had begun to fade.', 'A loose connector crossed the tech housing and forced the specialist to work beneath an exposed firing lane.', 'The antenna recovered briefly as rival troops closed around the still-active tech.', 'checked the hyperthermal tech feed and prepared to neutralize it through the antenna'),
      incident('The nearest neutralizing antenna fell behind a barricade with two hyperthermal tech units in view.', 'A rival patrol activated the far aerial while the specialist searching for the first found its cable severed.', 'The broken cable sparked, revealing a repair point beside the tech unit closest to the road.', 'found the neutralizing antenna repair point and marked the hyperthermal tech for isolation'),
      incident('A hyperthermal tech unit began venting heat as both crews reached its neutralizing antenna.', 'The vent drove the first specialist backward and briefly masked the rival trooper approaching the antenna.', 'A pause in the heat exposed the control socket before another venting cycle started.', 'inspected the hyperthermal tech socket and prepared the neutralizing antenna command'),
      incident('An active hyperthermal tech indicator remained lit after a neutralizing antenna registered a failed attempt.', 'A scorched lead prevented the specialist from repeating the command while an opposing squad crossed the site.', 'A spare lead appeared beneath the control tray as the tech warning reached its highest pitch.', 'replaced the neutralizing antenna lead and checked the hyperthermal tech status'),
    ],
  },
  Outbreak: {
    source: 'https://infinitygeist.com/mission/s18_outbreak', season: 'ITS 18',
    anchor: /infected|alpha infected/i,
    ground: 'the infected containment lane', position: 'the Alpha Infected position',
    gunfighting: 'fired at the guard threatening the medics and covered a scan of the Infected',
    closeCombat: 'drove a defender away from the Infected and held the path open for a medic',
    endings: {
      heroWins: '{{heroPlayer}}’s crew scanned and stabilized the Infected before securing the escort.',
      heroLoses: '{{otherPlayer}}’s crew secured the stabilized Infected while {{heroPlayer}} withdrew.',
      draw: 'Both crews completed scans, but the Infected remained beyond either escort’s control.',
    },
    incidents: [
      incident('An Infected patient moved behind a broken screen as both crews arrived with scanners.', 'A fallen stretcher blocked the safe approach, and a medic needed a clear scan before stabilizing the patient.', 'The screen slipped aside, showing the patient still close enough for the waiting medic to reach.', 'checked the Infected patient’s scan and prepared a stabilization route past the stretcher'),
      incident('The Alpha Infected stood in a dim corridor beyond a toppled examination cart.', 'The cart hid the Alpha’s position whenever the scanning light passed across the doorway.', 'A handprint appeared against the glass as an opposing escort moved toward the corridor.', 'located the Alpha Infected and checked the scanner before directing a medic forward'),
      incident('Two Infected patients waited beside a narrow extraction lane as a stabilizer alarm sounded.', 'The alarm drowned the medic’s instructions while a rival escort tried to take the nearest patient.', 'The alarm paused, leaving a moment to scan the farther patient before the lane closed.', 'scanned the Infected and identified which patient could move first'),
      incident('The Alpha Infected reached the edge of the containment area while its escort stopped under fire.', 'A damaged scanner left the nearest medic unable to confirm stabilization before crossing the open lane.', 'The screen cleared long enough for the medic to read the patient’s condition from cover.', 'checked the Alpha Infected scan and marked a protected route for stabilization and escort'),
    ],
  },
  'Panic Room': {
    source: 'https://infinitygeist.com/mission/s16_panic_room', season: 'ITS 16',
    anchor: /panic room|essential personnel/i,
    ground: 'the contested Panic Room', position: 'its open central gate',
    gunfighting: 'fired at the guard covering the Panic Room gate and sheltered Essential Personnel moving inside',
    closeCombat: 'forced a defender from the Panic Room entrance and held it for Essential Personnel',
    endings: {
      heroWins: '{{heroPlayer}}’s crew dominated the Panic Room with Essential Personnel inside.',
      heroLoses: '{{otherPlayer}}’s crew held the Panic Room as {{heroPlayer}}’s personnel withdrew.',
      draw: 'Neither force held the Panic Room long enough to secure Essential Personnel.',
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
      heroWins: '{{heroPlayer}}’s crew controlled the supply box inside its safe area.',
      heroLoses: '{{otherPlayer}}’s crew secured a supply box as {{heroPlayer}}’s carrier withdrew.',
      draw: 'Both crews left their supply boxes exposed outside their safe areas.',
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
      heroWins: '{{heroPlayer}}’s force preserved its survivors and broke the opposing line.',
      heroLoses: '{{otherPlayer}}’s force inflicted heavier losses and preserved its survivors while {{heroPlayer}} fell back.',
      draw: 'Both forces withdrew with costly casualties and their surviving squads intact.',
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
    ground: 'the central scoring sector', position: 'the far sector boundary',
    gunfighting: 'fired at the guard holding the central sector and covered a squad moving inside it',
    closeCombat: 'drove a defender from the central sector and held the boundary for the squad',
    endings: {
      heroWins: '{{heroPlayer}}’s force dominated the central sector at the end of the fight.',
      heroLoses: '{{otherPlayer}}’s force held the central sector while {{heroPlayer}} withdrew.',
      draw: 'Both forces held separate sectors while the central ground stayed contested.',
    },
    incidents: [
      incident('The central sector stood empty after a support beam fell across its closest entrance.', 'A rival patrol reached the far sector first and threatened to occupy the open center from behind.', 'The beam moved under fire and revealed a narrow approach to the sector marker.', 'checked the central sector approach and signaled where the squad could dominate it'),
      incident('A sector marker flickered beneath debris where both patrols expected to claim the middle ground.', 'A fallen wall concealed the shortest route into the central sector as the rival force occupied its edge.', 'The wall shifted and exposed a passage wide enough for one fighter to cross.', 'located the central sector marker and directed the squad into scored ground'),
      incident('The far sector fell quiet while gunfire continued around the disputed central zone.', 'A rival squad left its sector to reinforce the center just as a barrier blocked the hero’s approach.', 'The barrier broke open and left a narrow view across the scoring boundary.', 'mapped the center sector boundary and prepared the squad to dominate it'),
      incident('Dust hid the central sector line while surviving squads advanced from opposite directions.', 'A collapsed railing blocked one team while the other began to occupy the sector.', 'The dust cleared and showed where the railing stopped short of the scored ground.', 'checked the central sector line and guided the squad around the railing'),
    ],
  },
  Cutthroat: {
    source: 'https://infinitygeist.com/mission/s18_cutthroat', season: 'ITS 18',
    anchor: /lieutenant|army point|casualt/i,
    ground: 'the lieutenant’s exposed flank', position: 'the opposing lieutenant’s guarded position',
    gunfighting: 'fired at the guard covering the enemy lieutenant and sheltered the friendly command route',
    closeCombat: 'drove a defender from the opposing lieutenant’s flank and protected the friendly officer',
    endings: {
      heroWins: '{{heroPlayer}}’s fighters protected their lieutenant and broke the opposing force.',
      heroLoses: '{{otherPlayer}}’s fighters kept their lieutenant safe as {{heroPlayer}} fell back.',
      draw: 'Both lieutenants survived while the battered forces withdrew from the field.',
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
      heroWins: '{{heroPlayer}}’s force dominated the quadrant and hacked the console.',
      heroLoses: '{{otherPlayer}}’s force held the quadrant as {{heroPlayer}} lost the console.',
      draw: 'Both forces held a quadrant, with the console still contested.',
    },
    incidents: [
      incident('A console stood between two quadrants whose defenders had fallen back behind cover.', 'A broken panel hid the console input while rival fighters moved across the nearer sector boundary.', 'The panel swung clear just as a specialist reached the console from the far quadrant.', 'checked the console input and directed the squad to dominate the contested quadrant'),
      incident('A squad entered the central quadrant while the console there showed a failed hacking attempt.', 'The console alarm revealed the specialist’s position before the squad could establish a secure perimeter.', 'A second input prompt appeared as the rival squad crossed the opposite quadrant line.', 'read the console prompt and guided fighters into the quadrant around the specialist'),
      incident('The far quadrant emptied when a console signal drew both patrols toward its boundary.', 'The nearest specialist found the console blocked by a fallen shutter under the opposing force’s fire.', 'The shutter lifted with the next burst and exposed a narrow space at the control face.', 'located the console access and marked the route to dominate the adjacent quadrant'),
      incident('A hacked console flashed from an open quadrant as a second squad arrived to challenge its hold.', 'An overturned crate hid the scoring line and left both commanders unsure where their fighters stood.', 'The crate shifted away, revealing the sector edge as the opposing specialist approached the console.', 'checked the quadrant boundary and confirmed the console status before calling reserves forward'),
    ],
  },
  'Uplink Center': {
    source: 'https://infinitygeist.com/mission/s18_uplink_center', season: 'ITS 18',
    anchor: /communication antenna|tech-coffin/i,
    ground: 'the communication-antenna line', position: 'the contested Tech-Coffin',
    gunfighting: 'fired at the guard covering the communication antenna and sheltered the Tech-Coffin specialist',
    closeCombat: 'drove a defender from the communication antenna base and held the Tech-Coffin approach',
    endings: {
      heroWins: '{{heroPlayer}}’s crew activated the communication antenna and held the Tech-Coffin.',
      heroLoses: '{{otherPlayer}}’s crew controlled the antenna and denied {{heroPlayer}} the Tech-Coffin.',
      draw: 'Both crews disputed the communication antenna and left the Tech-Coffin unclaimed.',
    },
    incidents: [
      incident('A communication antenna came alive beside a Tech-Coffin whose lid stood open by a handspan.', 'A bent hinge hid the coffin contents while the rival specialist approached the antenna controls.', 'The lid moved again, revealing a narrow space that either crew could reach from cover.', 'checked the communication antenna status and directed a specialist toward the Tech-Coffin'),
      incident('A Tech-Coffin alarm sounded beneath an antenna awaiting its next activation.', 'A fallen shutter concealed the coffin latch while both squads converged on the aerial.', 'The shutter shifted and exposed a path between the coffin and the antenna base.', 'located the Tech-Coffin latch and checked the communication antenna activation'),
      incident('Two communication antennas flashed beside a Tech-Coffin locked under a broken rail.', 'A rival specialist reached the farther antenna while the nearest crew searched for a way beneath the rail.', 'The rail moved under fire and briefly exposed the coffin and the active control panel.', 'inspected the Tech-Coffin beneath the rail and marked the communication antenna approach'),
      incident('An antenna transmitted above a Tech-Coffin whose status light had failed in the first exchange.', 'The specialist could not see whether the coffin was claimed as rival fighters approached its lid.', 'A backup lamp flickered to life and revealed the coffin latch beside the aerial.', 'read the Tech-Coffin status and guided the squad toward the communication antenna'),
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
      heroWins: '{{heroPlayer}}’s crew secured its chosen antenna or zone objective.',
      heroLoses: '{{otherPlayer}}’s crew secured its chosen antenna or zone objective as {{heroPlayer}} fell back.',
      draw: 'Neither crew secured its antenna or zone objective before the contest ended.',
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
      heroWins: '{{heroPlayer}}’s crew analyzed and neutralized the hyperthermal tech.',
      heroLoses: '{{otherPlayer}}’s crew analyzed and neutralized the tech as {{heroPlayer}} withdrew.',
      draw: 'Both crews withdrew with the hyperthermal tech still active and its analysis unresolved.',
    },
    incidents: [
      incident('A hyperthermal tech unit emerged from the dig beside a console still covered in stone dust.', 'The console reader skipped during analysis while the rival crew approached the live tech.', 'A buried contact appeared beneath the dust, offering one chance to finish the scan.', 'worked at the analysis console to record the hyperthermal tech reading before any neutralizing command'),
      incident('A buried tech signal lit the dig before either crew reached its analysis console.', 'A broken cable divided the console from the hyperthermal tech as an enemy squad crossed the shaft.', 'A loose contact emerged from the dust and exposed where the analysis had stopped.', 'reached the analysis console controls and began a reading of the buried hyperthermal tech'),
      incident('Two hyperthermal tech units glowed beneath the dig while the nearest analysis console stayed dark.', 'Fallen stone hid the input face just as rival specialists reached the excavation rim.', 'The stones shifted to reveal an unfinished scan beside the neutralizing command.', 'cleared the analysis console input and began analyzing the hyperthermal tech before neutralization'),
      incident('A hyperthermal tech indicator glowed beneath the dig while both teams disputed the nearest console.', 'Loose rock covered the control face and obscured whether anyone had analyzed the live unit.', 'A stone shifted and revealed an unfinished analysis prompt beside the neutralizing command.', 'checked the analysis console controls and began the hyperthermal tech reading before neutralization'),
    ],
  },
  'Data Harvest': {
    source: 'https://infinitygeist.com/mission/s18_data_harvest', season: 'ITS 18',
    anchor: /data-harvester|designated zone/i,
    ground: 'the enemy designated zone', position: 'the active data-harvester',
    gunfighting: 'fired at the guard covering the data-harvester and protected its route into the enemy zone',
    closeCombat: 'drove a defender from the designated zone and held space for the data-harvester carrier',
    endings: {
      heroWins: '{{heroPlayer}}’s crew kept its data-harvester active in the enemy designated zone.',
      heroLoses: '{{otherPlayer}}’s crew deactivated the data-harvester and held {{heroPlayer}} outside its designated zone.',
      draw: 'Both crews left a harvester near the boundary, with neither controlling the designated zone.',
    },
    incidents: [
      incident('A data-harvester reached the enemy designated zone after its carrier crossed a damaged bridge.', 'The harvester’s activity light flickered while a rival patrol approached from the far side.', 'A short signal returned when the carrier placed it behind cover inside the zone.', 'checked the data-harvester connection and marked a protected position in the designated zone'),
      incident('Two data-harvesters stood near opposite designated zones with one control light fading.', 'The dim unit sat beyond a broken railing where a specialist could reach it only under fire.', 'The railing shifted and revealed a narrow maintenance path to the active device.', 'inspected the data-harvester light and guided a specialist into the enemy designated zone'),
      incident('A data-harvester carried into the enemy half stopped transmitting at the designated zone boundary.', 'A damaged power cell caught beneath its casing as the rival squad moved to deny the zone.', 'A replacement cell slid out of the carrier’s kit just as the defenders reached the device.', 'replaced the data-harvester power cell and checked its position inside the designated zone'),
      incident('An active data-harvester remained alone in a designated zone after both escorts withdrew.', 'A patrol closed on its exposed casing while the nearest friendly specialist searched for a return route.', 'Smoke shifted across the zone marker and left the unit briefly hidden from the approaching patrol.', 'located the data-harvester and mapped a route to keep it active in the designated zone'),
    ],
  },
}
