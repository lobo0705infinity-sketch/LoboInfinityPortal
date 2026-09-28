import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { GAME_STORY_CATALOG } from '../src/data/gameStoryCatalog.ts'
import storyManifest from '../src/data/storyManifest.json' with { type: 'json' }
import legacyHashes from './game-story-legacy-baseline.json' with { type: 'json' }
import { GAME_HIGHLIGHT_STORIES, renderSubmittedHighlightStory } from '../src/data/gameHighlightStories.ts'
import { getSubmittedHighlightBattleStory } from '../src/services/gameStoryRouting.ts'
import { renderGameStoryTemplate, selectStoryHero, storyModelReference, storyTemplateKey } from '../src/services/gameStoryTemplate.ts'
import type { ArmyIntelligenceDecodedEntry, ArmyIntelligenceList, RecentGame } from '../src/services/api.ts'
import { assertGameStoryMissionObjective, assertGameStoryQuality, assertLegacyStoryQuality } from './game-story-quality.mts'

const activeArmies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
const expected = CANONICAL_MISSIONS.length * activeArmies.length * (activeArmies.length + 1) / 2
const keys = new Set<string>()
const distinctScenes = new Set<string>()
const stories = [...GAME_STORY_CATALOG]
assert.equal(Object.keys(legacyHashes).length, 1300, 'legacy baseline must remain the 1,300 reviewed versions')
for (const mission of storyManifest.missions as string[]) {
  assert.ok(CANONICAL_MISSIONS.some((name) => name === mission), `Unknown story shard mission: ${mission}`)
  const filename = mission.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const rows = JSON.parse(await readFile(`public/game-stories/${filename}.json`, 'utf8')) as typeof GAME_STORY_CATALOG[number][]
  assert.ok(rows.every((row) => row.mission === mission), `${mission}: mixed mission shard`)
  stories.push(...rows)
}
for (const story of stories) {
  const key = storyTemplateKey(story.mission, ...story.factions)
  assert.ok(key, `invalid story identity: ${story.mission}/${story.factions.join('/')}`)
  assert.ok(!keys.has(key), `duplicate story identity: ${key}`)
  keys.add(key)
  // Grandfather only the exact 1,300 existing story versions. Newly added or
  // edited stories must pass both strict gates even before catalog completion.
  // A complete release must recheck every row, including unchanged legacy.
  const digest = createHash('sha256').update(JSON.stringify(story)).digest('hex')
  const unchangedLegacy = legacyHashes[key as keyof typeof legacyHashes] === digest
  if (process.argv.includes('--require-complete') || !unchangedLegacy) {
    assertGameStoryQuality(story, key)
    assertGameStoryMissionObjective(story, key)
  } else assertLegacyStoryQuality(story, key)
  const scene = story.paragraphs.join(' ').replaceAll(/\{\{\w+\}\}/g, 'HERO').replaceAll(/\s+/g, ' ')
  assert.ok(!distinctScenes.has(scene), `${key}: repeated story scene`)
  distinctScenes.add(scene)
}
assert.equal(storyTemplateKey('The Dig', 'Next Wave', 'Operations Subsection'), storyTemplateKey('The Dig', 'Operations Subsection', 'Next Wave'))
assert.notEqual(storyTemplateKey('The Dig', 'Next Wave', 'Operations Subsection'), storyTemplateKey('Dead Man\'s Switch', 'Next Wave', 'Operations Subsection'))

