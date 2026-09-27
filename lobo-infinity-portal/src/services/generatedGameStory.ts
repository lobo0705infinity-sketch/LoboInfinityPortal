import { CANONICAL_ARMY_REGISTRY } from '../config/armies.ts'
import { getCanonicalMissionName } from '../config/missions.ts'
import { ARMY_STORY_VOICES } from '../data/generatedStoryArmies.ts'
import type { ArmyStoryStyle } from '../data/generatedStoryArmies.ts'
import { MISSION_STORY_FRAMES } from '../data/generatedStoryFrames.ts'
import { MISSION_STORY_SEEDS } from '../data/generatedStorySeeds.ts'
import { MISSION_STORY_TEXTURES } from '../data/generatedStoryTextures.ts'
import type { ArmyIntelligenceList, RecentGame } from './api.ts'
import { renderGameStoryTemplate, storyTemplateKey } from './gameStoryTemplate.ts'
import type { GameStoryTemplate, HeroRole } from './gameStoryTemplate.ts'

const activeById = new Map(CANONICAL_ARMY_REGISTRY.filter((army) => army.active).map((army) => [army.id, army]))
const roles: readonly HeroRole[] = ['objective', 'gunfighting', 'closeCombat']
const tactics: Record<ArmyStoryStyle, { approach: string; defense: string }> = {
  assault: { approach: 'pushed directly toward', defense: 'held the approach to' },
  armored: { approach: 'advanced under covering fire toward', defense: 'set a shielded line beside' },
  flanking: { approach: 'worked around the exposed side of', defense: 'watched the flanks of' },
  guard: { approach: 'moved in formation toward', defense: 'guarded' },
  rescue: { approach: 'cleared a passage toward', defense: 'kept a withdrawal route open beside' },
  covert: { approach: 'slipped along the edge of', defense: 'concealed a watch post beside' },
  technical: { approach: 'mapped the exposed routes toward', defense: 'tracked movement around' },
  contract: { approach: 'moved to secure', defense: 'watched' },
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

// The pair is unordered and canonical. Game ID changes the scene for repeat
// meetings without allowing a reload to rewrite the same report.
export function composeGameStory(
  mission: string,
  factionA: string,
  factionB: string,
  heroFaction: string,
  role: HeroRole,
  gameId = 0,
): GameStoryTemplate | null {
  const canonical = getCanonicalMissionName(mission)
  const key = storyTemplateKey(mission, factionA, factionB)
  if (!canonical || !key || !roles.includes(role)) return null
  const [, firstId, secondId] = key.split('|')
  const first = activeById.get(firstId)
  const second = activeById.get(secondId)
  if (!first || !second) return null
  const hero = [first, second].find((army) => storyTemplateKey(mission, army.name, heroFaction) ===
    storyTemplateKey(mission, army.name, army.name))
  if (!hero) return null
  const opponent = first.id === second.id ? second : hero.id === first.id ? second : first
  const heroVoice = ARMY_STORY_VOICES[hero.id]
  const otherVoice = ARMY_STORY_VOICES[opponent.id]
  if (!heroVoice || !otherVoice) return null
  const seedList = MISSION_STORY_SEEDS[canonical]
  const seed = seedList[stableHash(key + ':' + String(gameId)) % seedList.length]
  const frame = MISSION_STORY_FRAMES[canonical]
  const texture = MISSION_STORY_TEXTURES[canonical]
  const heroAction = role === 'objective'
    ? seed.objectiveAction
    : role === 'gunfighting'
      ? frame.gunfighting
      : frame.closeCombat

  return {
    mission: canonical,
    factions: [first.name, second.name],
    heroFaction: hero.name,
    role,
    paragraphs: [
      seed.opening + ' {{heroPlayer}}’s ' + heroVoice.crew + ' ' + tactics[heroVoice.style].approach +
        ' ' + frame.ground + ', while {{otherPlayer}}’s ' + otherVoice.crew + ' ' +
        tactics[otherVoice.style].defense + ' ' + frame.position + '. ' + frame.stakes,
      seed.complication + ' ' + frame.crossfire + ' ' + seed.turn,
      '{{hero}} ' + heroAction + '. ' + texture.afterAction + ' ' + frame.reaction +
        ' ' + texture.closing,
    ],
    endings: frame.endings,
  }
}

export function renderGeneratedGameStory(game: RecentGame, lists: ArmyIntelligenceList[]): string | null {
  const key = storyTemplateKey(game.mission, game.winnerFaction, game.loserFaction)
  if (!key) return null
  const [, firstId, secondId] = key.split('|')
  const first = activeById.get(firstId)
  const second = activeById.get(secondId)
  if (!first || !second) return null

  const gameId = Number.isFinite(game.id) ? game.id : 0
  const start = stableHash(key + ':' + String(gameId))
  const factions = first.id === second.id ? [first.name] : [first.name, second.name]
  const orderedFactions = factions.slice(start % factions.length).concat(factions.slice(0, start % factions.length))
  const orderedRoles = roles.slice(start % roles.length).concat(roles.slice(0, start % roles.length))
  for (const role of orderedRoles) {
    for (const faction of orderedFactions) {
      const template = composeGameStory(game.mission, first.name, second.name, faction, role, gameId)
      if (!template) continue
      const rendered = renderGameStoryTemplate(template, game, lists)
      if (rendered) return rendered
    }
  }
  return null
}
