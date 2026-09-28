import type { CanonicalMission } from '../config/missions.ts'

// Second-half incident actions give the selected gunfighter or close fighter
// a different way to influence the same mission objective. They do not claim
// that a scored objective was completed in an actual recorded game.
export const MISSION_ROLE_ALTERNATES: Record<Exclude<CanonicalMission, 'Area of Interest'>,
  { gunfighting: string; closeCombat: string }> = {
  'Akial Interference': {
    gunfighting: 'kept shots over the antenna approach while the operator read the public Common cards',
    closeCombat: 'forced the defender back from the filter controls while the operator checked the Common cards',
  },
  'B-Pong': {
    gunfighting: 'drew the console guard’s fire away from the specialist edging toward the tracking beacon',
    closeCombat: 'forced a defender clear of the contact ring while the beacon specialist closed in',
  },
  'Corporate Appropriation': {
    gunfighting: 'pinned the panoply guard while a carrier reached for the unsecured prototype',
    closeCombat: 'forced a path through the cradle guard so a carrier could reach the prototype',
  },
  'Critical Intervention': {
    gunfighting: 'held the doorway under fire while the specialist approached the data console',
    closeCombat: 'drove the guard from the server-room threshold and protected the specialist at the console',
  },
  'Crossing Lines': {
    gunfighting: 'kept fire on the aerial guard as the specialist crossed the contested ground',
    closeCombat: 'forced a defender back from the aerial while the squad moved into the scoring zone',
  },
  "Dead Man's Switch": {
    gunfighting: 'covered the room doorway while the Data Pack carrier searched for the Quantum Core',
    closeCombat: 'forced the room guard back while a specialist closed on the Quantum Core',
  },
  Evacuation: {
    gunfighting: 'screened the civilian’s path under fire while its escort approached the Extraction Console',
    closeCombat: 'shoved a guard off the Extraction Console so the civilian escort could cross',
  },
  Hardlock: {
    gunfighting: 'held the beacon guard’s attention while the console specialist tested the switch',
    closeCombat: 'drove a guard from the enemy beacon and screened the route to its console',
  },
  'Last Launch': {
    gunfighting: 'fired across the tower passage to keep the guard off the specialist’s route',
    closeCombat: 'forced the tower guard back from the approach between scanner and checker',
  },
  Neutralization: {
    gunfighting: 'drew the zone guard’s fire while the marked Hyperthermal Tech Box was carried closer',
    closeCombat: 'forced a gap inside the Neutralization Area for the tech bearer',
  },
  Outbreak: {
    gunfighting: 'kept a shooting lane clear while the medic approached the Infected for stabilization',
    closeCombat: 'pushed a defender away from the Infected and sheltered the medic’s approach',
  },
  'Panic Room': {
    gunfighting: 'held fire across the entrance while Essential Personnel moved toward the Panic Room',
    closeCombat: 'drove the gate guard backward to leave room for Essential Personnel to enter',
  },
  Provisioning: {
    gunfighting: 'pinned the exit guard while the supply-box carrier sought a safe route',
    closeCombat: 'pushed the Tech-Coffin guard back so the carrier could move the supply box',
  },
  Annihilation: {
    gunfighting: 'drew fire from the enemy lieutenant’s guard while friendly survivors took cover',
    closeCombat: 'forced an attacker off the surviving squad’s route toward the enemy lieutenant',
  },
  Battleground: {
    gunfighting: 'fired across the middle ground while the squad edged toward the far scoring sector',
    closeCombat: 'drove a defender from the center approach while the squad held cover in the middle',
  },
  Cutthroat: {
    gunfighting: 'covered a flank of the rival lieutenant while the friendly officer found shelter',
    closeCombat: 'forced the lieutenant’s guard aside and sheltered the friendly command route',
  },
  Superiority: {
    gunfighting: 'held the quadrant crossing under fire as a specialist approached the console',
    closeCombat: 'forced a guard off the console approach and kept the quadrant open for the squad',
  },
  'Uplink Center': {
    gunfighting: 'held the antenna-side guard under fire while a specialist sought Tech-Coffin contact',
    closeCombat: 'forced a defender away from the aerial and protected the Tech-Coffin approach',
  },
  'Double Bind': {
    gunfighting: 'covered the antenna lane while the squad contested the adjacent zone',
    closeCombat: 'forced the antenna guard back as the squad disputed the scoring ground',
  },
  'The Dig': {
    gunfighting: 'drew fire from the analysis console and sheltered the specialist reaching for its input',
    closeCombat: 'shoved the guard from the reader and cleared a path to the buried tech',
  },
  'Data Harvest': {
    gunfighting: 'fired across the designated zone to keep the rival patrol from the data-harvester',
    closeCombat: 'intercepted the boundary guard while the crew contested a place for its data-harvester',
  },
}
