import type { RecentGame } from '../services/api.ts'
import { storyTemplateKey } from '../services/gameStoryTemplate.ts'
import { getGameSides } from '../services/gameResults.ts'

type HighlightStory = {
  id: number
  mission: string
  factions: readonly [string, string]
  notePattern: RegExp
  paragraphs: readonly string[]
}

// These scenes are written from concrete submitted highlights. The surrounding
// atmosphere is fiction; the submitted moment supplies the event at its heart.
export const GAME_HIGHLIGHT_STORIES: readonly HighlightStory[] = [
  {
    id: 109,
    mission: "Dead Man's Switch",
    factions: ['Corregidor Jurisdictional Command', 'Torchlight Brigade'],
    notePattern: /raveneye.+second order.+almost won/i,
    paragraphs: [
      'The last route to the switch ran between a wall of broken concrete and the muzzle of the Iguana. {{winner}}’s fighters had spent the day making that crossing look impossible. Now the street had gone strangely quiet, and the Raveneye stepped out of cover anyway.',
      'One order carried the trooper past the wreckage. A second would put a hand on the mechanism. The Raveneye had a moment to finish. For an instant the whole battle narrowed to that strip of open ground and the sound of boots striking pavement.',
      'The attempt fell short. The Raveneye disappeared back into the smoke with the switch still beyond reach, and {{winner}}’s soldiers held their ground. {{loser}} had found one last opening in a battlefield that seemed already lost; there was no third order to take it.',
    ],
  },
  {
    id: 114,
    mission: "Dead Man's Switch",
    factions: ['Shindenbutai', 'Operations Subsection'],
    notePattern: /hatamoto.+quantum resonance.+(?:box|case).+(?:dodg|sacha|sāchā)/i,
    paragraphs: [
      'The box sat where both firing lines could see it. The Hatamoto approached along the edge of the lane, waiting for the moment a defender blinked. Quantum Resonance turned that moment into an opening: one step, a hand on the case, and the prize was moving.',
      'The Sāchā’s E/M grenade arced across the retreat. The Hatamoto saw it too late to stop, so the trooper twisted around the falling canister and kept running. The blast crackled against the ground behind them. There was still a corridor to cross and every step felt borrowed.',
      'When the Hatamoto reached cover, the box was still in hand. Across the lane, the Sāchā searched for another throw that never came. {{winner}}’s fighters had their prize, and the narrow escape would be the part of the battle everyone remembered.',
    ],
  },
  {
    id: 116,
    mission: 'The Dig',
    factions: ['Next Wave', 'StarCo'],
    notePattern: /tue?cer.+tsyklon.+engineer/i,
    paragraphs: [
      'Dust from the excavation hung in the air when the Tsyklon appeared above the dig. Teucer watched it cross the far platform, measured the angle between two support beams, and fired. The remote dropped against the metal decking, its gun suddenly silent.',
      'An engineer came for the wreck. There was a brief hope that the Tsyklon might stand again: a hand on the chassis, a tool lifted toward the damaged housing. Teucer had stayed in position. Another shot dropped the engineer beside the silent machine.',
      'Below them, the search through the buried machinery went on. {{winner}}’s fighters had room to move through the dig now, while {{loser}}’s side had lost both a gun and the person sent to bring it back.',
    ],
  },
  {
    id: 117,
    mission: 'The Dig',
    factions: ['Operations Subsection', 'Ramah Taskforce'],
    notePattern: /yadu.+(?:hrl|heavy rocket launcher).+(?:tariq|tarik).+(?:opponents? turn 1|turn 1)/i,
    paragraphs: [
      'Tarik took the first turn with the dig still open before him. He had barely found the line toward the excavation when a Yadu on the opposite side raised a heavy rocket launcher. The shot crossed the dust in a streak of fire and took him out before the opening move could become an advance.',
      'For a moment the soldiers near the pit could only stare at the space Tarik had occupied. Then someone called for the route to be covered, and the fighting started up again around the machinery. The Yadu had bought time with one sudden shot; there was still a whole dig to contest.',
      '{{winner}}’s fighters pressed toward the site through the smoke, with the first turn’s loss hanging over every movement from {{loser}}’s side. The launcher had settled one encounter. The rest of the battle belonged to the people still trying to reach the buried tech.',
    ],
  },
]

export function renderSubmittedHighlightStory(game: RecentGame): string | null {
  const story = GAME_HIGHLIGHT_STORIES.find((item) =>
    item.id === game.id &&
    storyTemplateKey(item.mission, ...item.factions) === storyTemplateKey(game.mission, game.winnerFaction, game.loserFaction) &&
    item.notePattern.test(game.bestMoment.trim()),
  )
  if (!story) return null
  const [winner, loser] = getGameSides(game)
  return story.paragraphs.map((paragraph) => paragraph
    .replaceAll('{{winner}}', winner.displayName || winner.player)
    .replaceAll('{{loser}}', loser.displayName || loser.player)).join('\n\n')
}
