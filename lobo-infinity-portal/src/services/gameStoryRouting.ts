import { GAME_STORY_CATALOG } from '../data/gameStoryCatalog.ts'
import { renderSubmittedHighlightStory } from '../data/gameHighlightStories.ts'
import { getCanonicalMissionName } from '../config/missions.ts'
import storyManifest from '../data/storyManifest.json' with { type: 'json' }
import { SOURCED_STORY_SCENARIOS } from '../data/generatedStoryScenarios.ts'
import type { ArmyIntelligenceList, RecentGame } from './api.ts'
import { hasUnsupportedStoryMissionVersion, renderGeneratedGameStory } from './generatedGameStory.ts'
import { renderGameStoryTemplate, storyTemplateKey } from './gameStoryTemplate.ts'
import type { GameStoryTemplate } from './gameStoryTemplate.ts'
import { getGameIntelligenceLists } from './gameIntelligenceLinks.ts'

const storiesByKey = new Map(GAME_STORY_CATALOG.map((story) => [
  storyTemplateKey(story.mission, ...story.factions), story,
]))
export const PENDING_BATTLE_STORY = 'The battle story is waiting for both submitted lists to be decoded and linked to this game.'
export const MISSING_MISSION_SETUP_BATTLE_STORY = 'A generated battle story is unavailable because this game does not record the mission setup needed to tell it accurately.'
export const UNSUPPORTED_MISSION_VERSION_BATTLE_STORY = 'A generated battle story is unavailable because this game may have used an earlier version of the mission rules.'
export const NO_ELIGIBLE_HERO_BATTLE_STORY = 'A battle story is unavailable because the linked rosters do not provide an eligible actor for this mission scene.'

function unavailableStory(game: RecentGame, lists: ArmyIntelligenceList[]): string {
  const mission = getCanonicalMissionName(game.mission)
  if (mission && SOURCED_STORY_SCENARIOS[mission]?.requiresUnreportedSetup) return MISSING_MISSION_SETUP_BATTLE_STORY
  if (getGameIntelligenceLists(game, lists).length < 2) return PENDING_BATTLE_STORY
  return hasUnsupportedStoryMissionVersion(game) ? UNSUPPORTED_MISSION_VERSION_BATTLE_STORY
    : NO_ELIGIBLE_HERO_BATTLE_STORY
}

function generatedFallback(game: RecentGame, lists: ArmyIntelligenceList[]): string {
  const generated = renderGeneratedGameStory(game, lists)
  if (generated) return generated
  return unavailableStory(game, lists)
}

export function getAuthoredBattleStory(game: RecentGame, lists: ArmyIntelligenceList[]): string | null {
  const reportedStory = renderSubmittedHighlightStory(game)
  if (reportedStory) return reportedStory

  const key = storyTemplateKey(game.mission, game.winnerFaction, game.loserFaction)
  const template = key ? storiesByKey.get(key) : undefined
  return template ? renderGameStoryTemplate(template, game, lists) ?? unavailableStory(game, lists) : null
}

export async function loadAuthoredBattleStory(game: RecentGame, lists: ArmyIntelligenceList[], signal?: AbortSignal): Promise<string | null> {
  const immediate = getAuthoredBattleStory(game, lists)
  if (immediate) return immediate
  const mission = getCanonicalMissionName(game.mission)
  const key = storyTemplateKey(mission, game.winnerFaction, game.loserFaction)
  if (!key) return null
  if (!(storyManifest.missions as string[]).includes(mission)) {
    return generatedFallback(game, lists)
  }
  const filename = mission.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const result = await fetch(`/game-stories/${filename}.json`, { signal })
  if (!result.ok) {
    return result.status === 404 ? generatedFallback(game, lists) : null
  }
  const stories = await result.json() as GameStoryTemplate[]
  const template = stories.find((story) => storyTemplateKey(story.mission, ...story.factions) === key)
  if (template) return renderGameStoryTemplate(template, game, lists) ?? unavailableStory(game, lists)
  return generatedFallback(game, lists)
}
