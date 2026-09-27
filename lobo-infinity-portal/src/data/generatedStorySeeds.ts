import type { CanonicalMission } from '../config/missions.ts'

export type MissionStorySeed = {
  opening: string
  complication: string
  turn: string
  objectiveAction: string
  prize: string
}

// These are fictional situations, not reconstructions of unreported turns or
// claims about exact scoring rules. Each line in a seed belongs to the same
// incident so that the three paragraphs form a causal scene.
export const MISSION_STORY_SEEDS: Record<CanonicalMission, readonly [MissionStorySeed, MissionStorySeed]> = {
  'Area of Interest': [
    {
      opening: 'A survey marker vanished under fresh rubble just as the two patrols reached the disputed boundary.',
      complication: 'A second marker began flashing from the wrong side of the broken street, drawing fire toward a narrow crossing.',
      turn: 'The boundary lamps flickered out together, leaving both patrols to judge the ground by the positions they could still hold.',
      objectiveAction: 'found the buried survey plate, cleared its damaged reader, and transmitted a fresh position before the dust settled',
      prize: 'the surveyed ground',
    },
    {
      opening: 'The map gave both commanders the same patch of ground, but an old perimeter wall divided it in two.',
      complication: 'A loose gate swung across the marked route, exposing anyone who tried to secure the far survey post.',
      turn: 'The gate stopped halfway open, turning a disputed line on the map into a passage neither side could ignore.',
      objectiveAction: 'reached the survey post, checked its damaged coordinates, and marked the safe side of the line',
      prize: 'the perimeter',
    },
  ],
  'Akial Interference': [
    {
      opening: 'A relay began repeating yesterday’s orders as the Akial signal rolled across the listening station.',
      complication: 'Each burst of static shifted the alignment of the receiver and made the cleared approach look occupied again.',
      turn: 'The final pulse drowned every voice except the signal escaping from the station’s damaged aerial.',
      objectiveAction: 'isolated the corrupted relay, matched the returning pulse to its source, and sent the clean frequency down the line',
      prize: 'the clean transmission',
    },
    {
      opening: 'A maintenance crew found the Akial carrier already running through an antenna that should have been dark.',
      complication: 'The interference climbed into the local comms, turning a whispered warning into noise across the whole site.',
      turn: 'One clear beat remained between pulses, long enough for a message but not for an argument over who should send it.',
      objectiveAction: 'traced the unwanted carrier, tuned the receiver between pulses, and copied the missing segment',
      prize: 'the surviving signal',
    },
  ],
  'B-Pong': [
    {
      opening: 'The ball struck a broken advertising panel and returned to the court at a sharper angle than either side expected.',
      complication: 'A stray burst of fire split the floor beside the rebound, changing the ball’s path through the contested lane.',
      turn: 'The next bounce carried it toward open court, where a single step could change who reached it first.',
      objectiveAction: 'tracked the rebound, intercepted the moving ball, and drove it into the newly open lane',
      prize: 'the moving ball',
    },
    {
      opening: 'A court light failed during the opening exchange, leaving the far edge of the B-Pong field in shadow.',
      complication: 'The ball clipped the darkened barrier and skidded across a lane that both sides had treated as safe.',
      turn: 'A second light snapped on, showing the ball rolling slowly toward a gap between the two positions.',
      objectiveAction: 'found the ball against the barrier, controlled its awkward bounce, and redirected it toward open space',
      prize: 'the open court',
    },
  ],
  'Corporate Appropriation': [
    {
      opening: 'Two ownership seals appeared on the same cargo vault before either retrieval team could open it.',
      complication: 'The vault began locking its hinges in sequence while an inventory tag blinked beneath the contested seal.',
      turn: 'The last hinge settled with a heavy knock, leaving one narrow opening and a disputed manifest inside.',
      objectiveAction: 'checked the conflicting seals, opened the inventory reader, and copied the asset record before the lock closed',
      prize: 'the disputed asset',
    },
    {
      opening: 'An abandoned loading bay held a single crate bearing contract numbers from two rival claims.',
      complication: 'A transport belt lurched to life and carried the crate toward a gate neither crew controlled.',
      turn: 'The belt jammed at the gate, turning the contract dispute into a fight over a piece of cargo within reach.',
      objectiveAction: 'caught the crate at the stalled belt, verified its ownership tag, and secured the retrieval code',
      prize: 'the cargo claim',
    },
  ],
  'Critical Intervention': [
    {
      opening: 'An emergency field generator failed beside a shelter whose patients could not be moved through the exposed courtyard.',
      complication: 'The backup power light blinked twice and died while the only sheltered route filled with return fire.',
      turn: 'A monitor sounded from inside the shelter, making the next safe passage more urgent than another exchange of shots.',
      objectiveAction: 'reached the failing generator, isolated a burned connection, and restored power to the shelter',
      prize: 'the shelter',
    },
    {
      opening: 'An emergency beacon called both forces toward the same triage station on the edge of the fight.',
      complication: 'A loose support dropped across the station door, blocking the medical crew with supplies still inside.',
      turn: 'The beacon changed pitch as the station doors finally shifted, and every fighter nearby turned toward the opening.',
      objectiveAction: 'cleared the triage station’s blocked access panel and signaled the waiting crew to move',
      prize: 'the emergency station',
    },
  ],
  'Crossing Lines': [
    {
      opening: 'A border checkpoint lost its warning lights while two columns approached from opposite ends of the road.',
      complication: 'A barricade dropped across the central lane, leaving a service path visible beneath its bent frame.',
      turn: 'The checkpoint alarm came back in fragments, warning of movement on both sides of the crossing.',
      objectiveAction: 'opened the service path, checked the checkpoint signal, and marked a route through the obstruction',
      prize: 'the crossing',
    },
    {
      opening: 'A narrow bridge carried two incompatible route markers, each pointing a different force toward the far bank.',
      complication: 'A blast loosened one railing, and the safest passage became a strip of metal above the river.',
      turn: 'The bridge shifted again beneath the weight of the retreating fighters, leaving the marked route unresolved.',
      objectiveAction: 'found the far marker, corrected its route code, and signaled the safe edge of the bridge',
      prize: 'the far bank',
    },
  ],
  "Dead Man's Switch": [
    {
      opening: 'A silent transmitter beside the switch began counting down only when the first boots crossed its wire.',
      complication: 'The device repeated a false all-clear while the exposed contacts beneath it continued to warm.',
      turn: 'The timer paused for a breath, and the fighters around it could not tell whether it had stopped or merely lost its display.',
      objectiveAction: 'opened the switch housing, traced the live contact, and broke the false countdown signal',
      prize: 'the failsafe',
    },
    {
      opening: 'A remote switch lay on a table of loose wires, guarded by a light that flashed without a steady rhythm.',
      complication: 'An unseen transmitter answered each flash from across the room and armed a second contact under the table.',
      turn: 'The two lights blinked together, then apart, giving the teams one uncertain moment to act.',
      objectiveAction: 'identified the paired contacts, isolated the remote trigger, and sent an all-clear to the waiting team',
      prize: 'the switch',
    },
  ],
  Evacuation: [
    {
      opening: 'The evacuation route led through a bus station where the last departure board still showed an empty platform.',
      complication: 'A damaged shutter began closing across the loading lane while the waiting group was still beyond it.',
      turn: 'The board changed to a final departure as the shutter halted just above the ground.',
      objectiveAction: 'released the shutter lock, opened the loading route, and signaled the waiting group through',
      prize: 'the evacuation route',
    },
    {
      opening: 'A crowded shelter sent out a short request for extraction as dust filled its only marked corridor.',
      complication: 'An air vent collapsed across the corridor, hiding the emergency arrows beneath broken metal.',
      turn: 'A flashlight appeared behind the wreckage, proving that someone inside was still following the route.',
      objectiveAction: 'cleared the emergency marker, checked the shelter door, and guided the evacuees toward open air',
      prize: 'the shelter exit',
    },
  ],
  Hardlock: [
    {
      opening: 'A blast door locked halfway through its cycle, splitting a control room from the people who needed its terminal.',
      complication: 'A second lock engaged behind the fighters while sparks fell from the exposed control panel.',
      turn: 'The door moved a handspan and stopped, leaving the terminal visible through a gap no one could safely cross.',
      objectiveAction: 'reached the control panel, reset the damaged lock, and opened a path to the terminal',
      prize: 'the locked terminal',
    },
    {
      opening: 'A sealed corridor showed two green access lights even though its gate refused every command.',
      complication: 'The lights turned red one after another as the corridor’s emergency mechanism began to engage.',
      turn: 'A final access tone sounded beyond the gate, offering one chance to reach the controls before the seal held.',
      objectiveAction: 'examined the false access lights, cut the failing circuit, and restored control of the gate',
      prize: 'the sealed corridor',
    },
  ],
  'Last Launch': [
    {
      opening: 'A launch gantry shook as the countdown resumed without warning, though half its service crew was still below.',
      complication: 'A fuel-line indicator turned amber, and the stairway to its control valve came under fire.',
      turn: 'The engines began to warm beneath the platform while the damaged indicator refused to clear.',
      objectiveAction: 'reached the gantry controls, checked the fuel warning, and sent a corrected launch signal',
      prize: 'the launch sequence',
    },
    {
      opening: 'A shuttle waited on a rain-slick pad with its boarding ramp open and its ignition sequence stalled.',
      complication: 'An access cable tore free of its housing, dropping across the ramp where both forces converged.',
      turn: 'The pad lights changed from red to white as the engines finally answered the control tower.',
      objectiveAction: 'secured the loose access cable, restored the pad connection, and confirmed the shuttle’s departure window',
      prize: 'the shuttle',
    },
  ],
  Neutralization: [
    {
      opening: 'A damaged weapons cradle remained powered inside a workshop that both forces had been ordered to secure.',
      complication: 'Its warning lamp came alive when a loose cable dragged across the floor under fire.',
      turn: 'The lamp stayed lit after the gunfire stopped, leaving the cradle dangerous even to whoever held the room.',
      objectiveAction: 'found the live cradle circuit, cut its power, and marked the weapon safe for the team behind',
      prize: 'the disabled weapon',
    },
    {
      opening: 'A concealed transmitter in a storage room kept guiding fire toward an occupied street outside.',
      complication: 'The transmitter switched frequency when its first antenna was struck, forcing a search behind the shelves.',
      turn: 'Its final beacon shifted to an open channel that every fighter in the room could hear.',
      objectiveAction: 'located the hidden transmitter, isolated its new frequency, and disabled the targeting link',
      prize: 'the neutralized transmitter',
    },
  ],
  Outbreak: [
    {
      opening: 'A quarantine door opened a few centimeters after the warning light inside the laboratory went dark.',
      complication: 'The air system reversed, pulling loose sample labels across the floor toward the open seal.',
      turn: 'The door held at its broken hinge while the lab’s warning light returned in a sickly pulse.',
      objectiveAction: 'sealed the quarantine vent, secured the loose samples, and restored the laboratory warning signal',
      prize: 'the quarantine line',
    },
    {
      opening: 'An abandoned clinic reported a fresh outbreak through a radio message that ended before naming the source.',
      complication: 'A supply cabinet fell against the isolation hatch, pinning its handle just as the air alarms sounded.',
      turn: 'The clinic speakers repeated the unfinished warning, and the isolation door began to slide closed.',
      objectiveAction: 'opened the isolation hatch, read the surviving sample log, and transmitted its warning outside',
      prize: 'the outbreak record',
    },
  ],
  'Panic Room': [
    {
      opening: 'A reinforced shelter door stood open by a handspan, though its occupants had stopped answering the intercom.',
      complication: 'The panic room’s emergency lock engaged while a weak signal continued to come from behind the door.',
      turn: 'The intercom crackled once more as the lock strained against a bent section of its frame.',
      objectiveAction: 'checked the shelter intercom, bypassed the damaged lock, and reached the people behind the door',
      prize: 'the panic room',
    },
    {
      opening: 'A bunker monitor showed movement inside a supposedly empty safe room below the contested building.',
      complication: 'A pipe burst above the control desk, spilling water onto the only access keypad.',
      turn: 'The monitor lost its picture just as the safe room’s inner door began to open.',
      objectiveAction: 'isolated the flooded keypad, opened the safe-room access, and confirmed who was still inside',
      prize: 'the safe room',
    },
  ],
  Provisioning: [
    {
      opening: 'A supply convoy had left its crates in an empty depot, with fresh wheel marks leading away from the loading gate.',
      complication: 'The depot lift jammed beneath the remaining supplies while both forces tried to reach its controls.',
      turn: 'The lift shuddered back to life, carrying the last crates toward an open bay neither side could hold alone.',
      objectiveAction: 'checked the depot manifest, freed the jammed lift, and marked the supplies ready to move',
      prize: 'the supply crates',
    },
    {
      opening: 'An emergency ration store had power for one door and no lights along the corridor leading to it.',
      complication: 'A crate split across the corridor, exposing its contents while the store’s lock cycled shut.',
      turn: 'The store’s last light came on behind the fighters, showing exactly how little could still be carried.',
      objectiveAction: 'opened the ration store, checked the damaged inventory, and secured a route for the supplies',
      prize: 'the remaining provisions',
    },
  ],
  Annihilation: [
    {
      opening: 'A rooftop position collapsed under sustained fire, scattering the surviving fighters into rooms already marked for the fight.',
      complication: 'The fallen antenna crossed a stairwell and turned a clear firing lane into a dangerous choke point.',
      turn: 'A final burst struck the antenna, and both sides had to choose whether to press the attack or pull clear.',
      objectiveAction: 'mapped the trapped stairwell, secured a path for the pinned fighters, and marked the enemy position',
      prize: 'the surviving position',
    },
    {
      opening: 'The first firefight left a transport burning beside the only intact passage through the block.',
      complication: 'Smoke filled the passage while a second attack found the fighters trying to recover their wounded.',
      turn: 'The transport fire finally burned low, exposing the attackers on the far side of the road.',
      objectiveAction: 'reached the stranded squad, identified the safe passage, and guided the wounded into cover',
      prize: 'the broken front',
    },
  ],
  Battleground: [
    {
      opening: 'A shallow trench ran between two observation posts, neither of which could see the bend at its center.',
      complication: 'A support beam fell into the trench, leaving the central turn exposed to fire from above.',
      turn: 'The dust cleared around the fallen beam, revealing a narrow path into the contested post.',
      objectiveAction: 'reached the observation post, restored its field reader, and marked the trench approach',
      prize: 'the forward post',
    },
    {
      opening: 'A ruined barricade divided the battlefield into two lanes that met at a silent command shelter.',
      complication: 'The shelter’s roof shifted under fire, forcing the fighters at its entrance into the open lane.',
      turn: 'A command light came on inside the shelter even as the damaged roof settled again.',
      objectiveAction: 'opened the command shelter, checked its surviving map, and signaled the defended lane',
      prize: 'the command shelter',
    },
  ],
  Cutthroat: [
    {
      opening: 'An informant’s suspected ambush site held two identical briefcases and no sign of the person who had called the exchange.',
      complication: 'A hidden shooter fired at the empty chair, exposing a second team waiting above the meeting room.',
      turn: 'One case opened on the floor, and the papers inside bore a different set of names than either side expected.',
      objectiveAction: 'checked the switched briefcases, identified the real file, and carried its warning out of the room',
      prize: 'the disputed file',
    },
    {
      opening: 'A marked payment waited in an alley where the promised contact had left only a broken radio.',
      complication: 'The radio played a forged instruction as the alley’s far exit closed behind the approaching fighters.',
      turn: 'The forged voice returned on a second channel, revealing how carefully the ambush had been arranged.',
      objectiveAction: 'traced the forged transmission, recovered the marked payment, and signaled a way out of the trap',
      prize: 'the contested payment',
    },
  ],
  Superiority: [
    {
      opening: 'A control tower overlooked three approaches, but its upper windows had been covered before either force arrived.',
      complication: 'An observation shutter broke loose and fell across the stairs to the best position.',
      turn: 'The shutter stopped moving with the upper floor still visible and the route to it under fire.',
      objectiveAction: 'reached the tower console, restored its field display, and marked the open approach',
      prize: 'the tower position',
    },
    {
      opening: 'A row of sector markers drew both forces toward a square whose center offered almost no cover.',
      complication: 'One marker rolled into the street after a blast, shifting the visible boundary beneath the fighters.',
      turn: 'The square fell quiet for a moment while both commanders reconsidered the ground they still held.',
      objectiveAction: 'recovered the displaced sector marker, checked its coordinates, and identified the ground under control',
      prize: 'the contested sector',
    },
  ],
  'Uplink Center': [
    {
      opening: 'An uplink antenna kept sending a blank signal from the roof of a damaged communications center.',
      complication: 'A loose cable made the uplink switch channels whenever a shot shook the wall beneath it.',
      turn: 'The blank carrier briefly resolved into a message as the antenna turned toward an open stretch of sky.',
      objectiveAction: 'secured the antenna cable, held the uplink on one channel, and transmitted the recovered message',
      prize: 'the recovered uplink',
    },
    {
      opening: 'A forgotten data terminal lit up inside the uplink center when the distant relay answered its call.',
      complication: 'The terminal demanded a second confirmation just as the center’s backup power began to fail.',
      turn: 'The relay returned a final acknowledgment, leaving the terminal lit for only a moment longer.',
      objectiveAction: 'checked the data terminal, verified the relay response, and completed the interrupted uplink',
      prize: 'the uplink record',
    },
  ],
  'Double Bind': [
    {
      opening: 'Two access panels opened at opposite ends of the corridor, each warning that the other would lock first.',
      complication: 'One panel lost power, forcing a choice between repairing it and defending the route to the second.',
      turn: 'Both panels chimed at once, and the corridor lights marked two paths that could no longer be held together.',
      objectiveAction: 'repaired the failing access panel, checked the linked warning, and passed the choice to the team',
      prize: 'the linked controls',
    },
    {
      opening: 'An evacuation signal and a sealed archive alarm began sounding from the same building at the same time.',
      complication: 'A crosswired switch sent each warning to the wrong door as fighters converged on the shared control desk.',
      turn: 'The desk displayed two green routes, but only one of them would remain open after the next switch.',
      objectiveAction: 'traced the crossed alarms, separated the two door circuits, and confirmed the safe route',
      prize: 'the paired routes',
    },
  ],
  'The Dig': [
    {
      opening: 'An excavation drill broke through a stone roof and found a chamber whose lights were still burning.',
      complication: 'A lift cable snagged on the opening and dragged broken rock toward the chamber’s only console.',
      turn: 'The cable snapped taut above the buried controls, leaving the reading and the way out exposed together.',
      objectiveAction: 'descended to the buried console, cleared the grit from its reader, and copied the surviving record',
      prize: 'the buried reading',
    },
    {
      opening: 'A cold draft rose from the excavation before the survey team found a second tunnel beneath the marked shaft.',
      complication: 'The lower tunnel flooded as a damaged pump restarted, covering the symbols on its access panel.',
      turn: 'The pump failed again, leaving the half-read symbols visible beneath a thin film of water.',
      objectiveAction: 'reached the submerged panel, restored its reader, and sent the last clear line to the surface',
      prize: 'the underground record',
    },
  ],
  'Data Harvest': [
    {
      opening: 'A storage vault began deleting its oldest records the moment the first data reader connected to it.',
      complication: 'The archive index split into fragments, forcing the retrieval team to search while the loss continued.',
      turn: 'One surviving record appeared on the screen with a date that no one had expected to find.',
      objectiveAction: 'repaired the archive index, copied the threatened record, and transmitted it before the purge completed',
      prize: 'the harvested record',
    },
    {
      opening: 'An unattended server room still hummed behind a door bearing fresh scratches from an earlier search.',
      complication: 'A cooling fan seized, and the data drives began warning that the remaining archive would fail.',
      turn: 'The fan turned once more, buying a moment in which the last drive could still be read.',
      objectiveAction: 'reached the failing server, isolated the damaged drive, and copied its final usable data',
      prize: 'the surviving archive',
    },
  ],
}
