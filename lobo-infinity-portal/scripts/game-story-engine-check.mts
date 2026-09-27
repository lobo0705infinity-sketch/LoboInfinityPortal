import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { ARMY_STORY_VOICES } from '../src/data/generatedStoryArmies.ts'
import { MISSION_STORY_ADDITIONAL_SEEDS } from '../src/data/generatedStoryAdditionalSeeds.ts'
import { MISSION_STORY_FRAMES } from '../src/data/generatedStoryFrames.ts'
import { MISSION_STORY_SEEDS } from '../src/data/generatedStorySeeds.ts'
import { GAME_STORY_CATALOG } from '../src/data/gameStoryCatalog.ts'
import { composeGameStory, renderGeneratedGameStory } from '../src/services/generatedGameStory.ts'
import { loadAuthoredBattleStory, PENDING_BATTLE_STORY } from '../src/services/gameStoryRouting.ts'
import { renderGameStoryTemplate, storyTemplateKey } from '../src/services/gameStoryTemplate.ts'
import type { ArmyIntelligenceList, RecentGame } from '../src/services/api.ts'
import { assertGameStoryQuality } from './game-story-quality.mts'

const armies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
assert.equal(armies.length, 45)
assert.equal(CANONICAL_MISSIONS.length, 22)
assert.deepEqual(Object.keys(ARMY_STORY_VOICES).sort(), armies.map((army) => army.id).sort())
assert.deepEqual(Object.keys(MISSION_STORY_SEEDS).sort(), [...CANONICAL_MISSIONS].sort())
assert.deepEqual(Object.keys(MISSION_STORY_ADDITIONAL_SEEDS).sort(), [...CANONICAL_MISSIONS].sort())
assert.deepEqual(Object.keys(MISSION_STORY_FRAMES).sort(), [...CANONICAL_MISSIONS].sort())
assert.ok(Object.values(MISSION_STORY_ADDITIONAL_SEEDS).every((seeds) => seeds.length === 2))

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
  assert.match(court.paragraphs.join(' '), /ball|court/i)
  assert.doesNotMatch(court.paragraphs.join(' '), /network trace|cargo markings|gantry/i,
    'army tactics must belong to the court rather than a different mission')
}

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
assert.ok(drawText?.endsWith(template.endings.draw))

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
