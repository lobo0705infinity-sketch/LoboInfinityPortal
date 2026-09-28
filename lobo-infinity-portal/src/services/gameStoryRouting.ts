import { renderSubmittedHighlightStory } from '../data/gameHighlightStories.ts'
import type { ArmyIntelligenceList, RecentGame } from './api.ts'
import { hasUnsupportedStoryMissionVersion, renderGeneratedGameStory } from './generatedGameStory.ts'
import { storyTemplateKey } from './gameStoryTemplate.ts'
import { getGameIntelligenceLists } from './gameIntelligenceLinks.ts'

export const PENDING_BATTLE_STORY = 'The battle story is waiting for both submitted lists to be decoded and linked to this game.'
export const UNSUPPORTED_MISSION_VERSION_BATTLE_STORY = 'A generated battle story is unavailable because this game may have used an earlier version of the mission rules.'
export const NO_ELIGIBLE_HERO_BATTLE_STORY = 'A battle story is unavailable because the linked rosters do not provide an eligible actor for this mission scene.'

function unavailableStory(game: RecentGame, lists: ArmyIntelligenceList[]): string {
  if (getGameIntelligenceLists(game, lists).length < 2) return PENDING_BATTLE_STORY
  return hasUnsupportedStoryMissionVersion(game) ? UNSUPPORTED_MISSION_VERSION_BATTLE_STORY
    : NO_ELIGIBLE_HERO_BATTLE_STORY
}

function generatedStory(game: RecentGame, lists: ArmyIntelligenceList[]): string {
  const generated = renderGeneratedGameStory(game, lists)
  if (generated) return generated
  return unavailableStory(game, lists)
}

export function getSubmittedHighlightBattleStory(game: RecentGame): string | null {
  return renderSubmittedHighlightStory(game)
}

// Historical mission/matchup stories stay on disk for review. The pilot never
// reads them: every supported game without a submitted highlight uses the
// same generator, including pairs that have an older authored story.
export async function loadBattleStory(game: RecentGame, lists: ArmyIntelligenceList[]): Promise<string | null> {
  const immediate = getSubmittedHighlightBattleStory(game)
  if (immediate) return immediate
  const key = storyTemplateKey(game.mission, game.winnerFaction, game.loserFaction)
  if (!key) return null
  return generatedStory(game, lists)
}
