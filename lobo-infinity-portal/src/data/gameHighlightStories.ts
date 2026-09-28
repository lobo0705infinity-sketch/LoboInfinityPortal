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
      '{{winner}}’s fighters crossed below the platform while Teucer kept the approach in view. {{loser}} still had soldiers around the buried machinery, but the immediate repair had failed, and the Tsyklon’s gun no longer covered the advance. The next push toward the dig came through the space those shots had opened.',
    ],
  },
  {
    id: 117,
    mission: 'The Dig',
    factions: ['Operations Subsection', 'Ramah Taskforce'],
    notePattern: /yadu.+(?:hrl|heavy rocket launcher).+(?:tariq|tarik).+(?:opponents? turn 1|turn 1)/i,
    paragraphs: [
      'During {{loser}}’s first turn, Tarik moved toward the excavation. Across the shaft, a Yadu in {{winner}}’s line caught him in the sights of a heavy rocket launcher. The shot tore through the dust and took Tarik out before he could turn that advance into a path for Ramah’s squad.',
      'A Ghulam reached the cover Tarik had been heading for and stopped. The Yadu had not moved; its launcher still faced the route across the shaft. With that lane closed, Ramah’s fighters searched the rim for a second entrance while {{winner}}’s squad edged toward the analysis console below.',
      'Fire came from the other side of the pit, and the Yadu swung its launcher away from Tarik’s fallen route. That gave {{winner}}’s fighters a narrow crossing toward the reader. Ramah still contested the buried tech, but its first path into the dig had ended in the dust, and the next exchange began on the route the rocket shot had opened.',
    ],
  },
  {
    id: 120,
    mission: 'The Dig',
    factions: ['Operations Subsection', 'Tohaa'],
    notePattern: /ioann\s+bann.+solo run.+(?:unable to kill|no kills|without killing).+immobili[sz]ed/i,
    paragraphs: [
      '{{loser}}’s Tohaa fighters were pressing into the dig when Ioann Bann broke away for a solo run. The analysis console and buried tech lay beyond rubble watched by {{winner}}’s Operations Subsection. Ioann took the exposed line himself. A Dasyu with a MULTI Sniper Rifle held the far rim; Maximus waited nearer the reader.',
      'Ioann loosed his Viral Tactical Bow toward the Dasyu as he pushed forward, then charged the gap near Maximus. He could not bring either fighter down. Before he could reach cover, his movement stopped and he was immobilized, alone in the open between the two lines. The run had left the reader out of reach.',
      'Claire Lazhari’s Disco Baller spread Eclipse across the crossing, sheltering {{winner}}’s movement toward the reader. A Kosuil still held the rim for the Tohaa, and {{loser}}’s fighters kept looking for another way through the dig. Ioann could see the gap he had tried to make, but he could not take another step toward it.',
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
