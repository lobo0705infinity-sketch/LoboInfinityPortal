import { CANONICAL_ARMY_REGISTRY } from '../config/armies.ts'
import { getCanonicalMissionName } from '../config/missions.ts'
import { ARMY_STORY_VOICES } from '../data/generatedStoryArmies.ts'
import type { ArmyStoryStyle } from '../data/generatedStoryArmies.ts'
import { AREA_ARMY_METHODS } from '../data/generatedStoryAreaArmies.ts'
import { MISSION_ARMY_METHODS } from '../data/generatedStoryMissionArmies.ts'
import { SOURCED_STORY_SCENARIOS } from '../data/generatedStoryScenarios.ts'
import { AREA_LOCATIONS, AREA_WEATHER } from '../data/generatedStorySettings.ts'
import type { AreaStoryTags } from '../data/generatedStorySettings.ts'
import type { ArmyIntelligenceList, RecentGame } from './api.ts'
import { renderGameStoryTemplate, storyTemplateKey } from './gameStoryTemplate.ts'
import type { GameStoryTemplate, HeroRole } from './gameStoryTemplate.ts'

const activeById = new Map(CANONICAL_ARMY_REGISTRY.filter((army) => army.active).map((army) => [army.id, army]))
const roles: readonly HeroRole[] = ['objective', 'gunfighting', 'closeCombat']
const tactics: Record<ArmyStoryStyle, { approach: string; defense: string }> = {
  assault: { approach: 'pushed directly toward', defense: 'held the approach to' },
  armored: { approach: 'advanced under covering fire toward', defense: 'set a shielded line beside' },
  flanking: { approach: 'skirted', defense: 'watched the flanks of' },
  guard: { approach: 'moved in formation toward', defense: 'guarded' },
  rescue: { approach: 'cleared a passage toward', defense: 'kept a withdrawal route open beside' },
  covert: { approach: 'slipped along the edge of', defense: 'concealed a watch post beside' },
  technical: { approach: 'charted a route toward', defense: 'tracked movement around' },
  contract: { approach: 'moved to secure', defense: 'watched' },
}

