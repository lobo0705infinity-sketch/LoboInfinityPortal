import type { CanonicalMission } from '../config/missions.ts'

export const MISSION_STORY_TEXTURES: Record<CanonicalMission, { afterAction: string; closing: string }> = {
  'Area of Interest': {
    afterAction: 'One of the survey lamps blinked behind them, warning that the line was still shifting.',
    closing: 'The last marker cast a broken shadow between the positions while dust obscured the line.',
  },
  'Akial Interference': {
    afterAction: 'A clear syllable escaped the static before the carrier swallowed it again.',
    closing: 'The relay gave one last uncertain click, as if it had heard both commands at once.',
  },
  'B-Pong': {
    afterAction: 'The ball kept moving after the contact, pulling the next exchange across the court.',
    closing: 'Its last bounce rang against the barrier, loud enough to be heard above the shooting.',
  },
  'Corporate Appropriation': {
    afterAction: 'A paper tag tore from the cargo as the machinery lurched against its restraints.',
    closing: 'The disputed numbers remained visible on the tag even after the bay fell quiet.',
  },
  'Critical Intervention': {
    afterAction: 'The emergency lights fluttered, and a voice inside called for the power to hold.',
    closing: 'A single monitor continued beeping beyond the door, counting seconds neither team could spare.',
  },
  'Crossing Lines': {
    afterAction: 'The old route sign shook under the exchange, pointing toward two incompatible paths.',
    closing: 'Across the passage, the far route marker still pointed into uncertain ground.',
  },
  "Dead Man's Switch": {
    afterAction: 'The warning light paused without going out, and everyone waited for the next flash.',
    closing: 'A thin wire still trembled beside the switch after the last shot had passed.',
  },
  Evacuation: {
    afterAction: 'Someone waiting behind the obstruction called out, then went silent as the firing resumed.',
    closing: 'A light beyond the exit kept moving, giving the waiting people a direction to follow.',
  },
  Hardlock: {
    afterAction: 'Metal scraped against metal as the mechanism tried to seal the passage once more.',
    closing: 'The lock gave one final metallic knock, but its status light remained unsettled.',
  },
  'Last Launch': {
    afterAction: 'The launch warning sounded again, sending a shiver through the platform supports.',
    closing: 'An engine note rose beneath the noise, then held at a pitch no one could ignore.',
  },
  Neutralization: {
    afterAction: 'The device kept its warning lamp lit, giving the nearby fighters no reason to relax.',
    closing: 'The stubborn lamp reflected from the floor long after the movement around it slowed.',
  },
  Outbreak: {
    afterAction: 'The isolation alarm changed pitch, drawing every glance back toward the sealed room.',
    closing: 'A strip of emergency light under the door caught dust moving against the airflow.',
  },
  'Panic Room': {
    afterAction: 'A faint sound came from the safe side of the shelter door and stopped.',
    closing: 'The intercom light stayed on, waiting for an answer from behind the reinforced wall.',
  },
  Provisioning: {
    afterAction: 'One battered crate slid against the others, reminding the crew how little room remained.',
    closing: 'A loose ration packet lay beneath the damaged crates as both teams measured their losses.',
  },
  Annihilation: {
    afterAction: 'The shots came back from an unfamiliar angle, making the old cover dangerous.',
    closing: 'Smoke hung over the lane, and the remaining fighters had to identify one another by movement.',
  },
  Battleground: {
    afterAction: 'A shout crossed the broken ground, answered at once by fire from the far position.',
    closing: 'The damaged position remained visible through the dust, though its entrance kept disappearing.',
  },
  Cutthroat: {
    afterAction: 'A second set of footsteps gave away how many people had expected this exchange to fail.',
    closing: 'The empty meeting point held the evidence of a bargain neither side intended to honor.',
  },
  Superiority: {
    afterAction: 'A marker flickered near the center, and the fighters checked where their line had moved.',
    closing: 'The nearest sector lamp cast a thin band of light over ground nobody could yet claim.',
  },
  'Uplink Center': {
    afterAction: 'A faint acknowledgment came back through the interference and vanished before anyone could repeat it.',
    closing: 'The antenna kept turning toward the sky, carrying a signal whose destination remained uncertain.',
  },
  'Double Bind': {
    afterAction: 'The two warnings sounded together again, refusing to say which door was already closing.',
    closing: 'One signal remained green while the other faded, leaving the cost of the choice unresolved.',
  },
  'The Dig': {
    afterAction: 'Loose grit rattled over the work, and the crew below shouted for room to retreat.',
    closing: 'An echo climbed the shaft from below, too deliberate to sound like settling stone.',
  },
  'Data Harvest': {
    afterAction: 'The failing archive skipped a line, forcing the team to check what had survived.',
    closing: 'A lone indicator stayed lit in the server room after the other drives fell silent.',
  },
}
