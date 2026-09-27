import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { ARMY_STORY_VOICES } from '../src/data/generatedStoryArmies.ts'
import { AREA_ARMY_METHODS } from '../src/data/generatedStoryAreaArmies.ts'
import { MISSION_ARMY_METHODS } from '../src/data/generatedStoryMissionArmies.ts'
import { SOURCED_STORY_SCENARIOS } from '../src/data/generatedStoryScenarios.ts'
import { AREA_LOCATIONS, AREA_WEATHER } from '../src/data/generatedStorySettings.ts'
import { GAME_STORY_CATALOG } from '../src/data/gameStoryCatalog.ts'
import { composeGameStory, renderGeneratedGameStory } from '../src/services/generatedGameStory.ts'
import { loadAuthoredBattleStory, MISSING_MISSION_SETUP_BATTLE_STORY, PENDING_BATTLE_STORY } from '../src/services/gameStoryRouting.ts'
import { renderGameStoryTemplate, storyTemplateKey } from '../src/services/gameStoryTemplate.ts'
import type { ArmyIntelligenceList, RecentGame } from '../src/services/api.ts'
import { assertGameStoryQuality } from './game-story-quality.mts'

const armies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
assert.equal(armies.length, 45)
assert.equal(CANONICAL_MISSIONS.length, 22)
assert.deepEqual(Object.keys(ARMY_STORY_VOICES).sort(), armies.map((army) => army.id).sort())
assert.deepEqual(Object.keys(AREA_ARMY_METHODS).sort(), armies.map((army) => army.id).sort())
assert.deepEqual(Object.keys(MISSION_ARMY_METHODS).sort(), armies.map((army) => army.id).sort())
for (const field of ['initiative', 'response', 'followThrough', 'winBeat', 'drawBeat'] as const) {
  assert.equal(new Set(Object.values(AREA_ARMY_METHODS).map((method) => method[field])).size,
    armies.length, `Area of Interest ${field} must distinguish all active armies`)
}
for (const field of ['maneuver', 'defense', 'followThrough', 'winClause', 'drawBeat'] as const) {
  assert.equal(new Set(Object.values(MISSION_ARMY_METHODS).map((method) => method[field])).size,
    armies.length, `other missions' ${field} must distinguish all active armies`)
}
assert.deepEqual(Object.keys(SOURCED_STORY_SCENARIOS).sort(), [...CANONICAL_MISSIONS].sort())
for (const [mission, scenario] of Object.entries(SOURCED_STORY_SCENARIOS)) {
  assert.ok(scenario)
  assert.match(scenario.source, /^https:\/\/infinitygeist\.com\/mission\//)
  assert.equal(scenario.incidents.length, 4, mission + ': four incidents')
  assert.equal(new Set(scenario.incidents.map((seed) => seed.opening)).size, 4, mission + ': distinct openings')
  assert.equal(new Set(scenario.incidents.map((seed) => seed.complication)).size, 4, mission + ': distinct complications')
  for (const seed of scenario.incidents) {
    assert.match(seed.objectiveAction, scenario.anchor, mission + ': action must name a mission objective')
  }
}

const seen = new Set<string>()
const scenes = new Set<string>()
let covered = 0
for (const mission of CANONICAL_MISSIONS) {
  for (let i = 0; i < armies.length; i++) {
    for (let j = i; j < armies.length; j++) {
      const key = storyTemplateKey(mission, armies[i].name, armies[j].name)
      assert.equal(key, storyTemplateKey(mission, armies[j].name, armies[i].name))
      assert.ok(key && !seen.has(key))
      seen.add(key)
      const incidents = new Set<string>()
      for (const role of ['objective', 'gunfighting', 'closeCombat'] as const) {
        // Each of the four complete incidents must pass the existing
        // structural gate; this does not establish editorial originality.
        for (const gameId of [0, 1, 2, 3]) {
          const story = composeGameStory(mission, armies[i].name, armies[j].name, armies[i].name, role, gameId)
          assert.ok(story, key + ': no generated story')
          assertGameStoryQuality(story, key)
          if (role === 'objective') incidents.add(story.paragraphs[1])
          if (role === 'objective' && gameId === 0) {
            const scene = story.paragraphs.join(' ').replaceAll(/\{\{\w+\}\}/g, 'HERO')
            assert.ok(!scenes.has(scene), key + ': duplicate full scene')
            scenes.add(scene)
          }
          assert.deepEqual(story, composeGameStory(mission, armies[j].name, armies[i].name, armies[i].name, role, gameId))
        }
      }
      assert.equal(incidents.size, 4, key + ': incident coverage')
      covered++
    }
  }
}
assert.equal(covered, 22770)
assert.equal(scenes.size, covered)
assert.equal(composeGameStory('Unknown mission', 'PanOceania', 'Druze Bayram Security', 'PanOceania', 'objective'), null)
assert.equal(composeGameStory('The Dig', 'PanOceania', 'Druze Bayram Security', 'Hassassin Bahram', 'objective'), null)
for (const gameId of [0, 1]) {
  const court = composeGameStory('B-Pong', 'Nomads', 'Military Orders', 'Nomads', 'objective', gameId)
  assert.ok(court)
  assert.match(court.paragraphs.join(' '), /tracking beacon/i)
  assert.match(court.paragraphs.join(' '), /console/i)
  assert.doesNotMatch(court.paragraphs.join(' '), /network trace|cargo markings|gantry/i,
    'army tactics must belong to the beacon scenario rather than a different mission')
}

for (const role of ['objective', 'gunfighting', 'closeCombat'] as const) {
  for (const gameId of [0, 1, 2, 3]) {
    const scene = composeGameStory('Area of Interest', 'Next Wave', 'Tohaa', 'Next Wave', role, gameId)
    assert.ok(scene)
    assert.equal(scene.heroFaction, 'Next Wave')
    assert.doesNotMatch(scene.paragraphs.join(' '), /area of interest/i,
      'mission names belong in headings, not repeated in the prose')
    assert.match(scene.paragraphs.join(' '), /antenna|relay/i)
  }
}

// Setting tags have plot consequences, and reversing these two factions
// changes both the contest and its immediate aftermath, not just the names.
assert.deepEqual(Object.keys(AREA_WEATHER).sort(), ['crosswind', 'fog', 'none', 'rain', 'snow'])
assert.deepEqual(Object.keys(AREA_LOCATIONS).sort(),
  ['desert', 'forest', 'freightDepot', 'jungle', 'mountain', 'relayCourtyard', 'rooftopTerrace'])
// A fixed incident and setting isolate the faction layer: every army has a
// different maneuver, defense, continuation, and outcome at the same relay.
const tohaaArmy = armies.find((army) => army.id === 'tohaa')
assert.ok(tohaaArmy)
const draws = new Set<string>()
for (const opponent of armies) {
  const tags = { location: 'forest', weather: 'none' } as const
  const first = composeGameStory('Area of Interest', tohaaArmy.name, opponent.name,
    tohaaArmy.name, 'objective', 0, tags)
  assert.ok(first)
  assertGameStoryQuality(first, `Area of Interest: Tohaa / ${opponent.name}`)
  assert.ok(first.paragraphs[1].includes(AREA_ARMY_METHODS.tohaa.initiative))
  assert.ok(first.paragraphs[1].includes(AREA_ARMY_METHODS[opponent.id].response))
  assert.ok(first.paragraphs[2].includes(AREA_ARMY_METHODS.tohaa.followThrough))
  assert.ok(first.endings.heroWins.includes(AREA_ARMY_METHODS.tohaa.winBeat))
  assert.ok(first.endings.draw.includes(AREA_ARMY_METHODS.tohaa.drawBeat))
  draws.add(first.endings.draw)
  if (opponent.id === 'tohaa') continue
  assert.ok(first.endings.draw.includes(AREA_ARMY_METHODS[opponent.id].drawBeat))
  const reversed = composeGameStory('Area of Interest', opponent.name, tohaaArmy.name,
    opponent.name, 'objective', 0, tags)
  assert.ok(reversed)
  assertGameStoryQuality(reversed, `Area of Interest: ${opponent.name} / Tohaa`)
  assert.notEqual(first.paragraphs[1], reversed.paragraphs[1], `${opponent.name}: distinct contest on reversal`)
  assert.notEqual(first.paragraphs[2], reversed.paragraphs[2], `${opponent.name}: distinct continuation on reversal`)
  assert.notEqual(first.endings.draw, reversed.endings.draw, `${opponent.name}: draw reflects direction`)
}
assert.equal(draws.size, armies.length, 'the same location and incident yield faction-specific draws')

// Every other mission retains its own incident and objective, but the side
// that leads changes the middle, continuation, and all three endings.
for (const mission of CANONICAL_MISSIONS.filter((name) => name !== 'Area of Interest')) {
  const scenario = SOURCED_STORY_SCENARIOS[mission]
  assert.ok(scenario)
  for (const opponent of armies) {
    const tohaa = composeGameStory(mission, tohaaArmy.name, opponent.name,
      tohaaArmy.name, 'objective', 0)
    assert.ok(tohaa)
    assertGameStoryQuality(tohaa, `${mission}: Tohaa / ${opponent.name}`)
    assert.ok(tohaa.paragraphs[1].includes(MISSION_ARMY_METHODS.tohaa.maneuver))
    assert.ok(tohaa.paragraphs[1].includes(MISSION_ARMY_METHODS[opponent.id].defense))
    assert.ok(tohaa.paragraphs[2].includes(MISSION_ARMY_METHODS.tohaa.followThrough))
    assert.match(tohaa.paragraphs.join(' '), scenario.anchor)
    assert.ok(tohaa.endings.heroWins.includes(MISSION_ARMY_METHODS.tohaa.winClause))
    assert.ok(tohaa.endings.heroLoses.includes(MISSION_ARMY_METHODS[opponent.id].winClause))
    assert.ok(tohaa.endings.draw.includes(MISSION_ARMY_METHODS.tohaa.drawBeat))
    const missionDraw = scenario.endings.draw.slice(0, -1)
    assert.ok(tohaa.endings.draw.includes(missionDraw[0].toLowerCase() + missionDraw.slice(1)))
    if (opponent.id === 'tohaa') continue
    assert.ok(tohaa.endings.draw.includes(MISSION_ARMY_METHODS[opponent.id].drawBeat))
    const reversed = composeGameStory(mission, tohaaArmy.name, opponent.name,
      opponent.name, 'objective', 0)
    assert.ok(reversed)
    assertGameStoryQuality(reversed, `${mission}: ${opponent.name} / Tohaa`)
    assert.notEqual(tohaa.paragraphs[1], reversed.paragraphs[1])
    assert.notEqual(tohaa.paragraphs[2], reversed.paragraphs[2])
    assert.notEqual(tohaa.endings.heroWins, reversed.endings.heroWins)
    assert.notEqual(tohaa.endings.heroLoses, reversed.endings.heroLoses)
    assert.notEqual(tohaa.endings.draw, reversed.endings.draw)
  }
}
for (const location of Object.keys(AREA_LOCATIONS) as (keyof typeof AREA_LOCATIONS)[]) {
  for (const weather of Object.keys(AREA_WEATHER) as (keyof typeof AREA_WEATHER)[]) {
    const tags = { location, weather }
    if (!(AREA_LOCATIONS[location].allowedWeather as readonly string[]).includes(weather)) {
      assert.equal(composeGameStory('Area of Interest', 'Tohaa', 'Next Wave', 'Tohaa', 'objective', 0, tags), null,
        `${location} must reject incompatible ${weather}`)
      continue
    }
    for (const role of ['objective', 'gunfighting', 'closeCombat'] as const) {
      for (const gameId of [0, 1, 2, 3]) {
        const tohaa = composeGameStory('Area of Interest', 'Tohaa', 'Next Wave', 'Tohaa', role, gameId, tags)
        const nextWave = composeGameStory('Area of Interest', 'Next Wave', 'Tohaa', 'Next Wave', role, gameId, tags)
        assert.ok(tohaa && nextWave)
        for (const story of [tohaa, nextWave]) {
          assert.deepEqual(story.sceneTags, tags)
          assertGameStoryQuality(story, storyTemplateKey(story.mission, ...story.factions) ?? '')
          assert.ok(story.paragraphs[0].includes(AREA_LOCATIONS[location].arrival))
          assert.ok(story.paragraphs[0].includes(AREA_WEATHER[weather].opening))
          assert.ok(story.paragraphs[1].includes(AREA_WEATHER[weather].complication))
          assert.ok(story.paragraphs[2].includes(AREA_WEATHER[weather].closing))
          assert.ok(story.endings.heroWins.includes(AREA_LOCATIONS[location].scoringGround))
          if (weather === 'none') assert.doesNotMatch(story.paragraphs.join(' '),
            /\b(?:rain|snow|fog|mist|wind|gusts|ice)\b/i, 'no-weather tag must not imply weather effects')
        }
        assert.notEqual(tohaa.paragraphs[1], nextWave.paragraphs[1], 'faction reversal must change the contest')
        assert.notEqual(tohaa.paragraphs[2], nextWave.paragraphs[2], 'faction reversal must change the aftermath')
      }
    }
  }
}
for (const location of Object.keys(AREA_LOCATIONS) as (keyof typeof AREA_LOCATIONS)[]) {
  for (let gameId = 0; gameId < 32; gameId++) {
    const story = composeGameStory('Area of Interest', 'Tohaa', 'Next Wave', 'Tohaa', 'objective', gameId,
      { location })
    assert.ok(story && story.sceneTags)
    assert.ok((AREA_LOCATIONS[location].allowedWeather as readonly string[]).includes(story.sceneTags.weather),
      `automatic weather must fit ${location}`)
  }
}
for (const weather of Object.keys(AREA_WEATHER) as (keyof typeof AREA_WEATHER)[]) {
  for (let gameId = 0; gameId < 32; gameId++) {
    const story = composeGameStory('Area of Interest', 'Tohaa', 'Next Wave', 'Tohaa', 'objective', gameId,
      { weather })
    assert.ok(story && story.sceneTags)
    assert.equal(story.sceneTags.weather, weather)
    assert.ok((AREA_LOCATIONS[story.sceneTags.location as keyof typeof AREA_LOCATIONS]
      .allowedWeather as readonly string[]).includes(weather), `automatic location must allow ${weather}`)
  }
}
assert.equal(composeGameStory('Area of Interest', 'Tohaa', 'Next Wave', 'Tohaa', 'objective', 0,
  { location: 'unknown' as never }), null, 'unknown location is rejected')
assert.equal(composeGameStory('Area of Interest', 'Tohaa', 'Next Wave', 'Tohaa', 'objective', 0,
  { weather: 'unknown' as never }), null, 'unknown weather is rejected')

const game = {
  id: 9081, date: '2026-09-26T12:00:00.000Z', mission: 'B-Pong',
  winner: 'Winner', winnerDisplayName: 'Winner', winnerFaction: 'PanOceania',
  loser: 'Loser', loserDisplayName: 'Loser', loserFaction: 'Druze Bayram Security',
  tp: '5-2', op: '6-3', vp: '150-100', gameResult: 'win',
} as RecentGame
const entry = {
  unit: 'TEST TROOPER', profile: 'TEST TROOPER', canonicalUnitId: 0, combinedId: 'test-1',
  points: 30, specialist: true, hacker: false, engineer: false, doctor: false,
  forwardObserver: false, bs: 13, weapons: ['AP Heavy Machine Gun', 'CC Weapon'],
  skills: ['Martial Arts'], equipment: [],
}
const list = (player: string, opponent: string, sectorial: string): ArmyIntelligenceList => ({
  player, opponent, sectorial, mission: game.mission, date: '2026-09-26',
  status: 'decoded', decoded: { combatGroups: [{ entries: [entry] }] },
}) as ArmyIntelligenceList
const lists = [
  list('Winner', 'Loser', 'PanOceania'),
  list('Loser', 'Winner', 'Druze Bayram Security'),
]
for (const mission of ['Critical Intervention', 'Double Bind']) {
  const setupGame = { ...game, mission } as RecentGame
  const setupLists = lists.map((item) => ({ ...item, mission })) as ArmyIntelligenceList[]
  assert.equal(renderGeneratedGameStory(setupGame, setupLists), null,
    mission + ': do not invent the unreported attacker side or selected mode')
  assert.equal(await loadAuthoredBattleStory(setupGame, setupLists), MISSING_MISSION_SETUP_BATTLE_STORY,
    mission + ': do not falsely tell the player their already linked lists are missing')
}
assert.equal(renderGeneratedGameStory(game, []), null, 'wait for both game-linked decoded lists')
assert.equal(renderGeneratedGameStory(game, [lists[0]]), null)
assert.equal(renderGeneratedGameStory(game, lists.map((item) => ({ ...item, date: '2026-09-27' }))), null,
  'never select a similarly named list from another game day')
assert.equal(renderGeneratedGameStory(game, [...lists, { ...lists[0] }]), null,
  'an ambiguous game-linked list cannot supply a model')
const rendered = renderGeneratedGameStory(game, lists)
assert.ok(rendered && rendered.includes('Winner') && rendered.includes('Loser'))
assert.equal(rendered, renderGeneratedGameStory(game, lists), 'a report must be stable across reloads')
assert.doesNotMatch(rendered, /\{\{\w+\}\}/)
assert.equal((await loadAuthoredBattleStory(game, [lists[0]])), PENDING_BATTLE_STORY)
assert.equal(await loadAuthoredBattleStory(game, lists), rendered, 'a missing mission shard uses the generated story')

const template = composeGameStory(game.mission, game.winnerFaction, game.loserFaction, game.winnerFaction, 'objective', game.id)
assert.ok(template)
const winnerText = renderGameStoryTemplate(template, game, lists)
const loserText = renderGameStoryTemplate(template, {
  ...game, winner: 'Loser', winnerDisplayName: 'Loser', winnerFaction: 'Druze Bayram Security',
  loser: 'Winner', loserDisplayName: 'Winner', loserFaction: 'PanOceania',
} as RecentGame, lists)
const drawText = renderGameStoryTemplate(template, { ...game, gameResult: 'draw' } as RecentGame, lists)
assert.ok(winnerText?.endsWith(template.endings.heroWins
  .replaceAll('{{heroPlayer}}', 'Winner').replaceAll('{{hero}}', 'the Test Trooper')))
assert.ok(loserText?.endsWith(template.endings.heroLoses
  .replaceAll('{{heroPlayer}}', 'Winner').replaceAll('{{otherPlayer}}', 'Loser')))
assert.ok(drawText?.endsWith(template.endings.draw
  .replaceAll('{{heroPlayer}}', 'Winner').replaceAll('{{otherPlayer}}', 'Loser')))

// Exercise every mission incident and role through the real renderer with
// linked synthetic rosters. A structurally valid template may still fail at
// the roster substitution or outcome branch.
let renderedVariants = 0
for (const mission of CANONICAL_MISSIONS) {
  const scenarioGame = { ...game, mission } as RecentGame
  const scenarioLists = lists.map((item) => ({ ...item, mission })) as ArmyIntelligenceList[]
  for (const gameId of [0, 1, 2, 3]) {
    for (const role of ['objective', 'gunfighting', 'closeCombat'] as const) {
      const scenario = composeGameStory(mission, 'PanOceania', 'Druze Bayram Security',
        'PanOceania', role, gameId)
      assert.ok(scenario)
      const outcomes = [
        { game: { ...scenarioGame, id: gameId }, ending: scenario.endings.heroWins },
        { game: {
          ...scenarioGame, id: gameId, winner: 'Loser', winnerDisplayName: 'Loser',
          winnerFaction: 'Druze Bayram Security', loser: 'Winner',
          loserDisplayName: 'Winner', loserFaction: 'PanOceania',
        }, ending: scenario.endings.heroLoses },
        { game: { ...scenarioGame, id: gameId, gameResult: 'draw' }, ending: scenario.endings.draw },
      ]
      for (const { game: outcome, ending } of outcomes) {
        const actual = renderGameStoryTemplate(scenario, outcome as RecentGame, scenarioLists)
        assert.match(actual ?? '', /\b[Tt]he Test Trooper\b/, mission + ': model substitution')
        assert.ok(actual.endsWith(ending.replaceAll('{{heroPlayer}}', 'Winner')
          .replaceAll('{{otherPlayer}}', 'Loser')
          .replaceAll('{{hero}}', 'the Test Trooper')), mission + ': ending selection')
        assert.doesNotMatch(actual, /\{\{\w+\}\}/, mission + ': unresolved placeholder')
        renderedVariants++
      }
    }
  }
}
assert.equal(renderedVariants, 22 * 4 * 3 * 3)

const mirrorGame = {
  ...game, winnerFaction: 'Nomads', loserFaction: 'Nomads',
} as RecentGame
const mirrorLists = [
  list('Winner', 'Loser', 'Nomads'),
  list('Loser', 'Winner', 'Nomads'),
]
const mirrorTemplate = composeGameStory(game.mission, 'Nomads', 'Nomads', 'Nomads', 'objective', game.id)
assert.ok(mirrorTemplate)
const mirrorWin = renderGeneratedGameStory(mirrorGame, mirrorLists)
const mirrorDraw = renderGeneratedGameStory({ ...mirrorGame, gameResult: 'draw' }, mirrorLists)
const mirrorExpected = renderGameStoryTemplate(mirrorTemplate, mirrorGame, mirrorLists)
assert.ok(mirrorExpected)
assert.ok(mirrorWin?.includes('Winner') && mirrorWin.includes('Loser'))
assert.equal(mirrorWin.split('\n\n').at(-1), mirrorExpected.split('\n\n').at(-1))
assert.ok(mirrorDraw?.endsWith(mirrorTemplate.endings.draw))
assert.doesNotMatch(mirrorWin, /\{\{\w+\}\}/)

// Authored scenes keep priority even when a generated scene exists for that
// pair. Missing pairs inside an authored mission shard use the engine.
const digRows = JSON.parse(await readFile('public/game-stories/the-dig.json', 'utf8')) as typeof template[]
const authored = digRows.find((row) => row.factions.includes('Next Wave') && row.factions.includes('StarCo'))
assert.ok(authored)
const authoredGame = {
  ...game, mission: 'The Dig', winnerFaction: 'Next Wave', loserFaction: 'StarCo',
} as RecentGame
const authoredLists = [
  { ...list('Winner', 'Loser', 'Next Wave'), mission: 'The Dig' },
  { ...list('Loser', 'Winner', 'StarCo'), mission: 'The Dig' },
] as ArmyIntelligenceList[]
const authoredKeys = new Set([...GAME_STORY_CATALOG, ...digRows].map((row) =>
  storyTemplateKey(row.mission, ...row.factions)))
const missingPair = armies.flatMap((first, i) => armies.slice(i).map((second) => [first.name, second.name] as const))
  .find(([first, second]) => !authoredKeys.has(storyTemplateKey('The Dig', first, second)))
assert.ok(missingPair)
const missingGame = {
  ...authoredGame, winnerFaction: missingPair[0], loserFaction: missingPair[1],
} as RecentGame
const missingLists = [
  { ...authoredLists[0], sectorial: missingPair[0] },
  { ...authoredLists[1], sectorial: missingPair[1] },
] as ArmyIntelligenceList[]
const originalFetch = globalThis.fetch
let fetchCount = 0
try {
  globalThis.fetch = async () => {
    fetchCount++
    return Response.json(digRows)
  }
  assert.equal(await loadAuthoredBattleStory(authoredGame, authoredLists),
    renderGameStoryTemplate(authored, authoredGame, authoredLists))
  assert.equal(await loadAuthoredBattleStory(missingGame, missingLists),
    renderGeneratedGameStory(missingGame, missingLists))
  assert.equal(fetchCount, 2, 'read the authored mission shard before generating a fallback')
} finally {
  globalThis.fetch = originalFetch
}

console.log('Generated story engine: ' + covered + '/' + covered +
  ' canonical matchups have structurally valid scenes for four incidents and all hero roles.')