const areaRoleActions: Record<ArmyStoryStyle, { gunfighting: string; closeCombat: string }> = {
  assault: {
    gunfighting: 'fired across the guard’s position and covered the specialist at the communication antenna',
    closeCombat: 'forced a guard from the relay base and held the space for the specialist',
  },
  armored: {
    gunfighting: 'fired through return fire to keep the operator at the communication antenna',
    closeCombat: 'pushed a defender from the switch and stood between the specialist and the counterattack',
  },
  flanking: {
    gunfighting: 'fired from the side approach to draw the guard away from the relay',
    closeCombat: 'caught the guard beside the antenna and cleared the specialist’s flank',
  },
  guard: {
    gunfighting: 'held a firing lane to the communication antenna while the operator crossed',
    closeCombat: 'intercepted the guard at the relay base and kept the approach open',
  },
  rescue: {
    gunfighting: 'covered the specialist at the communication antenna and kept a way back open',
    closeCombat: 'drove the guard away from the operator and protected the route back',
  },
  covert: {
    gunfighting: 'fired from the blind side of the mast and drew the guard off the controls',
    closeCombat: 'struck at the guard beside the relay and opened a quiet path to the switch',
  },
  technical: {
    gunfighting: 'pinned the guard beside the communication antenna while the specialist checked the panel',
    closeCombat: 'shoved a guard from the relay housing and held access to its controls',
  },
  contract: {
    gunfighting: 'traded shots with the guard and covered the specialist at the switch',
    closeCombat: 'forced the guard off the panel and held the route for the operator',
  },
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function withoutFinalPeriod(ending: string): string {
  if (!ending.endsWith('.')) throw new Error('A mission ending must end with a period')
  return ending.slice(0, -1)
}

function continueEnding(ending: string, clause: string): string {
  return withoutFinalPeriod(ending) + '; ' + clause + '.'
}

// Rotate independent scene beats by the complete story identity. Repeated
// matchups keep a stable report, while different factions, roles and incident
// choices do not all march through the same hero/defender/hero sentence shape.
function arrangeBeats(first: string, beats: readonly [string, string, string], variant: number): string {
  const orders = [[0, 1, 2], [1, 2, 0], [0, 2, 1], [2, 0, 1]] as const
  return [first, ...orders[variant].map((index) => beats[index])].join(' ')
}

function arrangeClose(turn: string, heroAction: string, status: string, response: string, variant: number): string {
  return arrangeBeats(turn, [heroAction, status, response], variant)
}

function arrangeOpening(opening: string, hero: string, opponent: string, stakes: string, variant: number): string {
  const orders = [[hero, opponent, stakes], [opponent, hero, stakes],
    [hero, stakes, opponent], [opponent, stakes, hero]]
  return [opening, ...orders[variant]].join(' ')
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
  sceneTags?: Partial<AreaStoryTags>,
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
  const scenario = SOURCED_STORY_SCENARIOS[canonical]
  if (!scenario) return null
  if (sceneTags && canonical !== 'Area of Interest') return null
  const seed = scenario.incidents[stableHash(key + ':' + String(gameId)) % scenario.incidents.length]
  const variant = stableHash(key + ':' + String(gameId) + ':' + hero.id + ':' + role + ':prose') % 4
  if (canonical === 'Area of Interest') {
    const requestedWeather = sceneTags?.weather
    const locationIds = (Object.keys(AREA_LOCATIONS) as AreaStoryTags['location'][]).filter((id) =>
      !requestedWeather || (AREA_LOCATIONS[id].allowedWeather as readonly string[]).includes(requestedWeather))
    if (!locationIds.length) return null
    const locationId = sceneTags?.location ?? locationIds[stableHash(key + ':' + String(gameId) + ':location') % locationIds.length]
    if (!Object.hasOwn(AREA_LOCATIONS, locationId)) return null
    const location = AREA_LOCATIONS[locationId]
    const weatherIds = location.allowedWeather as readonly AreaStoryTags['weather'][]
    const weatherId = sceneTags?.weather ?? weatherIds[stableHash(key + ':' + String(gameId) + ':weather') % weatherIds.length]
    if (!Object.hasOwn(AREA_WEATHER, weatherId) || !weatherIds.includes(weatherId)) return null
    const weather = AREA_WEATHER[weatherId]
    const method = AREA_ARMY_METHODS[hero.id]
    const response = AREA_ARMY_METHODS[opponent.id]
    if (!method || !response) return null
    const heroAction = role === 'objective' ? seed.objectiveAction : role === 'gunfighting'
      ? areaRoleActions[heroVoice.style].gunfighting
      : areaRoleActions[heroVoice.style].closeCombat
    const heroMove = '{{heroPlayer}}’s ' + heroVoice.crew + ' ' +
      tactics[heroVoice.style].approach + ' ' + location.approach + '.'
    const otherMove = '{{otherPlayer}}’s ' + otherVoice.crew + ' ' +
      tactics[otherVoice.style].defense + ' ' + location.position + '.'
    return {
      mission: canonical, factions: [first.name, second.name], heroFaction: hero.name, role,
      sceneTags: { location: locationId, weather: weatherId },
      paragraphs: [
        [location.arrival, weather.opening, ...(
          variant % 2 ? [otherMove, heroMove] : [heroMove, otherMove]
        ), seed.opening].join(' '),
        arrangeBeats(seed.complication, [weather.complication, method.initiative, response.response], variant),
        arrangeClose(seed.turn, '{{hero}} ' + heroAction + '.', location.signal,
          method.followThrough, variant) + ' ' + weather.closing,
      ],
      endings: {
        heroWins: '{{heroPlayer}}’s squad ' + method.winBeat +
          ', bringing the communication antenna online with ' + location.scoringGround + ' under its control.',
        heroLoses: '{{otherPlayer}}’s squad ' + response.winBeat +
          ', bringing the communication antenna online with ' + location.scoringGround +
          ' under its control as {{heroPlayer}} fell back to ' + location.retreat + '.',
        draw: hero.id === opponent.id
          ? 'Both crews ' + method.drawBeat + ', leaving neither in control of the communication antenna and ' + location.scoringGround + '.'
          : '{{heroPlayer}}’s crew ' + method.drawBeat + ' while {{otherPlayer}}’s crew ' + response.drawBeat +
            ', leaving neither in control of the communication antenna and ' + location.scoringGround + '.',
      },
    }
  }
  const heroAction = role === 'objective'
    ? seed.objectiveAction
    : role === 'gunfighting'
      ? scenario.gunfighting
      : scenario.closeCombat
  const method = MISSION_ARMY_METHODS[hero.id]
  const response = MISSION_ARMY_METHODS[opponent.id]
  if (!method || !response) return null
  const drawnMission = withoutFinalPeriod(scenario.endings.draw)
  const draw = hero.id === opponent.id
    ? 'Both crews ' + method.drawBeat + '; ' + drawnMission[0].toLowerCase() + drawnMission.slice(1) + '.'
    : '{{heroPlayer}}’s crew ' + method.drawBeat + ' while {{otherPlayer}}’s crew ' + response.drawBeat +
      '; ' + drawnMission[0].toLowerCase() + drawnMission.slice(1) + '.'

  const heroMove = '{{heroPlayer}}’s ' + heroVoice.crew + ' ' + tactics[heroVoice.style].approach +
    ' ' + scenario.ground + '.'
  const otherMove = '{{otherPlayer}}’s ' + otherVoice.crew + ' ' +
    tactics[otherVoice.style].defense + ' ' + scenario.position + '.'

  return {
    mission: canonical,
    factions: [first.name, second.name],
    heroFaction: hero.name,
    role,
    paragraphs: [
      arrangeOpening(seed.opening, heroMove, otherMove, scenario.stakes, variant),
      arrangeBeats(seed.complication, [scenario.crossfire, method.maneuver, response.defense], variant),
      arrangeClose(seed.turn, '{{hero}} ' + heroAction + '.', scenario.afterAction,
        method.followThrough, variant),
    ],
    endings: {
      heroWins: continueEnding(scenario.endings.heroWins, method.winClause),
      heroLoses: continueEnding(scenario.endings.heroLoses, response.winClause),
      draw,
    },
  }
}

export function renderGeneratedGameStory(game: RecentGame, lists: ArmyIntelligenceList[]): string | null {
  const key = storyTemplateKey(game.mission, game.winnerFaction, game.loserFaction)
  if (!key) return null
  // Attacker/defender assignment and selected mode are not in the public
  // record. Do not invent either side's objective in these two missions.
  const canonical = getCanonicalMissionName(game.mission)
  if (!canonical || SOURCED_STORY_SCENARIOS[canonical]?.requiresUnreportedSetup) return null
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
