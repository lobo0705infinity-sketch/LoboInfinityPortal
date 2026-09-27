import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { ARMY_STORY_VOICES } from '../src/data/generatedStoryArmies.ts'
import { AREA_ARMY_METHODS } from '../src/data/generatedStoryAreaArmies.ts'
import { MISSION_ARMY_ALTERNATE_MANEUVERS, MISSION_ARMY_METHODS,
  MISSION_ARMY_PIVOT_MANEUVERS } from '../src/data/generatedStoryMissionArmies.ts'
import { MISSION_ROLE_ALTERNATES } from '../src/data/generatedStoryRoleAlternates.ts'
import { MISSION_TACTICAL_REFERENTS } from '../src/data/generatedStoryTacticalReferents.ts'
import { SOURCED_STORY_SCENARIOS } from '../src/data/generatedStoryScenarios.ts'
import { INCIDENT_CONSEQUENCES, INCIDENT_CROSSFIRE, INCIDENT_ENDING_FOCUS,
  INCIDENT_STAKES } from '../src/data/generatedStoryIncidentBeats.ts'
import { AREA_LOCATION_ALTERNATES, AREA_LOCATION_EARLY, AREA_LOCATION_LATE, AREA_LOCATIONS,
  AREA_WEATHER, AREA_WEATHER_ALTERNATES, AREA_WEATHER_EARLY,
  AREA_WEATHER_LATE } from '../src/data/generatedStorySettings.ts'
import { GAME_STORY_CATALOG } from '../src/data/gameStoryCatalog.ts'
import { composeGameStory, hasUnsupportedStoryMissionVersion, renderGeneratedGameStory } from '../src/services/generatedGameStory.ts'
import { loadAuthoredBattleStory, MISSING_MISSION_SETUP_BATTLE_STORY, NO_ELIGIBLE_HERO_BATTLE_STORY,
  PENDING_BATTLE_STORY, UNSUPPORTED_MISSION_VERSION_BATTLE_STORY } from '../src/services/gameStoryRouting.ts'
import { renderGameStoryTemplate, selectStoryHero, storyTemplateKey } from '../src/services/gameStoryTemplate.ts'
import type { ArmyIntelligenceList, RecentGame } from '../src/services/api.ts'
import { assertGameStoryMissionObjective, assertGameStoryQuality } from './game-story-quality.mts'

const armies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
assert.equal(armies.length, 45)
assert.equal(CANONICAL_MISSIONS.length, 22)
assert.deepEqual(Object.keys(ARMY_STORY_VOICES).sort(), armies.map((army) => army.id).sort())
assert.deepEqual(Object.keys(AREA_ARMY_METHODS).sort(), armies.map((army) => army.id).sort())
assert.deepEqual(Object.keys(MISSION_ARMY_METHODS).sort(), armies.map((army) => army.id).sort())
assert.deepEqual(Object.keys(MISSION_ARMY_ALTERNATE_MANEUVERS).sort(), armies.map((army) => army.id).sort())
assert.deepEqual(Object.keys(MISSION_ARMY_PIVOT_MANEUVERS).sort(), armies.map((army) => army.id).sort())
assert.deepEqual(Object.keys(MISSION_TACTICAL_REFERENTS).sort(),
  CANONICAL_MISSIONS.filter((mission) => mission !== 'Area of Interest').sort())
assert.deepEqual(Object.keys(MISSION_ROLE_ALTERNATES).sort(),
  CANONICAL_MISSIONS.filter((mission) => mission !== 'Area of Interest').sort())
for (const [mission, referents] of Object.entries(MISSION_TACTICAL_REFERENTS)) {
  assert.doesNotMatch(referents.feint, /\bguards?\b/i,
    mission + ': an action like "guard at {position}" requires a place, not another guard')
  assert.doesNotMatch(referents.defend, /\bguards?\b/i,
    mission + ': a defensive position must be a place, not another guard')
}
for (const army of armies) {
  const decisions = [MISSION_ARMY_METHODS[army.id].maneuver,
    MISSION_ARMY_ALTERNATE_MANEUVERS[army.id], ...MISSION_ARMY_PIVOT_MANEUVERS[army.id]]
  assert.equal(new Set(decisions).size, 4, army.name + ': four distinct authored decisions')
  assert.ok(decisions.every((decision) => /\{(?:ground|position)\}/.test(decision)),
    army.name + ': each maneuver must respond to the contested site')
}
for (const mission of CANONICAL_MISSIONS.filter((name) => name !== 'Area of Interest')) {
  const alternative = MISSION_ROLE_ALTERNATES[mission]
  const scenario = SOURCED_STORY_SCENARIOS[mission]!
  assert.notEqual(alternative.gunfighting, scenario.gunfighting, mission + ': second gunfighting action')
  assert.notEqual(alternative.closeCombat, scenario.closeCombat, mission + ': second closeCombat action')
}
for (const field of ['initiative', 'response', 'followThrough', 'winBeat', 'drawBeat'] as const) {
  assert.equal(new Set(Object.values(AREA_ARMY_METHODS).map((method) => method[field])).size,
    armies.length, `Area of Interest ${field} must distinguish all active armies`)
}
for (const field of ['maneuver', 'defense', 'followThrough', 'winClause', 'drawBeat'] as const) {
  assert.equal(new Set(Object.values(MISSION_ARMY_METHODS).map((method) => method[field])).size,
    armies.length, `other missions' ${field} must distinguish all active armies`)
}
assert.deepEqual(Object.keys(SOURCED_STORY_SCENARIOS).sort(), [...CANONICAL_MISSIONS].sort())

