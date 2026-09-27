import { CANONICAL_ARMY_REGISTRY } from '../config/armies.ts'
import { CANONICAL_MISSIONS, getCanonicalMissionName } from '../config/missions.ts'
import { ARMY_STORY_VOICES } from '../data/generatedStoryArmies.ts'
import type { ArmyStoryStyle } from '../data/generatedStoryArmies.ts'
import { AREA_ARMY_METHODS } from '../data/generatedStoryAreaArmies.ts'
import { INCIDENT_EDITORIAL_BEATS } from '../data/generatedStoryEditorialBeats.ts'
import { MISSION_ARMY_ALTERNATE_MANEUVERS, MISSION_ARMY_METHODS,
  MISSION_ARMY_PIVOT_MANEUVERS } from '../data/generatedStoryMissionArmies.ts'
import { MISSION_ARMY_CLOSE_ALTERNATES } from '../data/generatedStoryMissionClosings.ts'
import { MISSION_ROLE_ALTERNATES } from '../data/generatedStoryRoleAlternates.ts'
import { MISSION_TACTICAL_REFERENTS } from '../data/generatedStoryTacticalReferents.ts'
import { INCIDENT_CONSEQUENCES, INCIDENT_CROSSFIRE, INCIDENT_STAKES } from '../data/generatedStoryIncidentBeats.ts'
import { SOURCED_STORY_SCENARIOS } from '../data/generatedStoryScenarios.ts'
import { AREA_LOCATION_ALTERNATES, AREA_LOCATION_EARLY, AREA_LOCATION_LATE, AREA_LOCATIONS,
  AREA_WEATHER, AREA_WEATHER_ALTERNATES, AREA_WEATHER_EARLY,
  AREA_WEATHER_LATE } from '../data/generatedStorySettings.ts'
import type { AreaStoryTags } from '../data/generatedStorySettings.ts'
import type { ArmyIntelligenceList, RecentGame } from './api.ts'
import { renderGameStoryTemplate, storyTemplateKey } from './gameStoryTemplate.ts'
import type { GameStoryTemplate, HeroRole } from './gameStoryTemplate.ts'

// The September 24 hotfix does not include an effective hour or prior-edition
// rules in the public feed. Withhold ambiguous same-day and earlier reports
// rather than narrating them under the revised Dig/Crossing Lines premises.
export function hasUnsupportedStoryMissionVersion(game: RecentGame): boolean {
  const mission = getCanonicalMissionName(game.mission)
  if (mission !== 'The Dig' && mission !== 'Crossing Lines' && mission !== 'Double Bind') return false
  const day = /^\d{4}-\d{2}-\d{2}/.exec(String(game.date || ''))?.[0]
  return !day || day < '2026-09-25'
}

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

// The Area of Interest openings describe a particular site. Other missions
// rotate several ways of approaching or guarding it so a recurring army does
// not enter every report with the same sentence and a new objective noun.
const missionIntroAlternates: Record<ArmyStoryStyle,
  { approach: readonly [string, string, string]; defense: readonly [string, string, string] }> = {
  assault: {
    approach: ['advanced in short rushes toward', 'broke from forward cover toward', 'pressed through incoming fire toward'],
    defense: ['contested the lane beside', 'positioned a forward guard near', 'kept fire trained on'],
  },
  armored: {
    approach: ['kept an armored escort moving toward', 'crossed the exposed lane under fire toward', 'moved behind their lead armor toward'],
    defense: ['anchored their forward guard near', 'sheltered their watch behind', 'held an armored screen by'],
  },
  flanking: {
    approach: ['probed a side route toward', 'traced a sheltered path toward', 'found a screened angle toward'],
    defense: ['held the side approach near', 'kept a scout watching', 'repositioned a guard near'],
  },
  guard: {
    approach: ['kept ranks while advancing toward', 'sent a guarded lead toward', 'crossed in an orderly line toward'],
    defense: ['held the approach to', 'set a watch over', 'kept fighters at the edge of'],
  },
  rescue: {
    approach: ['made space for an escort approaching', 'sent a relief pair toward', 'protected a return route from'],
    defense: ['posted an escort near', 'covered a return lane from', 'held a relief team behind'],
  },
  covert: {
    approach: ['approached unseen behind', 'tested an unguarded line toward', 'sent a quiet lead past cover near'],
    defense: ['observed the approach to', 'hid a guard near', 'kept sight of the route past'],
  },
  technical: {
    approach: ['mapped a covered approach to', 'sent an observer ahead toward', 'measured the crossing into'],
    defense: ['placed a watch over', 'kept an operator watching', 'checked for movement beside'],
  },
  contract: {
    approach: ['sent a paid guard ahead toward', 'advanced behind a hired gun toward', 'shifted their escort toward'],
    defense: ['kept a guard on', 'held a firing angle over', 'kept the return lane beside'],
  },
}