const entry = (unit: string, points: number, extras: Partial<ArmyIntelligenceDecodedEntry> = {}) => ({
  unit, profile: unit, points, canonicalUnitId: 0, combinedId: `${unit}-${points}`, specialist: false,
  hacker: false, engineer: false, doctor: false, forwardObserver: false, bs: 12, weapons: [], skills: [],
  ...extras,
}) as ArmyIntelligenceDecodedEntry
const list = (player: string, sectorial: string, opponent: string, entries: ArmyIntelligenceDecodedEntry[]) => ({
  player, sectorial, opponent, mission: 'The Dig', date: '2026-09-16', status: 'decoded',
  decoded: { combatGroups: [{ entries }] },
}) as ArmyIntelligenceList
const nextWave = list('Brooke', 'Next Wave', 'Blitchga', [
  entry('IRONSIDE', 44, { canonicalUnitId: 1881, weapons: ['AP Heavy Machine Gun'], bs: 13 }),
  entry('IRONSIDE', 34, { canonicalUnitId: 1881, skills: ['Hacker'] }),
  entry('PANDORA', 26, { canonicalUnitId: 1859, hacker: true }),
  entry('TEUCER', 37, { canonicalUnitId: 1860, weapons: ['Plasma Sniper Rifle'], bs: 14 }),
])
const operations = list('Blitchga', 'Operations Subsection', 'Brooke', [
  entry('ASURA', 67, { canonicalUnitId: 584, hacker: true, weapons: ['MULTI Marksman Rifle'], bs: 14 }),
])
const game = {
  mission: 'The Dig', date: '2026-09-16T04:00:00.000Z', winner: 'Brooke', winnerDisplayName: 'Brooke',
  winnerFaction: 'Next Wave', loser: 'Blitchga', loserDisplayName: 'Blitchga', loserFaction: 'Operations Subsection',
  tp: '5–2', op: '6–5', vp: '163–182', gameResult: 'win',
} as RecentGame
assert.equal(selectStoryHero(nextWave, 'objective')?.points, 34, 'expensive gunfighter must not displace objective specialist')
assert.equal(selectStoryHero(nextWave, 'gunfighting')?.points, 44)
assert.equal(storyModelReference(nextWave.decoded!.combatGroups[0].entries[2]), 'Pandora')
assert.equal(storyModelReference(operations.decoded!.combatGroups[0].entries[0]), 'the Asura')
assert.equal(storyModelReference(entry('WALLACE', 38, { canonicalUnitId: 259 })), 'William Wallace')
assert.equal(storyModelReference(entry('RAVENEYE', 17, { canonicalUnitId: 1588 })), 'the Raveneye')
assert.equal(storyModelReference(entry('SĀCHĀ', 6, { canonicalUnitId: 1874 })), 'the Sāchā')
const story = GAME_STORY_CATALOG[0]
const rendered = renderGameStoryTemplate(story, game, [nextWave, operations])
assert.match(rendered || '', /Teucer’s fire/)
assert.match(rendered || '', /the Ironside to descend/)
assert.match(rendered || '', /The Asura appeared/)
assert.doesNotMatch(rendered || '', /(^|[.!?]\s+)the /m, 'sentence-opening unit article must be capitalized')
assert.match(rendered || '', /Brooke already had the answer/)
assert.equal(renderGameStoryTemplate(story, game, [nextWave]), null, 'wait for both decoded lists')
assert.equal(getSubmittedHighlightBattleStory(game), null, 'the historical matchup catalog is outside the pilot story route')
assert.equal(renderGameStoryTemplate(story, game, [nextWave, { ...operations, date: '2026-09-17' }]), null, 'never use another day’s list')
assert.equal(renderGameStoryTemplate(story, game, [nextWave, operations, { ...operations }]), null, 'ambiguous opponent list must not be guessed')

const highlights = [
  { id: 109, mission: "Dead Man's Switch", winnerFaction: 'Corregidor Jurisdictional Command', loserFaction: 'Torchlight Brigade', bestMoment: 'Came down to the last moment where the Raveneye on his second order almost won the game single handedly!', fragment: 'the Raveneye had a moment to finish' },
  { id: 114, mission: "Dead Man's Switch", winnerFaction: 'Shindenbutai', loserFaction: 'Operations Subsection', bestMoment: "Hatamoto used Quantum Resonance and stole the box and then dodged his way back from Sacha's E/M Grenade", fragment: 'the Sāchā’s E/M grenade' },
  { id: 116, mission: 'The Dig', winnerFaction: 'Next Wave', loserFaction: 'StarCo', bestMoment: 'Tuecer killing both a Tsyklon and the engineer that went to pick it up.', fragment: 'Teucer had stayed in position' },
  { id: 117, mission: 'The Dig', winnerFaction: 'Operations Subsection', loserFaction: 'Ramah Taskforce', bestMoment: 'Yadu HRL Taking out Tariq on opponents turn 1', fragment: 'Tarik took the first turn' },
]
assert.equal(GAME_HIGHLIGHT_STORIES.length, highlights.length)
for (const item of highlights) {
  const exemplar = { ...game, ...item, winner: 'A', winnerDisplayName: 'A', loser: 'B', loserDisplayName: 'B' }
  assert.ok(renderSubmittedHighlightStory(exemplar)?.toLocaleLowerCase().includes(item.fragment.toLocaleLowerCase()), `game ${item.id}: authored player scene`)
  assert.equal(getSubmittedHighlightBattleStory(exemplar), renderSubmittedHighlightStory(exemplar), 'submitted player scenes retain priority')
  assert.equal(renderSubmittedHighlightStory({ ...exemplar, bestMoment: 'He rolled better than me' }), null, 'changed or unusable note cannot trigger a stale scene')
}

console.log(`Story catalog: ${keys.size}/${expected} distinct mission-matchup stories authored.`)
if (process.argv.includes('--require-complete')) {
  for (const mission of CANONICAL_MISSIONS) {
    for (let i = 0; i < activeArmies.length; i++) {
      for (let j = i; j < activeArmies.length; j++) {
        const key = storyTemplateKey(mission, activeArmies[i].name, activeArmies[j].name)
        assert.ok(keys.has(key!), `Missing mission-matchup story: ${key}`)
      }
    }
  }
  assert.equal(keys.size, expected, 'Do not declare the full story catalog complete')
}
