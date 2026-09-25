import type { GameStoryTemplate } from '../services/gameStoryTemplate.ts'

// A story belongs to one mission and one unordered army matchup. Each entry
// contains its own authored scene and a role-specific actor from a decoded list.
export const GAME_STORY_CATALOG: readonly GameStoryTemplate[] = [
  {
    mission: 'The Dig',
    factions: ['Next Wave', 'Operations Subsection'],
    heroFaction: 'Next Wave',
    role: 'objective',
    paragraphs: [
      'The excavation had uncovered metal that should have been cold. Instead, it glowed beneath the dust and cast moving bands across the shaft walls. {{otherPlayer}}’s soldiers prepared to seal the site, while {{heroPlayer}}’s fighters needed one clean reading before the opening disappeared beneath the descending barriers.',
      '{{allyGunfighter}}’s fire forced the defenders off the rim long enough for {{hero}} to descend. The trooper reached the console, braced a gauntlet against its rail, and began the analysis. Figures raced across the display. Deep below, the buried tech answered in a pulse that felt almost like a heartbeat.',
      '{{enemyGunfighter}} appeared on the platform above with a weapon raised. {{hero}} could take cover, but the reading had not finished transmitting. The trooper held on as shots broke the console housing. When the last line of data cleared, {{hero}} dropped into the dust beside it.',
    ],
    endings: {
      heroWins: '{{otherPlayer}}’s soldiers still controlled the rim, but {{heroPlayer}} already had the answer.',
      heroLoses: 'The reading escaped the shaft, but {{otherPlayer}}’s soldiers secured the rest of the dig while {{heroPlayer}} carried its secret away and {{winner}} held the mission.',
      draw: 'The reading escaped the shaft, though above ground neither commander could claim the dig entirely.',
    },
  },
  {
    mission: 'The Dig',
    factions: ['Kosmoflot', 'Next Wave'],
    heroFaction: 'Kosmoflot',
    role: 'gunfighting',
    paragraphs: [
      'Frost had formed on the cables leading into the excavation, thick enough to hide stress fractures along the main winch line. {{heroPlayer}}’s salvage crew needed a few more seconds at the buried console, but movement along the upper gantry told them {{otherPlayer}}’s soldiers had found the opening first.',
      '{{hero}} took position beside a frozen winch. When {{enemyGunfighter}} appeared above the pit, the trooper fired across the broken railing and drove the attacker back. The winch shuddered under return fire. One cable snapped, sending a shower of ice and loose metal into the shaft where the console team worked.',
      'The trooper stepped into the open to cover the only ladder out. Below, a specialist kept one hand against the console while the other reached for a data line buried under the fallen cable. The signal light changed color. For one breath, everyone on the gantry heard the machine answer.',
    ],
    endings: {
      heroWins: 'The salvage crew climbed out with the reading while {{hero}} held the ladder clear.',
      heroLoses: '{{hero}} held the ladder long enough for the crew to escape, but {{otherPlayer}}’s soldiers took the dig before its secrets were secure.',
      draw: 'The crew carried one reading out of the shaft; both commanders were still fighting over what remained below.',
    },
  },
]
