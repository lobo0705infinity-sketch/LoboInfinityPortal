import type { CanonicalMission } from '../config/missions.ts'

// Short, mission-specific references for the factions' tactical choices.
// The full objective and its rules remain in the incident; these referents
// let each force react to a different part of that same contest instead of
// naming the mission's primary object in every sentence.
export type MissionTacticalReferents = {
  advance: string
  feint: string
  defend: string
  continuation: string
}

function referents(advance: string, feint: string, defend: string,
  continuation: string): MissionTacticalReferents {
  return { advance, feint, defend, continuation }
}

export const MISSION_TACTICAL_REFERENTS: Record<Exclude<CanonicalMission, 'Area of Interest'>,
  MissionTacticalReferents> = {
  'Akial Interference': referents(
    'the public-card display', 'the aerial walkway', 'the filter controls', 'the antenna base'),
  'B-Pong': referents(
    'the far half', 'the console-side cover', 'the contact ring', 'the open middle lane'),
  'Corporate Appropriation': referents(
    'the enemy prototype', 'the panoply lockers', 'the guarded cradle', 'the loading aisle'),
  'Critical Intervention': referents(
    'the unclaimed pack', 'the far doorway', 'the guarded exit', 'the outer door'),
  'Crossing Lines': referents(
    'the scored ground', 'the aerial approach', 'the control panel', 'the far-zone crossing'),
  "Dead Man's Switch": referents(
    'the disputed room', 'the Core’s guard', 'the room threshold', 'the open doorway'),
  Evacuation: referents(
    'the extraction controls', 'the console-side cover', 'the waiting civilian', 'the console face'),
  Hardlock: referents(
    'the beacon’s flank', 'the console-side cover', 'the disputed switch', 'the beacon base'),
  'Last Launch': referents(
    'the checker', 'the tower gate', 'the central checker', 'the tower center'),
  Neutralization: referents(
    'the area boundary', 'the box approach', 'the exposed box', 'the circular zone'),
  Outbreak: referents(
    'the containment corridor', 'the escort’s flank', 'the waiting patient', 'the corridor entrance'),
  'Panic Room': referents(
    'the room threshold', 'the side entrance', 'the defended gate', 'the room’s open floor'),
  Provisioning: referents(
    'the waiting Tech-Coffin', 'the coffin-side guard', 'the loading exit', 'the safety boundary'),
  Annihilation: referents(
    'the survivors’ cover', 'the lieutenant’s guard', 'the guarded officer', 'the battered squad'),
  Battleground: referents(
    'the middle sector', 'the far-side patrol', 'the sector’s outer edge', 'the open center'),
  Cutthroat: referents(
    'the rival officer', 'the command escort', 'the lieutenant’s cover', 'the exposed flank'),
  Superiority: referents(
    'the open quadrant', 'the central crossing', 'the contested switch', 'the quadrant’s edge'),
  'Uplink Center': referents(
    'the Tech-Coffin', 'the antenna-side guards', 'the disputed uplink', 'the open crossing'),
  'Double Bind': referents(
    'the scoring zone', 'the rival aerial', 'the antenna controls', 'the scored ground'),
  'The Dig': referents(
    'the excavated tech', 'the excavation’s far side', 'the analysis console', 'the exposed reader'),
  'Data Harvest': referents(
    'the enemy zone', 'the harvester’s escort', 'the live device', 'the marked boundary'),
}