// One faction appearing across the calendar must not repeat its entire
// tactical sentences verbatim just because the mission changed. Inspect
// completed prose, independent of which method supplied each sentence.
for (const army of armies) {
  const seenSentences = new Map<string, string>()
  for (const mission of CANONICAL_MISSIONS.filter((name) => name !== 'Area of Interest')) {
    const story = composeGameStory(mission, army.name, 'Druze Bayram Security', army.name, 'objective')
    assert.ok(story)
    for (const sentence of story.paragraphs.flatMap((paragraph) =>
      paragraph.split(/(?<=[.!?])\s+(?=[A-Z{])/))) {
      const earlier = seenSentences.get(sentence)
      assert.equal(earlier, undefined,
        `${army.name}: a whole sentence repeats in ${earlier} and ${mission}: ${sentence}`)
      seenSentences.set(sentence, mission)
    }
  }
}

for (const [mission, scenario] of Object.entries(SOURCED_STORY_SCENARIOS)) {
  assert.ok(scenario)
  assert.match(scenario.source, /^https:\/\/infinitygeist\.com\/mission\//)
  assert.equal(scenario.incidents.length, 4, mission + ': four incidents')
  assert.equal(new Set(scenario.incidents.map((seed) => seed.opening)).size, 4, mission + ': distinct openings')
  assert.equal(new Set(scenario.incidents.map((seed) => seed.complication)).size, 4, mission + ': distinct complications')
  for (const seed of scenario.incidents) {
    assert.match(seed.objectiveAction, scenario.anchor, mission + ': action must name a mission objective')
    assert.doesNotMatch(seed.objectiveAction, /\bprepar(?:e|ed|ing)?\b/i,
      mission + ': hero must attempt the mission action, not prepare for it')
    assert.match(seed.objectiveAction,
      /\b(?:activat|analy|attempt|began|brush|carr|caught|clear|crawl|cross|duck|enter|escort|fired|fit|forced|grab|grip|key|led|move|press|pull|push|reach|return|sent|slid|slip|start|step|stretch|tap|took|touch|tried|try|tug|work)\w*\b/i,
      mission + ': objective hero needs an active attempt in the source action')
  }
  // The game feed has aggregate points, not individual mission objectives.
  // A winner cannot be reported as having extracted, hacked or neutralized a
  // particular item solely because their total score was higher.
  for (const ending of Object.values(scenario.endings)) {
    assert.doesNotMatch(ending,
      /\b(?:activated|analy[sz]ed|neutralized|extracted|captured|hacked|dominated|scanned|stabilized|destroyed|controlled)\b/i,
      mission + ': ending must not invent an accomplished objective')
    assert.doesNotMatch(ending, /\bprevailed\b|\bended level\b/i,
      mission + ': do not reuse the old stock outcome sentence')
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
for (const mission of CANONICAL_MISSIONS) {
  const openingOrders = new Set<string>()
  for (const role of ['objective', 'gunfighting', 'closeCombat'] as const) {
    for (const gameId of [0, 1, 2, 3]) {
      const generated = composeGameStory(mission, 'PanOceania', 'Druze Bayram Security',
        'PanOceania', role, gameId)
      assert.ok(generated)
      assertGameStoryMissionObjective(generated, `${mission}/${role}/${gameId}`)
      assert.doesNotMatch(generated.paragraphs[0], /, while \{\{otherPlayer\}\}/,
        `${mission}: old repeated army-introduction scaffold`)
      openingOrders.add(generated.paragraphs[0].indexOf('{{heroPlayer}}') <
        generated.paragraphs[0].indexOf('{{otherPlayer}}') ? 'hero' : 'other')
    }
  }
  assert.equal(openingOrders.size, 2, mission + ': test both directions of the opening')
}
const offMission = {
  ...composeGameStory('The Dig', 'PanOceania', 'Druze Bayram Security',
    'PanOceania', 'objective')!,
  paragraphs: [
    'An old freight lift carried the guards below the surface while both crews sought an artifact.',
    '{{hero}} searched the tunnel for a lost key as {{heroPlayer}} waited behind the door.',
    '{{otherPlayer}} moved toward the abandoned shaft before the last lamp went dark.',
  ],
}
assert.throws(() => assertGameStoryMissionObjective(offMission, 'off-mission The Dig'),
  /misses the mission objective/, 'new stories cannot use an unrelated buried artifact')
const noAreaControl = composeGameStory('Area of Interest', 'PanOceania', 'Druze Bayram Security',
  'PanOceania', 'objective')!
assert.throws(() => assertGameStoryMissionObjective({ ...noAreaControl,
  endings: { ...noAreaControl.endings, draw: 'The communication antenna blinked without a response.' } },
  'unresolved Area of Interest draw'), /draw ending misses the mission objective/,
  'antenna alone does not resolve who controls the area')
const noHardlockConsole = composeGameStory('Hardlock', 'PanOceania', 'Druze Bayram Security',
  'PanOceania', 'objective')!
assert.throws(() => assertGameStoryMissionObjective({ ...noHardlockConsole,
  endings: { ...noHardlockConsole.endings, heroWins: 'The beacon lit as the patrol withdrew.' } },
  'unresolved Hardlock victory'), /heroWins ending misses the mission objective/,
  'a beacon alone does not resolve the console objective')
const oldCrossing = composeGameStory('Crossing Lines', 'PanOceania', 'Druze Bayram Security',
  'PanOceania', 'objective')!
assert.throws(() => assertGameStoryMissionObjective({ ...oldCrossing,
  paragraphs: [oldCrossing.paragraphs[0] + ' The classified deck determined the winner.',
    ...oldCrossing.paragraphs.slice(1)] }, 'old Crossing Lines'),
  /no HVT or Classified Deck/, 'respect the September 24 ITS 18 hotfix')
const pong = composeGameStory('B-Pong', 'PanOceania', 'Druze Bayram Security',
  'PanOceania', 'objective')!
assert.throws(() => assertGameStoryMissionObjective({ ...pong,
  paragraphs: [pong.paragraphs[0] + ' The beacon had to be controlled before anyone could move it.',
    ...pong.paragraphs.slice(1)] }, 'invalid B-Pong rule'),
  /permits a specialist in contact to relocate/, 'contact relocation needs no prior beacon control')
const akial = composeGameStory('Akial Interference', 'PanOceania', 'Druze Bayram Security',
  'PanOceania', 'objective')!
assert.throws(() => assertGameStoryMissionObjective({ ...akial,
  paragraphs: [akial.paragraphs[0] + ' The classified objective evidence lay under the mast.',
    ...akial.paragraphs.slice(1)] }, 'invented Akial evidence'),
  /do not establish a fixed physical evidence marker/, 'public cards cannot imply physical evidence')
for (const [mission, required, unsupported] of [
  ['Evacuation', /Extraction Console.*CivEvac|CivEvac.*Extraction Console/i, /extraction (?:line|marker)/i],
  ['Last Launch', /ID Scanner/i, /extraction (?:line|marker)/i],
  ['Neutralization', /Hyperthermal Tech Box.*Neutralization Area|Neutralization Area.*Hyperthermal Tech Box/i,
    /antenna command|neutraliz\w* tech through the antenna/i],
] as const) {
  const scenario = SOURCED_STORY_SCENARIOS[mission]!
  for (const incident of scenario.incidents) {
    const text = [scenario.ground, scenario.position, ...Object.values(incident)].join(' ')
    assert.match(text, required, `${mission}: incident needs the actual mission mechanism`)
    assert.doesNotMatch(text, unsupported, `${mission}: incident uses an invented mechanism`)
  }
  for (const ending of Object.values(scenario.endings)) {
    assert.doesNotMatch(ending, unsupported, `${mission}: ending uses an invented mechanism`)
  }
}
assert.throws(() => assertGameStoryMissionObjective({ ...composeGameStory('Last Launch',
  'PanOceania', 'Druze Bayram Security', 'PanOceania', 'objective')!, paragraphs: [
  'The specialist prepared to leave the tower across an extraction line.',
  'Fighters traded shots at the ID Scanner while the bearer moved.',
  '{{hero}} watched the ID Checker as {{heroPlayer}} and {{otherPlayer}} closed in.',
] }, 'invalid Last Launch'), /not an extraction line or marker/)
assert.throws(() => assertGameStoryMissionObjective({ ...composeGameStory('Neutralization',
  'PanOceania', 'Druze Bayram Security', 'PanOceania', 'objective')!, paragraphs: [
  'The box stood open beside the Neutralization Area.',
  'The antenna command would neutralize the tech without a bearer.',
  '{{hero}} watched {{heroPlayer}} and {{otherPlayer}} from cover.',
] }, 'invalid Neutralization'), /not by antenna command/)
assert.throws(() => assertGameStoryMissionObjective({ ...composeGameStory('The Dig',
  'PanOceania', 'Druze Bayram Security', 'PanOceania', 'objective')!, paragraphs: [
  'The specialist worked at the console beside the hyperthermal tech.',
  'The neutralizing command waited on the console screen.',
  '{{hero}} checked the analyzed tech as {{heroPlayer}} and {{otherPlayer}} approached.',
] }, 'invalid The Dig'), /not by console command/)
const digForEnding = composeGameStory('The Dig', 'PanOceania', 'Druze Bayram Security',
  'PanOceania', 'objective')!
assert.throws(() => assertGameStoryMissionObjective({ ...digForEnding, endings: {
  ...digForEnding.endings, draw: 'The crews finished even in their effort to analyze the hyperthermal tech.',
} }, 'incomplete The Dig'), /draw ending misses the mission objective/,
'Dig endings must also name contact neutralization of marked tech')
for (const [mission, fragment, message] of [
  ['Uplink Center', 'Opening the Tech-Coffin lid scored the objective.', /not by opening it/],
  ['Battleground', 'The sector marker lit up before the final round.', /marked out only when the game ends/],
  ['Data Harvest', 'The specialist replaced the power cell to activate the harvester.', /not an objective skill/],
] as const) {
  const template = composeGameStory(mission, 'PanOceania', 'Druze Bayram Security',
    'PanOceania', 'objective')!
  assert.throws(() => assertGameStoryMissionObjective({ ...template,
    paragraphs: [template.paragraphs[0] + ' ' + fragment, ...template.paragraphs.slice(1)] }, mission), message)
}
for (const mission of CANONICAL_MISSIONS.filter((name) => name !== 'Area of Interest')) {
  const consequences = INCIDENT_CONSEQUENCES[mission as keyof typeof INCIDENT_CONSEQUENCES]
  assert.equal(consequences?.length, SOURCED_STORY_SCENARIOS[mission]?.incidents.length,
    `${mission}: each incident needs its own consequence`)
  assert.equal(new Set(consequences).size, consequences.length,
    `${mission}: consequences must not repeat within the mission`)
  const crossfire = INCIDENT_CROSSFIRE[mission as keyof typeof INCIDENT_CROSSFIRE]
  assert.equal(crossfire?.length, consequences.length, `${mission}: each incident needs its own firefight`)
  assert.equal(new Set(crossfire).size, crossfire.length,
    `${mission}: firefights must not repeat within the mission`)
  const stakes = INCIDENT_STAKES[mission as keyof typeof INCIDENT_STAKES]
  assert.equal(stakes?.length, consequences.length, `${mission}: each incident needs its own stakes`)
  assert.equal(new Set(stakes).size, stakes.length,
    `${mission}: stakes must not repeat within the mission`)
  const focuses = INCIDENT_ENDING_FOCUS[mission as keyof typeof INCIDENT_ENDING_FOCUS]
  assert.equal(focuses?.length, consequences.length, `${mission}: each incident needs its own outcome context`)
  assert.equal(new Set(focuses).size, focuses.length,
    `${mission}: endings must refer to different obstacles across incidents`)
}
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
assert.deepEqual(Object.keys(AREA_WEATHER_ALTERNATES).sort(), Object.keys(AREA_WEATHER).sort())
assert.deepEqual(Object.keys(AREA_WEATHER_EARLY).sort(), Object.keys(AREA_WEATHER).sort())
assert.deepEqual(Object.keys(AREA_WEATHER_LATE).sort(), Object.keys(AREA_WEATHER).sort())
assert.deepEqual(Object.keys(AREA_LOCATIONS).sort(),
  ['desert', 'forest', 'freightDepot', 'jungle', 'mountain', 'relayCourtyard', 'rooftopTerrace'])
assert.deepEqual(Object.keys(AREA_LOCATION_ALTERNATES).sort(), Object.keys(AREA_LOCATIONS).sort())
assert.deepEqual(Object.keys(AREA_LOCATION_EARLY).sort(), Object.keys(AREA_LOCATIONS).sort())
assert.deepEqual(Object.keys(AREA_LOCATION_LATE).sort(), Object.keys(AREA_LOCATIONS).sort())
for (const weather of Object.keys(AREA_WEATHER) as (keyof typeof AREA_WEATHER)[]) {
  const versions = [AREA_WEATHER[weather], AREA_WEATHER_EARLY[weather],
    AREA_WEATHER_ALTERNATES[weather], AREA_WEATHER_LATE[weather]]
  for (const field of ['opening', 'complication', 'closing'] as const) {
    assert.equal(new Set(versions.map((version) => version[field])).size, 4,
      `${weather}: each incident needs a different ${field} weather observation`)
  }
}
for (const location of Object.keys(AREA_LOCATIONS) as (keyof typeof AREA_LOCATIONS)[]) {
  const versions = [AREA_LOCATIONS[location], AREA_LOCATION_EARLY[location],
    AREA_LOCATION_ALTERNATES[location], AREA_LOCATION_LATE[location]]
  for (const field of ['arrival', 'signal'] as const) {
    assert.equal(new Set(versions.map((version) => version[field])).size, 4,
      `${location}: each incident needs a different ${field} observation`)
  }
}
// These cases exercised the failure modes in the independent review: a
// second guard used as a location, recycled role actions, and an objective
// hero delegating the decisive move to an unnamed specialist.
function sceneForIncident(mission: string, first: string, other: string,
  role: 'objective' | 'gunfighting' | 'closeCombat', index: number) {
  const incident = SOURCED_STORY_SCENARIOS[mission]!.incidents[index]
  for (const id of [0, 1, 2, 3]) {
    const story = composeGameStory(mission, first, other, first, role, id)
    if ((mission === 'Area of Interest' ? story?.paragraphs[1].startsWith(incident.complication)
      : story?.paragraphs[0].startsWith(incident.opening))) return story!
  }
  throw new Error('Could not select ' + mission + ' incident ' + index)
}
for (const mission of ['Provisioning', 'Uplink Center', 'Annihilation']) {
  const story = sceneForIncident(mission, 'Nomads', 'Military Orders', 'gunfighting', 2)
  assert.doesNotMatch(story.paragraphs.join(' '), /guard at the (?:coffin-side guard|antenna-side guards|lieutenant’s guard)/i,
    mission + ': a guard cannot stand at another guard')
}
const coreScene = sceneForIncident("Dead Man's Switch", 'Combined Army',
  'Morat Aggression Force', 'objective', 0)
assert.match(coreScene.paragraphs[2], /\{\{hero\}\} located the Quantum Core.*reached for it/)
assert.doesNotMatch(coreScene.paragraphs[2], /prepared a specialist to claim/i)
const supplyScene = sceneForIncident('Provisioning', 'Combined Army',
  'Morat Aggression Force', 'objective', 3)
assert.match(coreScene.paragraphs[1], /The first alien element held the defenders at/)
assert.match(supplyScene.paragraphs[1], /The first wave drew the guard into the open/)
assert.notEqual(coreScene.paragraphs[1], supplyScene.paragraphs[1],
  'the same army changes its tactical decision across missions')
const qapuDecisionIndices: number[] = []
for (const [mission, incidentIndex] of [
  ['Corporate Appropriation', 3], ['Critical Intervention', 0], ['Last Launch', 3],
] as const) {
  const qapu = sceneForIncident(mission, 'Qapu Khalqi', 'Druze Bayram Security', 'objective', incidentIndex)
  const referents = MISSION_TACTICAL_REFERENTS[mission]
  const choices = [MISSION_ARMY_METHODS['qapu-khalqi'].maneuver,
    MISSION_ARMY_ALTERNATE_MANEUVERS['qapu-khalqi'], ...MISSION_ARMY_PIVOT_MANEUVERS['qapu-khalqi']]
  const found = choices.findIndex((choice) => qapu.paragraphs[1].includes(choice
    .replaceAll('{ground}', referents.advance).replaceAll('{position}', referents.feint)))
  assert.notEqual(found, -1, `${mission}: expected an authored Qapu Khalqi decision`)
  qapuDecisionIndices.push(found)
  assert.ok(qapu.endings.draw.includes(INCIDENT_ENDING_FOCUS[mission][incidentIndex]),
    `${mission}: a draw should return to the concrete incident`)
}
assert.equal(new Set(qapuDecisionIndices).size, 3,
  'Qapu Khalqi must not repeat the same maneuver in these three distinct missions')
for (const mission of CANONICAL_MISSIONS.filter((name) => name !== 'Area of Interest')) {
  for (const role of ['gunfighting', 'closeCombat'] as const) {
    const first = sceneForIncident(mission, 'PanOceania', 'Druze Bayram Security', role, 1)
    const later = sceneForIncident(mission, 'PanOceania', 'Druze Bayram Security', role, 3)
    assert.notEqual(first.paragraphs[2].match(/\{\{hero\}\}[^.]+\./)?.[0],
      later.paragraphs[2].match(/\{\{hero\}\}[^.]+\./)?.[0],
      mission + ': role action must change when a new incident changes the stakes')
  }
}
const areaFirst = sceneForIncident('Area of Interest', 'Corregidor Jurisdictional Command',
  'Tunguska Jurisdictional Command', 'objective', 0)
const areaLater = [0, 1, 2, 3].map((id) => composeGameStory('Area of Interest',
  'Next Wave', 'Onyx Contact Force', 'Next Wave', 'closeCombat', id,
  { location: areaFirst.sceneTags!.location, weather: areaFirst.sceneTags!.weather }))
  .find((story) => story?.paragraphs[1].startsWith(SOURCED_STORY_SCENARIOS['Area of Interest']!.incidents[2].complication))!
assert.ok(areaLater)
assert.ok(!areaLater.paragraphs[0].includes(AREA_LOCATIONS[areaFirst.sceneTags!.location].arrival))
assert.ok(areaLater.paragraphs[0].includes(AREA_LOCATION_ALTERNATES[areaFirst.sceneTags!.location].arrival))
assert.ok(areaLater.paragraphs[1].includes(AREA_WEATHER_ALTERNATES[areaFirst.sceneTags!.weather].complication))
assert.ok(!areaLater.paragraphs[2].includes(AREA_WEATHER[areaFirst.sceneTags!.weather].closing))
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
  const referents = MISSION_TACTICAL_REFERENTS[mission as keyof typeof MISSION_TACTICAL_REFERENTS]
  for (const opponent of armies) {
    const tohaa = composeGameStory(mission, tohaaArmy.name, opponent.name,
      tohaaArmy.name, 'objective', 0)
    assert.ok(tohaa)
    assertGameStoryQuality(tohaa, `${mission}: Tohaa / ${opponent.name}`)
    assert.ok(tohaa.paragraphs[1].includes(referents.advance), `${mission}: army movement needs its objective`)
    assert.ok(tohaa.paragraphs[2].includes(referents.continuation),
      `${mission}: army follow-through needs a local destination`)
    assert.doesNotMatch(tohaa.paragraphs.join(' '), /\{(?:ground|position)\}/,
      `${mission}: no raw tactical placeholders`)
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
          const incident = SOURCED_STORY_SCENARIOS['Area of Interest']!.incidents.findIndex((seed) =>
            story.paragraphs[1].startsWith(seed.complication))
          assert.ok(incident >= 0)
          const setting = incident === 3 ? AREA_LOCATION_LATE[location]
            : incident === 2 ? AREA_LOCATION_ALTERNATES[location]
              : incident === 1 ? AREA_LOCATION_EARLY[location] : AREA_LOCATIONS[location]
          const conditions = incident === 3 ? AREA_WEATHER_LATE[weather]
            : incident === 2 ? AREA_WEATHER_ALTERNATES[weather]
              : incident === 1 ? AREA_WEATHER_EARLY[weather] : AREA_WEATHER[weather]
          assert.ok(story.paragraphs[0].includes(setting.arrival))
          assert.ok(story.paragraphs[0].includes(conditions.opening))
          assert.ok(story.paragraphs[1].includes(conditions.complication))
          assert.ok(story.paragraphs[2].includes(conditions.closing))
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
  points: 30, specialist: true, hacker: false, engineer: false, doctor: true,
  forwardObserver: false, bs: 13, weapons: ['AP Heavy Machine Gun', 'CC Weapon'],
  skills: ['Martial Arts', 'Doctor'], equipment: [], troopType: 'LI', orderTypes: ['regular'],
}
const list = (player: string, opponent: string, sectorial: string): ArmyIntelligenceList => ({
  player, opponent, sectorial, mission: game.mission, date: '2026-09-26',
  status: 'decoded', decoded: { combatGroups: [{ entries: [entry] }] },
}) as ArmyIntelligenceList
const lists = [
  list('Winner', 'Loser', 'PanOceania'),
  list('Loser', 'Winner', 'Druze Bayram Security'),
]
const outbreakList = {
  ...list('Winner', 'Loser', 'PanOceania'), mission: 'Outbreak',
  decoded: { combatGroups: [{ entries: [
    { ...entry, unit: 'EXPENSIVE HACKER', combinedId: 'hacker', points: 60, doctor: false,
      hacker: true, skills: ['Hacker'] },
    { ...entry, unit: 'FIELD MEDIC', combinedId: 'medic', points: 18, doctor: true,
      hacker: false, skills: ['Doctor'] },
  ] }] },
} as ArmyIntelligenceList
assert.equal(selectStoryHero(outbreakList, 'objective')?.combinedId, 'hacker')
assert.equal(selectStoryHero(outbreakList, 'objective', 'infectedCare')?.combinedId, 'medic')
for (const seed of SOURCED_STORY_SCENARIOS.Outbreak!.incidents) {
  assert.match(seed.objectiveAction, /stabili[sz]/i,
    'the eligible Outbreak clinician must prepare care in each incident')
}
const outbreakTemplate = composeGameStory('Outbreak', 'PanOceania', 'Druze Bayram Security',
  'PanOceania', 'objective', 9081)!
const outbreakRendered = renderGameStoryTemplate(outbreakTemplate, { ...game, mission: 'Outbreak' },
  [outbreakList, { ...list('Loser', 'Winner', 'Druze Bayram Security'), mission: 'Outbreak' }])
assert.match(outbreakRendered ?? '', /the Field Medic/i, 'Outbreak clinician must perform the objective action')
assert.doesNotMatch(outbreakRendered ?? '', /the Expensive Hacker/i)
const hackerOnlyList = { ...outbreakList, decoded: {
  combatGroups: [{ entries: outbreakList.decoded!.combatGroups[0].entries.slice(0, 1) }],
} } as ArmyIntelligenceList
assert.equal(renderGameStoryTemplate(outbreakTemplate, { ...game, mission: 'Outbreak' },
  [hackerOnlyList, { ...list('Loser', 'Winner', 'Druze Bayram Security'), mission: 'Outbreak' }]), null,
  'an Outbreak objective story must wait when its hero side has no eligible clinician')
const evacuationGame = { ...game, mission: 'Evacuation' } as RecentGame
const evacuationRoster = { ...list('Winner', 'Loser', 'PanOceania'), mission: 'Evacuation',
  decoded: { combatGroups: [{ entries: [
    { ...entry, unit: 'TEST REMOTE', profile: 'TEST REMOTE', combinedId: 'remote', points: 60,
      troopType: 'REM', skills: ['Hacker'] },
    { ...entry, unit: 'FIELD ESCORT', profile: 'FIELD ESCORT', combinedId: 'escort', points: 18 },
  ] }] },
} as ArmyIntelligenceList
const evacuationOther = { ...list('Loser', 'Winner', 'Druze Bayram Security'), mission: 'Evacuation' }
assert.equal(selectStoryHero(evacuationRoster, 'objective')?.combinedId, 'remote')
assert.equal(selectStoryHero(evacuationRoster, 'objective', 'civilianEscort')?.combinedId, 'escort')
for (const [troopType, skills] of [['VH', ['Doctor']], ['LI', ['Impetuous', 'Doctor']],
  ['LI', ['Peripheral', 'Doctor']]] as const) {
  const forbidden = { ...evacuationRoster, decoded: { combatGroups: [{ entries: [
    { ...entry, troopType, skills },
  ] }] } } as ArmyIntelligenceList
  assert.equal(selectStoryHero(forbidden, 'objective', 'civilianEscort'), null,
    `${troopType}/${skills.join(',')}: cannot CivEvac`)
}
const evacuationTemplate = composeGameStory('Evacuation', 'PanOceania', 'Druze Bayram Security',
  'PanOceania', 'objective', 9081)!
const evacuationText = renderGameStoryTemplate(evacuationTemplate, evacuationGame,
  [evacuationRoster, evacuationOther])
assert.match(evacuationText ?? '', /the Field Escort/i)
assert.doesNotMatch(evacuationText ?? '', /the Test Remote/i)
const remOnlyRoster = { ...evacuationRoster, decoded: { combatGroups: [{ entries: [
  evacuationRoster.decoded!.combatGroups[0].entries[0],
] }] } } as ArmyIntelligenceList
assert.equal(renderGameStoryTemplate(evacuationTemplate, evacuationGame, [remOnlyRoster, evacuationOther]),
  null, 'a remote must never be assigned the CivEvac action')
for (const mission of ['Akial Interference', 'Critical Intervention', 'Double Bind']) {
  const setupGame = { ...game, mission } as RecentGame
  const setupLists = lists.map((item) => ({ ...item, mission })) as ArmyIntelligenceList[]
  assert.equal(renderGeneratedGameStory(setupGame, setupLists), null,
    mission + ': do not invent an unreported mission setup or card draw')
  if (mission === 'Akial Interference') continue // Its authored shard is tested below with a mocked browser fetch.
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
const ineligible = { ...entry, unit: 'UNARMED OBSERVER', profile: 'UNARMED OBSERVER',
  combinedId: 'observer', specialist: false, hacker: false, engineer: false,
  doctor: false, forwardObserver: false, bs: 8, weapons: [], skills: [] }
const oneEligibleMirrorList = [
  { ...mirrorLists[0], decoded: { combatGroups: [{ entries: [ineligible] }] } }, mirrorLists[1],
] as ArmyIntelligenceList[]
const losingSideMirror = renderGeneratedGameStory(mirrorGame, oneEligibleMirrorList)
assert.ok(losingSideMirror?.includes('Winner') && losingSideMirror.includes('Loser'))
assert.ok(losingSideMirror.endsWith(mirrorTemplate.endings.heroLoses
  .replaceAll('{{heroPlayer}}', 'Loser').replaceAll('{{otherPlayer}}', 'Winner')),
  'the losing mirror side supplies the eligible actor and receives the loss ending')
assert.equal(renderGameStoryTemplate(mirrorTemplate, mirrorGame, oneEligibleMirrorList),
  renderGameStoryTemplate(mirrorTemplate, mirrorGame, oneEligibleMirrorList, 1),
  'authored mirror scenes can also use the second eligible side')
assert.ok(renderGeneratedGameStory({ ...mirrorGame, gameResult: 'draw' }, oneEligibleMirrorList)
  ?.endsWith(mirrorTemplate.endings.draw.replaceAll('{{heroPlayer}}', 'Loser')
    .replaceAll('{{otherPlayer}}', 'Winner')), 'mirror draws bind each player to the selected side')
const bothIneligibleMirror = [oneEligibleMirrorList[0], { ...mirrorLists[1],
  decoded: { combatGroups: [{ entries: [ineligible] }] } }] as ArmyIntelligenceList[]
assert.equal(await loadAuthoredBattleStory(mirrorGame, bothIneligibleMirror),
  NO_ELIGIBLE_HERO_BATTLE_STORY, 'two decoded but ineligible lists are not waiting for decoding')

const longDisplayGame = { ...game, mission: 'Area of Interest',
  winnerFaction: 'Yu Jing', loserFaction: 'Haqqislam',
  winnerDisplayName: 'Captain Jake Strangeway', loserDisplayName: 'General Oliver Delta',
} as RecentGame
const longDisplayLists = [
  { ...lists[0], sectorial: 'Yu Jing', mission: 'Area of Interest' },
  { ...lists[1], sectorial: 'Haqqislam', mission: 'Area of Interest' },
] as ArmyIntelligenceList[]
for (let gameId = 0; gameId < 8; gameId++) {
  const template = composeGameStory('Area of Interest', 'Yu Jing', 'Haqqislam', 'Yu Jing', 'objective', gameId)!
  const story = renderGameStoryTemplate(template, { ...longDisplayGame, id: gameId }, longDisplayLists)
  assert.ok(story, 'long display names must not prevent a valid linked story')
  for (const paragraph of story.split('\n\n').slice(0, 3)) {
    assert.ok(paragraph.trim().split(/\s+/).length <= 75, 'measure the rendered paragraph, not the placeholders')
  }
  if (gameId === 2) {
    assert.doesNotMatch(story, /Captain Jake Strangeway|General Oliver Delta/,
      'use the recorded handles when long display names would exceed the paragraph limit')
  }
}

for (const mission of ['The Dig', 'Crossing Lines', 'Double Bind']) {
  assert.equal(hasUnsupportedStoryMissionVersion({ ...game, mission, date: '2026-09-23' }), true)
  assert.equal(hasUnsupportedStoryMissionVersion({ ...game, mission, date: '2026-09-24' }), true)
  assert.equal(hasUnsupportedStoryMissionVersion({ ...game, mission, date: '2026-09-26' }), false)
}

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
  const olderGame = { ...missingGame, date: '2026-09-23' } as RecentGame
  const olderLists = missingLists.map((list) => ({ ...list, date: '2026-09-23' })) as ArmyIntelligenceList[]
  assert.equal(renderGeneratedGameStory(olderGame, olderLists), null)
  assert.equal(await loadAuthoredBattleStory(olderGame, olderLists),
    UNSUPPORTED_MISSION_VERSION_BATTLE_STORY,
    'an older game cannot use the revised Dig generator without a historical version')
  const akialRows = JSON.parse(await readFile('public/game-stories/akial-interference.json', 'utf8')) as typeof template[]
  const akialKeys = new Set([...GAME_STORY_CATALOG, ...akialRows].map((row) =>
    storyTemplateKey(row.mission, ...row.factions)))
  const missingAkialPair = armies.flatMap((first, i) => armies.slice(i).map((second) =>
    [first.name, second.name] as const))
    .find(([first, second]) => !akialKeys.has(storyTemplateKey('Akial Interference', first, second)))
  assert.ok(missingAkialPair)
  const missingAkialGame = { ...game, mission: 'Akial Interference',
    winnerFaction: missingAkialPair[0], loserFaction: missingAkialPair[1] } as RecentGame
  const missingAkialLists = [
    { ...lists[0], mission: 'Akial Interference', sectorial: missingAkialPair[0] },
    { ...lists[1], mission: 'Akial Interference', sectorial: missingAkialPair[1] },
  ] as ArmyIntelligenceList[]
  globalThis.fetch = async () => Response.json(akialRows)
  assert.equal(await loadAuthoredBattleStory(missingAkialGame, missingAkialLists),
    MISSING_MISSION_SETUP_BATTLE_STORY, 'an unwritten Akial pair needs card data before runtime generation')
} finally {
  globalThis.fetch = originalFetch
}

console.log('Generated story engine: ' + covered + '/' + covered +
  ' canonical matchups have structurally valid scenes for four incidents and all hero roles.')