function missionIntro(style: ArmyStoryStyle, side: 'approach' | 'defense', index: number): string {
  return index === 0 ? tactics[style][side] : missionIntroAlternates[style][side][index - 1]
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

function incidentFirstEnding(ending: string, incident: string, clause: string): string {
  const start = incident.charAt(0).toUpperCase() + incident.slice(1)
  // The incident has already named the winning crew. Refer back to it rather
  // than saying the player's name twice across the semicolon.
  const result = withoutFinalPeriod(ending)
    .replace(/^\{\{(?:heroPlayer|otherPlayer)\}\}’s (crew|squad|force|fighters)\b/,
      (_, group: string) => group === 'fighters' ? 'those fighters' : 'that ' + group)
    .replace(/^[A-Z]/, (letter) => letter.toLowerCase())
  return start + '; ' + result + ' while ' + clause + '.'
}

// Rotate independent scene beats by the complete story identity. Repeated
// matchups keep a stable report, while different factions, roles and incident
// choices do not all march through the same hero/defender/hero sentence shape.
function arrangeBeats(first: string, beats: readonly [string, string, string], variant: number): string {
  const orders = [[0, 1, 2], [1, 2, 0], [0, 2, 1], [2, 0, 1]] as const
  return [first, ...orders[variant].map((index) => beats[index])].join(' ')
}

function arrangeClose(turn: string, heroAction: string, status: string, response: string): string {
  // The incident opens access; the hero acts; only then does the scene react.
  // Permuting these sentences made consequences precede their causes.
  return [turn, heroAction, status, response].join(' ')
}

function arrangeOpening(opening: string, hero: string, opponent: string, stakes: string, variant: number): string {
  const orders = [[hero, opponent, stakes], [opponent, hero, stakes],
    [hero, stakes, opponent], [opponent, stakes, hero]]
  return [opening, ...orders[variant]].join(' ')
}

// The review packet expands these to two-word stand-ins. Count that visible
// text before choosing a beat, not just the one-word template tokens.
function previewWords(paragraph: string): number {
  return paragraph.replaceAll('{{heroPlayer}}', 'Player A')
    .replaceAll('{{otherPlayer}}', 'Player B')
    .replaceAll('{{hero}}', 'the operative').trim().split(/\s+/).length
}

// A real unnamed model can render as "the Test Trooper" or a longer unit
// name. Leave room beyond the two-word review stand-in for that identity.
const fitsPreview = (paragraph: string) => previewWords(paragraph) <=
  (paragraph.includes('{{hero}}') ? 72 : 75)

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
  const incidentIndex = stableHash(key + ':' + String(gameId)) % scenario.incidents.length
  const seed = scenario.incidents[incidentIndex]
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
    const weather = incidentIndex === 3 ? AREA_WEATHER_LATE[weatherId]
      : incidentIndex === 2 ? AREA_WEATHER_ALTERNATES[weatherId]
        : incidentIndex === 1 ? AREA_WEATHER_EARLY[weatherId] : AREA_WEATHER[weatherId]
    const setting = incidentIndex === 3 ? AREA_LOCATION_LATE[locationId]
      : incidentIndex === 2 ? AREA_LOCATION_ALTERNATES[locationId]
        : incidentIndex === 1 ? AREA_LOCATION_EARLY[locationId] : location
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
        [setting.arrival, weather.opening, ...(
          variant % 2 ? [otherMove, heroMove] : [heroMove, otherMove]
        ), seed.opening].join(' '),
        arrangeBeats(seed.complication, [weather.complication, method.initiative, response.response], variant),
        arrangeClose(seed.turn, '{{hero}} ' + heroAction + '.', setting.signal,
          method.followThrough) + ' ' + weather.closing,
      ],
      endings: {
        heroWins: '{{heroPlayer}}’s squad ' + method.winBeat +
          ', taking the lead in the contest for the communication antenna and ' + location.scoringGround + '.',
        heroLoses: '{{otherPlayer}}’s squad ' + response.winBeat +
          ', taking the lead over {{heroPlayer}} in the contest for the communication antenna and ' + location.scoringGround + '.',
        draw: hero.id === opponent.id
          ? 'Each crew ' + method.drawBeat + ', with neither ahead in the contest for the communication antenna and ' + location.scoringGround + '.'
          : '{{heroPlayer}}’s crew ' + method.drawBeat + ' while {{otherPlayer}}’s crew ' + response.drawBeat +
            ', leaving neither ahead in the contest for the communication antenna and ' + location.scoringGround + '.',
      },
    }
  }
  const alternateRoleAction = MISSION_ROLE_ALTERNATES[canonical as keyof typeof MISSION_ROLE_ALTERNATES]
  if (!alternateRoleAction) throw new Error('Missing role alternates for ' + canonical)
  const heroAction = role === 'objective'
    ? seed.objectiveAction
    : incidentIndex >= 2
      ? alternateRoleAction[role]
      : scenario[role]
  const method = MISSION_ARMY_METHODS[hero.id]
  const response = MISSION_ARMY_METHODS[opponent.id]
  const alternateManeuver = MISSION_ARMY_ALTERNATE_MANEUVERS[hero.id]
  const heroPivots = MISSION_ARMY_PIVOT_MANEUVERS[hero.id]
  const closeAlternates = MISSION_ARMY_CLOSE_ALTERNATES[hero.id]
  if (!method || !response || !alternateManeuver || !heroPivots || !closeAlternates) return null
  const referents = MISSION_TACTICAL_REFERENTS[canonical as keyof typeof MISSION_TACTICAL_REFERENTS]
  if (!referents) throw new Error('Missing tactical referents for ' + canonical)
  const consequence = INCIDENT_CONSEQUENCES[canonical as keyof typeof INCIDENT_CONSEQUENCES]?.[incidentIndex]
  const crossfire = INCIDENT_CROSSFIRE[canonical as keyof typeof INCIDENT_CROSSFIRE]?.[incidentIndex]
  const stakes = INCIDENT_STAKES[canonical as keyof typeof INCIDENT_STAKES]?.[incidentIndex]
  const editorial = INCIDENT_EDITORIAL_BEATS[canonical as keyof typeof INCIDENT_EDITORIAL_BEATS]?.[incidentIndex]
  if (!consequence || !crossfire || !stakes || !editorial) {
    throw new Error('Missing incident beats for ' + canonical + ' #' + incidentIndex)
  }

  // The incident names the full objective; these shorter references let the
  // opposing army's counter answer a specific part of the same scene.
  const ground = seed.ground ?? scenario.ground
  const position = seed.position ?? scenario.position
  const situate = (beat: string, focus: string, distraction: string) =>
    beat.replaceAll('{ground}', focus).replaceAll('{position}', distraction)
  const opposingPivots = MISSION_ARMY_PIVOT_MANEUVERS[opponent.id]
  const opposingShortMoves = MISSION_ARMY_CLOSE_ALTERNATES[opponent.id]
  if (!opposingPivots || !opposingShortMoves) {
    throw new Error('Missing tactical choices for ' + hero.id + ' / ' + opponent.id)
  }
  // The second crew can counterattack or change its watch instead of always
  // reciting the same static defense. Mirror matchups use a different choice
  // for each side so one scene does not repeat the same tactical sentence.
  // In a mirror the same follow-through can also close the hero's paragraph.
  // Keep that sentence out of the opposing response to avoid echoing it; the
  // short moves can counter here but cannot recur in the close of that scene.
  const counters = hero.id === opponent.id
    ? [response.defense, ...opposingPivots, ...opposingShortMoves]
    : [response.defense, ...opposingPivots, response.followThrough, ...opposingShortMoves]
  const counterIndex = (CANONICAL_MISSIONS.indexOf(canonical) + incidentIndex * 2 + 2) % counters.length
  const orderedCounters = counters.slice(counterIndex).concat(counters.slice(0, counterIndex))
  // These shorter, faction-specific decisions also work while the crew is
  // fighting for access. Six choices spread a force's recurring tactic across
  // the campaign; never repeat one in the same scene's closing paragraph.
  const maneuvers = [method.maneuver, alternateManeuver, ...heroPivots, ...closeAlternates]
  const maneuverIndex = (CANONICAL_MISSIONS.indexOf(canonical) + incidentIndex + stableHash(hero.id)) % maneuvers.length
  const orderedManeuvers = maneuvers.slice(maneuverIndex).concat(maneuvers.slice(0, maneuverIndex))
  const middle = (maneuver: string, counter: string | null, withCrossfire: boolean) => {
    const armyMove = situate(maneuver, referents.advance, referents.defend)
    const reply = counter ? situate(counter, referents.advance, referents.defend) : null
    return [seed.complication, ...(withCrossfire ? [crossfire] : []),
      ...(reply ? variant % 2 ? [reply, armyMove] : [armyMove, reply] : [armyMove]),
      '{{heroPlayer}}’s ' + heroVoice.crew + ' ' + editorial.move].join(' ')
  }
  // Preserve the incident's chosen faction decision. If it is long, omit a
  // counter before falling back to a different maneuver for this incident.
  const candidates = (maneuver: string) => {
    const replies = orderedCounters.filter((counter) => hero.id !== opponent.id || counter !== maneuver)
    return [...replies.map((counter) => middle(maneuver, counter, true)),
      ...replies.map((counter) => middle(maneuver, counter, false)),
      middle(maneuver, null, true), middle(maneuver, null, false)]
  }
  const incidentMiddle = orderedManeuvers.flatMap(candidates).find(fitsPreview)
  if (!incidentMiddle) throw new Error('No readable faction tactic for ' + canonical + ' #' + incidentIndex)
  const followChoices = [method.followThrough, ...closeAlternates].filter((follow) =>
    !incidentMiddle.includes(situate(follow, referents.advance, referents.defend)))
  const followIndex = (CANONICAL_MISSIONS.indexOf(canonical) + incidentIndex +
    stableHash(hero.id + ':' + role)) % followChoices.length
  const orderedFollowChoices = followChoices.slice(followIndex).concat(followChoices.slice(0, followIndex))
  const incidentClose = [
    ...orderedFollowChoices.map((follow) => arrangeClose(seed.turn, '{{hero}} ' + heroAction + '.', consequence,
      editorial.aftermath + ' ' + situate(follow, referents.advance, referents.defend))),
    arrangeClose(seed.turn, '{{hero}} ' + heroAction + '.', consequence,
      editorial.aftermath + ' {{heroPlayer}}’s crew ' + method.drawBeat +
        ' near ' + referents.continuation + '.'),
    arrangeClose(seed.turn, '{{hero}} ' + heroAction + '.', consequence,
      editorial.aftermath.slice(0, -1) + '; {{heroPlayer}}’s crew ' + method.drawBeat + '.'),
  ].find(fitsPreview)
  if (!incidentClose) throw new Error('No readable faction follow-through for ' + canonical + ' #' + incidentIndex)
  const missionIndex = CANONICAL_MISSIONS.indexOf(canonical)
  const heroIntro = (missionIndex + incidentIndex + stableHash(hero.id + ':' + role)) % 4
  const otherIntro = (missionIndex + incidentIndex + stableHash(opponent.id + ':defense')) % 4
  const heroMove = '{{heroPlayer}}’s ' + heroVoice.crew + ' ' + missionIntro(heroVoice.style, 'approach', heroIntro) +
    ' ' + ground + '.'
  const otherMove = '{{otherPlayer}}’s ' + otherVoice.crew + ' ' +
    missionIntro(otherVoice.style, 'defense', otherIntro) + ' ' + position + '.'

  const winnerBeat = editorial.winner.replaceAll('{winner}', '{{heroPlayer}}’s crew')
  const loserBeat = editorial.winner.replaceAll('{winner}', '{{otherPlayer}}’s crew')
  const drawBeat = editorial.draw + (hero.id === opponent.id
    ? ' while each crew ' + method.drawBeat
    : ' while {{heroPlayer}}’s crew ' + method.drawBeat +
      ' and {{otherPlayer}}’s crew ' + response.drawBeat)
  // Starting with the incident on alternating plots prevents all encounters
  // in one mission from repeating the same result lead-in. Keep the original
  // mission claim in every ending; only the recorded winner selects a result.
  const incidentLead = incidentIndex % 2 === 0

  return {
    mission: canonical,
    factions: [first.name, second.name],
    heroFaction: hero.name,
    role,
    objectiveSkill: scenario.objectiveSkill,
    paragraphs: [
      arrangeOpening(seed.opening, heroMove, otherMove, stakes, variant),
      incidentMiddle,
      incidentClose,
    ],
    endings: {
      heroWins: incidentLead
        ? incidentFirstEnding(scenario.endings.heroWins, winnerBeat, method.winClause)
        : continueEnding(scenario.endings.heroWins, winnerBeat + ', while ' + method.winClause),
      heroLoses: incidentLead
        ? incidentFirstEnding(scenario.endings.heroLoses, loserBeat, response.winClause)
        : continueEnding(scenario.endings.heroLoses, loserBeat + ', while ' + response.winClause),
      draw: incidentLead
        ? incidentFirstEnding(scenario.endings.draw, editorial.draw,
          hero.id === opponent.id ? 'each crew ' + method.drawBeat
            : '{{heroPlayer}}’s crew ' + method.drawBeat + ' and {{otherPlayer}}’s crew ' + response.drawBeat)
        : continueEnding(scenario.endings.draw, drawBeat),
    },
  }
}

export function renderGeneratedGameStory(game: RecentGame, lists: ArmyIntelligenceList[]): string | null {
  const key = storyTemplateKey(game.mission, game.winnerFaction, game.loserFaction)
  if (!key || hasUnsupportedStoryMissionVersion(game)) return null
  // Common Classified cards, attacker assignment, and selected objective
  // mode are absent from public games for three respective missions.
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
  const mirrorSides: Array<0 | 1> = [0, 1]
  for (const role of orderedRoles) {
    for (const faction of orderedFactions) {
      const template = composeGameStory(game.mission, first.name, second.name, faction, role, gameId)
      if (!template) continue
      for (const side of first.id === second.id ? mirrorSides : [undefined]) {
        const rendered = renderGameStoryTemplate(template, game, lists, side)
        if (rendered) return rendered
      }
    }
  }
  return null
}
