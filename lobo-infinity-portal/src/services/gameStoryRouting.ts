import { GAME_STORY_CATALOG } from '../data/gameStoryCatalog.ts'
import { renderSubmittedHighlightStory } from '../data/gameHighlightStories.ts'
import storyManifest from '../data/storyManifest.json' with { type: 'json' }
import type { ArmyIntelligenceList, RecentGame } from './api.ts'
import { renderGameStoryTemplate, storyTemplateKey } from './gameStoryTemplate.ts'
import type { GameStoryTemplate } from './gameStoryTemplate.ts'

const storiesByKey = new Map(GAME_STORY_CATALOG.map((story) => [
  storyTemplateKey(story.mission, ...story.factions), story,
]))
export const PENDING_BATTLE_STORY = 'The battle story is waiting for both submitted lists to be decoded and linked to this game.'

export function getAuthoredBattleStory(game: RecentGame, lists: ArmyIntelligenceList[]): string | null {
  const reportedStory = renderSubmittedHighlightStory(game)
  if (reportedStory) return reportedStory

  const key = storyTemplateKey(game.mission, game.winnerFaction, game.loserFaction)
  const template = key ? storiesByKey.get(key) : undefined
  return template ? renderGameStoryTemplate(template, game, lists) ?? PENDING_BATTLE_STORY : null
}

export async function loadAuthoredBattleStory(game: RecentGame, lists: ArmyIntelligenceList[], signal?: AbortSignal): Promise<string | null> {
  const immediate = getAuthoredBattleStory(game, lists)
  if (immediate) return immediate
  const mission = game.mission
  const key = storyTemplateKey(mission, game.winnerFaction, game.loserFaction)
  if (!key || !(storyManifest.missions as string[]).includes(mission)) return null
  const filename = mission.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const result = await fetch(`/game-stories/${filename}.json`, { signal })
  if (!result.ok) return null
  const stories = await result.json() as GameStoryTemplate[]
  const template = stories.find((story) => storyTemplateKey(story.mission, ...story.factions) === key)
  return template ? renderGameStoryTemplate(template, game, lists) ?? PENDING_BATTLE_STORY : null
}
