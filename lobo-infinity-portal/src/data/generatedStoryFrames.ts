import type { CanonicalMission } from '../config/missions.ts'

export type MissionStoryFrame = {
  ground: string
  position: string
  stakes: string
  crossfire: string
  gunfighting: string
  closeCombat: string
  reaction: string
  endings: { heroWins: string; heroLoses: string; draw: string }
}

// The frame places both armies and the roster-selected hero in the same
// physical incident. It never describes an unsubmitted unit or a game turn.
export const MISSION_STORY_FRAMES: Record<CanonicalMission, MissionStoryFrame> = {
  'Area of Interest': {
    ground: 'the disputed survey line', position: 'the boundary markers',
    stakes: 'A step in the wrong direction would leave the nearest post undefended.',
    crossfire: 'Rounds struck the survey stakes, so neither crew could trust the line painted between them.',
    gunfighting: 'fired at the rifle watching the far marker and opened a lane for a fresh survey',
    closeCombat: 'drove a defender away from the closest marker and kept the survey team beside it',
    reaction: 'The other patrol challenged the new coordinates before anyone could move the nearest post.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew fixed the boundary and held the ground their marker proved was theirs.',
      heroLoses: '{{otherPlayer}}’s crew took the surveyed ground while {{heroPlayer}}’s marker vanished beneath the rubble.',
      draw: 'Both crews left with rival coordinates, and the boundary remained disputed.',
    },
  },
  'Akial Interference': {
    ground: 'the listening station', position: 'the antenna access',
    stakes: 'An uncorrupted message could leave only while the receiver held its frequency.',
    crossfire: 'Gunfire snapped around the receiver housing, leaving the technicians to work between bursts of static.',
    gunfighting: 'fired into the sentry position beside the aerial, giving a technician time to retune the receiver',
    closeCombat: 'forced a guard away from the aerial ladder and held it while a technician reached the receiver',
    reaction: 'The other team reached for the aerial as the message began to resolve.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew got a clean message through before the Akial carrier swallowed the channel.',
      heroLoses: '{{otherPlayer}}’s crew took the receiver and cut {{heroPlayer}}’s message short.',
      draw: 'Both crews copied fragments of the transmission, but neither recovered the complete message.',
    },
  },
  'B-Pong': {
    ground: 'the damaged court', position: 'the rebound barrier',
    stakes: 'The ball was still live, and the broken barrier made its next bounce impossible to call.',
    crossfire: 'Both teams broke for opposite sides of the rebound, leaving no safe line across the tiles.',
    gunfighting: 'fired at the weapon covering the sideline and gave a teammate room to chase the rebound',
    closeCombat: 'shoved a defender off the sideline and cleared space for a teammate to reach the ball',
    reaction: 'A second rush toward the ball left the next possession undecided.',
    endings: {
      heroWins: '{{heroPlayer}}’s team won the last rebound and kept control of the court.',
      heroLoses: '{{otherPlayer}}’s team took the last rebound while {{heroPlayer}}’s team fell back from the court.',
      draw: 'The last bounce carried the ball out of reach before either team could settle the contest.',
    },
  },
  'Corporate Appropriation': {
    ground: 'the loading bay', position: 'the disputed cargo',
    stakes: 'The ownership record mattered only if a crew could leave with the asset.',
    crossfire: 'Fire skipped off the loading rails as both teams tried to keep the cargo within reach.',
    gunfighting: 'fired across the loading rail and pinned the guard between the crew and the cargo',
    closeCombat: 'struck the guard beside the loading controls and forced a path to the cargo',
    reaction: 'The opposing crew reached for the manifest before the load could be moved.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew left the bay with the asset and the record supporting its claim.',
      heroLoses: '{{otherPlayer}}’s crew carried the cargo away under a claim {{heroPlayer}} could no longer challenge.',
      draw: 'The crews split the records while the cargo stayed locked in the contested bay.',
    },
  },
  'Critical Intervention': {
    ground: 'the emergency compound', position: 'the treatment-room doors',
    stakes: 'People inside needed a working passage more urgently than either team needed cover.',
    crossfire: 'Rounds struck the corridor wall, keeping the medics back from the failing equipment.',
    gunfighting: 'fired on the weapon aimed at the treatment-room door and covered a medic crossing the corridor',
    closeCombat: 'drove a defender back from the treatment-room door and held it for the waiting medics',
    reaction: 'The opposing crew contested the doorway while medics struggled to bring their supplies inside.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew restored access and got the patients into the medics’ care.',
      heroLoses: '{{otherPlayer}}’s crew held the treatment room as {{heroPlayer}}’s medics withdrew to safety.',
      draw: 'The medics reached the patients, but neither team held the emergency site afterward.',
    },
  },
  'Crossing Lines': {
    ground: 'the crossing', position: 'the far route marker',
    stakes: 'A wrong turn would put the column in sight of both firing lanes.',
    crossfire: 'Shots cut through the route markers, hiding the only passable lane behind drifting debris.',
    gunfighting: 'fired into the position guarding the far side and covered the column through the crossing',
    closeCombat: 'drove the nearest guard off the narrow span and made room for the column to pass',
    reaction: 'The opposing patrol tried to shut the route before the column cleared it.',
    endings: {
      heroWins: '{{heroPlayer}}’s column crossed on the corrected route before the checkpoint closed.',
      heroLoses: '{{otherPlayer}}’s patrol held the far side and turned {{heroPlayer}}’s column back.',
      draw: 'Both columns withdrew from the crossing with the far route still unmarked.',
    },
  },
  "Dead Man's Switch": {
    ground: 'the switch housing', position: 'the trigger wire',
    stakes: 'Any stray movement could make the false countdown real.',
    crossfire: 'Bullets struck the table beside the contacts, and the warning light flickered with each impact.',
    gunfighting: 'fired at the weapon covering the contacts and bought the technician room to isolate the trigger',
    closeCombat: 'caught the defender reaching for the trigger and forced their hand away from the contacts',
    reaction: 'The other team reached the housing just as its warning light changed.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew broke the trigger circuit and carried the switch clear.',
      heroLoses: '{{otherPlayer}}’s crew took the housing while {{heroPlayer}}’s team retreated from the live contacts.',
      draw: 'Both crews backed away from the armed switch without learning who controlled the trigger.',
    },
  },
  Evacuation: {
    ground: 'the evacuation corridor', position: 'the shelter exit',
    stakes: 'The waiting civilians could not cross the firing lane without an escort.',
    crossfire: 'Shots struck the route signs, scattering dust across the only marked way out.',
    gunfighting: 'fired at the weapon covering the shelter exit and held the lane open for the evacuees',
    closeCombat: 'forced a guard away from the shelter exit and made room for the first evacuees',
    reaction: 'The other team blocked the route as the first evacuees reached the obstruction.',
    endings: {
      heroWins: '{{heroPlayer}}’s escort brought the waiting civilians out through the cleared exit.',
      heroLoses: '{{otherPlayer}}’s crew held the exit and forced {{heroPlayer}}’s escort to seek another route.',
      draw: 'Some evacuees reached safety while the contested exit remained closed to the rest.',
    },
  },
  Hardlock: {
    ground: 'the locked passage', position: 'the access controls',
    stakes: 'The closing mechanism would divide the teams if it completed its cycle.',
    crossfire: 'A burst tore into the doorframe, jamming the manual catch and slowing every attempt to pass.',
    gunfighting: 'fired on the guard at the control panel and covered a technician working the damaged lock',
    closeCombat: 'struck the guard blocking the control panel and braced the narrowing doorway',
    reaction: 'The opposing team tried to claim the controls before the seal settled.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew reset the lock and passed through the gate with access restored.',
      heroLoses: '{{otherPlayer}}’s crew sealed the passage with {{heroPlayer}}’s team stranded outside.',
      draw: 'The lock froze between states, leaving both teams on opposite sides of the gate.',
    },
  },
  'Last Launch': {
    ground: 'the launch pad', position: 'the pad controls',
    stakes: 'Every second of the countdown narrowed the window for a safe departure.',
    crossfire: 'Rounds tore through a service rail while the warning siren drowned out the ground crew.',
    gunfighting: 'fired on the position covering pad access and gave the ground crew a route through',
    closeCombat: 'drove a guard away from the service ramp and held it for the ground crew',
    reaction: 'The other team reached for the launch controls as the engines changed pitch.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew cleared the pad and kept the departure within its launch window.',
      heroLoses: '{{otherPlayer}}’s crew took the controls and grounded {{heroPlayer}}’s departing craft.',
      draw: 'The launch window closed while both crews fought over the unmoved shuttle.',
    },
  },
  Neutralization: {
    ground: 'the threatened site', position: 'the live device',
    stakes: 'Disabling the threat mattered more than holding the room for another minute.',
    crossfire: 'Bullets tore through the equipment around the device, threatening its controls before it could be isolated.',
    gunfighting: 'fired at the guard beside the live device and shielded the technician working its controls',
    closeCombat: 'forced the defender away from the live device and protected the technician at its controls',
    reaction: 'The opposing team reached the device before its warning light went out.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew disabled the device and marked the immediate threat neutralized.',
      heroLoses: '{{otherPlayer}}’s crew retained the live device as {{heroPlayer}}’s technicians withdrew.',
      draw: 'Both crews withdrew from the site with the device still active.',
    },
  },
  Outbreak: {
    ground: 'the quarantine wing', position: 'the isolation hatch',
    stakes: 'An open seal could carry the unknown hazard beyond the building.',
    crossfire: 'Shots cracked the glass near the isolation door, making each breath beyond it a risk.',
    gunfighting: 'fired at the guard by the isolation hatch and protected the medic sealing the leak',
    closeCombat: 'drove the guard away from the isolation hatch and held the doorway for a medic',
    reaction: 'The other team pressed toward the hatch as the air warning repeated.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew secured the quarantine line and carried the warning out.',
      heroLoses: '{{otherPlayer}}’s crew kept the isolation wing while {{heroPlayer}}’s team fell back behind the seal.',
      draw: 'Both crews closed their own doors, leaving the source of the outbreak inside the wing.',
    },
  },
  'Panic Room': {
    ground: 'the shelter entrance', position: 'the reinforced door',
    stakes: 'Someone inside was still moving, but the failing lock would soon hide them again.',
    crossfire: 'Fire struck the doorframe beside the intercom, drowning out the voice trying to answer.',
    gunfighting: 'fired on the guard at the shelter door and covered the attempt to free the lock',
    closeCombat: 'forced the guard off the shelter threshold and held the gap until help arrived',
    reaction: 'The other team reached the door as a second sound came from inside.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew opened the panic room and brought its occupants out.',
      heroLoses: '{{otherPlayer}}’s crew sealed the shelter before {{heroPlayer}}’s team could reach the occupants.',
      draw: 'The occupants answered the intercom, but the contested door stayed closed.',
    },
  },
  Provisioning: {
    ground: 'the supply depot', position: 'the last supply stacks',
    stakes: 'The remaining provisions had to leave before the depot shut down.',
    crossfire: 'Gunfire forced the carriers away from the stores, leaving the supplies exposed beside the blocked lane.',
    gunfighting: 'fired at the guard by the supply stacks and covered the crew recovering the crates',
    closeCombat: 'drove a defender away from the supplies and made space for the carriers to move',
    reaction: 'The opposing crew reached the last crates as the access route began to close.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew moved the provisions out before the loading bay closed.',
      heroLoses: '{{otherPlayer}}’s crew took the remaining supplies and left {{heroPlayer}} with an empty manifest.',
      draw: 'Each crew hauled away part of the stockpile, leaving the depot short of both orders.',
    },
  },
  Annihilation: {
    ground: 'the broken front', position: 'the last firing lane',
    stakes: 'The next assault would decide whether either squad could leave the block intact.',
    crossfire: 'A second burst broke the last shelter, forcing the defenders toward the exposed passage.',
    gunfighting: 'fired through the smoke at the attacking weapon and covered the last fighters withdrawing',
    closeCombat: 'caught an attacker at the barricade and drove them back from the wounded',
    reaction: 'The opposing fighters regrouped where the smoke concealed the last approach.',
    endings: {
      heroWins: '{{heroPlayer}}’s fighters held the front and broke the final attack.',
      heroLoses: '{{otherPlayer}}’s fighters took the block as {{heroPlayer}}’s survivors escaped through the smoke.',
      draw: 'Both battered squads withdrew, leaving the block empty and the fight unfinished.',
    },
  },
  Battleground: {
    ground: 'the contested front', position: 'the defended position',
    stakes: 'Control of the position would expose every approach across the battlefield.',
    crossfire: 'Rifle fire cut across the open lane, pinning both crews below the damaged position.',
    gunfighting: 'fired on the defender guarding the access and covered the squad moving forward',
    closeCombat: 'drove a defender from the blocked approach and kept the squad moving',
    reaction: 'The other team sent reinforcements toward the position before the lights went out.',
    endings: {
      heroWins: '{{heroPlayer}}’s squad held the forward position and secured its command point.',
      heroLoses: '{{otherPlayer}}’s squad took the position and forced {{heroPlayer}}’s fighters back.',
      draw: 'Both squads held separate lanes while the command position stood empty.',
    },
  },
  Cutthroat: {
    ground: 'the arranged meeting place', position: 'the false handoff',
    stakes: 'Neither side knew which bargain was real until the handoff broke.',
    crossfire: 'Shots tore through the arranged handoff, making every route out of the meeting place suspect.',
    gunfighting: 'fired at the shooter watching the handoff and covered the crew retrieving the evidence',
    closeCombat: 'caught a waiting attacker beside the handoff and forced a route past the ambush',
    reaction: 'The opposing crew reached for the evidence before the forged instructions could be exposed.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew escaped the ambush with the evidence behind the false bargain.',
      heroLoses: '{{otherPlayer}}’s crew took the real evidence while {{heroPlayer}} followed a forged lead.',
      draw: 'Both crews left the ambush with different clues and no proof of who had set the trap.',
    },
  },
  Superiority: {
    ground: 'the contested sector', position: 'the central approach',
    stakes: 'A single change of position could settle which force controlled the ground.',
    crossfire: 'Shots drove the defenders away from the clearest position, but the open center offered no safe foothold.',
    gunfighting: 'fired at the weapon covering the sector center and covered the squad taking ground',
    closeCombat: 'drove a defender away from the sector center and held the gap for the squad',
    reaction: 'The opposing force shifted across the sector line before the positions settled.',
    endings: {
      heroWins: '{{heroPlayer}}’s force held the contested sector when the markers steadied.',
      heroLoses: '{{otherPlayer}}’s force held the center while {{heroPlayer}} fell back beyond the sector line.',
      draw: 'Both forces held a side of the square, leaving control of the center unresolved.',
    },
  },
  'Uplink Center': {
    ground: 'the communications center', position: 'the uplink console',
    stakes: 'The distant relay would listen for only one more clean transmission.',
    crossfire: 'The crews traded shots near the cable tray, leaving the only stable channel exposed to damage.',
    gunfighting: 'fired on the sentry beside the uplink console and covered the technician reconnecting its cable',
    closeCombat: 'drove a guard away from the uplink console and kept the channel clear for a technician',
    reaction: 'The opposing crew reached for the transmitter before the full data packet cleared.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew sent the complete uplink before the relay went silent.',
      heroLoses: '{{otherPlayer}}’s crew cut the uplink and took its surviving data.',
      draw: 'Both crews intercepted pieces of the transmission, but the relay received no complete message.',
    },
  },
  'Double Bind': {
    ground: 'the divided corridor', position: 'the paired control panels',
    stakes: 'Opening one route could close the other before anyone escaped.',
    crossfire: 'Bullets struck the shared control desk, splitting the crews between the two alarms.',
    gunfighting: 'fired at the guard covering one panel and bought a technician time to choose a route',
    closeCombat: 'forced a defender away from one panel and held the passage while a technician chose',
    reaction: 'The opposing crew moved toward the second panel before the first route could be secured.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew opened the chosen route and got its people through.',
      heroLoses: '{{otherPlayer}}’s crew controlled the linked doors and trapped {{heroPlayer}} on the wrong side.',
      draw: 'Both crews escaped by different routes, leaving the paired controls in dispute.',
    },
  },
  'The Dig': {
    ground: 'the excavation shaft', position: 'the buried access panel',
    stakes: 'The reading below would be lost if the damaged shaft closed first.',
    crossfire: 'Fire rattled the drill housing above the workers, dropping grit across the only way down.',
    gunfighting: 'fired at the weapon covering the shaft ladder and sheltered the survey crew descending below',
    closeCombat: 'drove a guard off the shaft ladder and held the rungs for the survey crew',
    reaction: 'The opposing crew reached the shaft lip as a fresh crack traveled through the stone.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew escaped the excavation carrying the buried reading.',
      heroLoses: '{{otherPlayer}}’s crew took the reading while {{heroPlayer}} withdrew from the unstable shaft.',
      draw: 'Each crew carried away part of the record before the shaft closed over the rest.',
    },
  },
  'Data Harvest': {
    ground: 'the failing archive', position: 'the surviving data drive',
    stakes: 'Every lost second erased another line of the remaining record.',
    crossfire: 'Gunfire tore into the server racks, making the index flicker while the drives continued to fail.',
    gunfighting: 'fired on the guard beside the server racks and covered the technician copying the data',
    closeCombat: 'forced the defender away from the server racks and held the space around the reader',
    reaction: 'The opposing crew reached the last working drive before its indicator went dark.',
    endings: {
      heroWins: '{{heroPlayer}}’s crew copied the surviving data before the archive failed.',
      heroLoses: '{{otherPlayer}}’s crew took the usable records while {{heroPlayer}}’s copy remained incomplete.',
      draw: 'Both crews saved fragments of the archive, but the missing records were lost with the drive.',
    },
  },
}
