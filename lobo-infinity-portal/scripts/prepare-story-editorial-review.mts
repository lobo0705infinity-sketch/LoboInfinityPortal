import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { SOURCED_STORY_SCENARIOS } from '../src/data/generatedStoryScenarios.ts'
import { composeGameStory } from '../src/services/generatedGameStory.ts'
import type { GameStoryTemplate, HeroRole } from '../src/services/gameStoryTemplate.ts'

// Run from the app directory. The packet contains no provenance; keep the
// separate answer key private until every reviewer has returned a scorecard.
const outArg = process.argv.indexOf('--output-dir')
const seedArg = process.argv.indexOf('--seed')
const outputDir = path.resolve(outArg < 0 ? '../story-editorial-review' : process.argv[outArg + 1])
const seed = seedArg < 0 ? randomBytes(24).toString('hex') : process.argv[seedArg + 1]
assert.ok(seed && seed.length >= 16, 'Provide a seed of at least 16 characters')
const shardMissions = ['Akial Interference', 'Area of Interest', "Dead Man's Switch", 'Hardlock', 'The Dig']
const quotas: Record<HeroRole, number> = { objective: 3, gunfighting: 3, closeCombat: 2 }
const endings = ['heroWins', 'heroLoses', 'draw'] as const
const activeArmies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
type ShardRow = GameStoryTemplate & { role: HeroRole }

function digest(value: string): string {
  return createHash('sha256').update(seed + '|' + value).digest('hex')
}

function ordered<T>(entries: readonly T[], identify: (entry: T) => string): T[] {
  return [...entries].sort((a, b) => digest(identify(a)).localeCompare(digest(identify(b))))
}

function slug(mission: string): string {
  return mission.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalized(value: string, winner: 'A' | 'B' = 'A'): string {
  const tokens: Record<string, string> = {
    '{{heroPlayer}}': 'Player A', '{{otherPlayer}}': 'Player B',
    '{{hero}}': 'the operative', '{{allyGunfighter}}': 'an allied gunfighter',
    '{{enemyGunfighter}}': 'an opposing gunfighter',
    '{{winner}}': 'Player ' + winner, '{{loser}}': 'Player ' + (winner === 'A' ? 'B' : 'A'),
  }
  const prose = Object.entries(tokens).reduce((text, [token, replacement]) =>
    text.replaceAll(token, replacement), value)
  assert.doesNotMatch(prose, /\{\{[^}]+\}\}/, 'unresolved token in review packet')
  return prose.replace(/(^|[.!?]\s+)(the|a|an)\b/g,
    (_, before: string, article: string) => before + article[0].toUpperCase() + article.slice(1))
}

function render(story: GameStoryTemplate): string {
  assert.equal(story.paragraphs.length, 3)
  return story.paragraphs.map((paragraph) => normalized(paragraph)).join('\n\n') +
    '\n\n**Alternative endings** (the game would show only the applicable one):\n\n' +
    '- Player A wins: ' + normalized(story.endings.heroWins) + '\n' +
    '- Player B wins: ' + normalized(story.endings.heroLoses, 'B') + '\n' +
    '- Draw: ' + normalized(story.endings.draw) + '\n'
}

const selected: { mission: string; row: ShardRow; shardIndex: number }[] = []
for (const mission of shardMissions) {
  const filename = slug(mission) + '.json'
  const rows = JSON.parse(await readFile(new URL('../public/game-stories/' + filename, import.meta.url), 'utf8')) as ShardRow[]
  const choices = ordered(rows.map((row, shardIndex) => ({ mission, row, shardIndex })),
    (item) => mission + ':' + item.shardIndex)
  const picked: typeof choices = []
  const counts: Record<HeroRole, number> = { objective: 0, gunfighting: 0, closeCombat: 0 }
  // Each mission contributes a mirror match when the authored shard has one.
  const mirror = choices.find((item) => item.row.factions[0] === item.row.factions[1])
  if (mirror) { picked.push(mirror); counts[mirror.row.role]++ }
  for (const role of ['objective', 'gunfighting', 'closeCombat'] as const) {
    while (counts[role] < quotas[role]) {
      const available = choices.filter((item) => item.row.role === role && !picked.includes(item))
      // Diversity is a predeclared selection rule, never an editorial choice.
      const used = new Set(picked.flatMap((item) => item.row.factions))
      const next = available.find((item) => item.row.factions.some((army) => !used.has(army))) ?? available[0]
      assert.ok(next, `not enough ${role} stories for ${mission}`)
      assert.ok(composeGameStory(mission, ...next.row.factions, next.row.heroFaction, role),
        `cannot generate a matched comparison for ${mission} ${next.shardIndex}`)
      picked.push(next)
      counts[role]++
    }
  }
  assert.equal(picked.length, 8, mission + ': exactly eight paired cases')
  selected.push(...picked)
}
assert.equal(selected.length, 40)

const packet: string[] = [
  '# Blind battle-story review · pilot',
  '',
  'Review packet for draft story engine. Each matched pair has the **same mission, armies, hero faction, and hero role**. A and B are randomly ordered; neither letter identifies a source. Compare prose, specific faction behavior, mission objective, incident, and all three endings. Only one ending appears in a live report. Player A/B and “the operative” are identical illustrative stand-ins in both stories: no real roster or game outcome is asserted here.',
  '',
  'Do not inspect the catalog, generator, or answer key until scores are submitted. Record scores in the accompanying scorecard. The final panel is a *generated-only*, clearly marked mission-premise audit across all 22 missions; it is separate from the blinded comparison.',
  '',
  '## Panel 1: source-blind matched pairs (40)',
]
const key: { seed: string; selection: string; matched: unknown[]; premise: unknown[] } = {
  seed, selection: 'five shard missions × eight cases; three objective, three gunfighting, two closeCombat per mission; one mirror per mission when available; SHA-256 seeded order; random A/B position',
  matched: [], premise: [],
}
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
Object.assign(key, { sourceRevision })
const scoreRows: string[] = ['case_id,candidate,reviewer,prose_1_5,mission_1_5,faction_1_5,incident_1_5,endings_1_5,critical_issue,major_issue,preferred_A_or_B,notes']
const paired = ordered(selected, (entry) => entry.mission + ':' + entry.shardIndex + ':case')
for (const [index, entry] of paired.entries()) {
  const caseId = 'R' + String(index + 1).padStart(2, '0')
  const { mission, row, shardIndex } = entry
  const scenario = SOURCED_STORY_SCENARIOS[mission]
  assert.ok(scenario)
  // Spread all four incidents per mission rather than relying on one default.
  const incidentIndex = (index + shardMissions.indexOf(mission)) % 4
  const gameId = [0, 1, 2, 3].find((candidate) => {
    const possible = composeGameStory(mission, ...row.factions, row.heroFaction, row.role, candidate)
    return mission === 'Area of Interest'
      ? possible?.paragraphs[1].startsWith(scenario.incidents[incidentIndex].complication)
      : possible?.paragraphs[0].startsWith(scenario.incidents[incidentIndex].opening)
  })
  assert.notEqual(gameId, undefined, `${caseId}: cannot select incident ${incidentIndex}`)
  const generated = composeGameStory(mission, ...row.factions, row.heroFaction, row.role, gameId)
  assert.ok(generated)
  const generatedIsA = Number.parseInt(digest(caseId + ':position').slice(0, 2), 16) % 2 === 0
  const a = generatedIsA ? generated : row
  const b = generatedIsA ? row : generated
  const opponent = row.factions.find((army) => army !== row.heroFaction) ?? row.heroFaction
  packet.push('', `### ${caseId} · ${mission} · ${row.role}`, '',
    `Player A: ${row.heroFaction}. Player B: ${opponent}.`, '',
    '**Story A**', '', render(a), '', '**Story B**', '', render(b))
  ;(key.matched as unknown[]).push({ caseId, mission, factions: row.factions, heroFaction: row.heroFaction,
    role: row.role, authoredShard: slug(mission) + '.json', authoredShardIndex: shardIndex,
    generatedGameId: gameId, generatedIncidentIndex: incidentIndex,
    generatedSceneTags: generated.sceneTags ?? null, storyA: generatedIsA ? 'generated' : 'authored',
    storyB: generatedIsA ? 'authored' : 'generated' })
  for (const letter of ['A', 'B']) scoreRows.push(`${caseId},${letter},,,,,,,,,,`)
}

packet.push('', '## Panel 2: mission premise and outcome check (22)', '',
  'These examples are openly generated previews, one per canonical mission. For Critical Intervention and Double Bind, the application refuses runtime generation because the recorded games omit necessary setup; judge their plot concepts but do not count them as available coverage. Check each linked mission source and flag scenario-version uncertainty.', '')
for (const [index, mission] of CANONICAL_MISSIONS.entries()) {
  const first = activeArmies[index * 2].name
  const second = activeArmies[index * 2 + 1].name
  const heroFaction = index % 2 ? second : first
  const otherFaction = index % 2 ? first : second
  const role: HeroRole = (['objective', 'gunfighting', 'closeCombat'] as const)[index % 3]
  const scene = composeGameStory(mission, first, second, heroFaction, role, index % 4)
  const scenario = SOURCED_STORY_SCENARIOS[mission]
  assert.ok(scene && scenario, mission + ': missing mission preview')
  const caseId = 'M' + String(index + 1).padStart(2, '0')
  packet.push(`### ${caseId} · ${mission} · ${role}${scenario.requiresUnreportedSetup ? ' · preview only' : ''}`,
    '', `Player A: ${heroFaction}. Player B: ${otherFaction}.`, '',
    `Mission source: ${scenario.source} (${scenario.season}).`, '', render(scene), '')
  ;(key.premise as unknown[]).push({ caseId, mission, season: scenario.season,
    source: scenario.source, heroFaction, otherFaction, role, gameId: index % 4,
    sceneTags: scene.sceneTags ?? null, runtimeAvailable: !scenario.requiresUnreportedSetup })
  scoreRows.push(`${caseId},A,,,,,,,,,,`)
}

const guide = `# Battle-story pilot · review and release rubric

**State:** Draft. The 1,300 authored entries remain separate from generated combinations. The paired packet contains 40 generated and 40 authored stories from the five missions with authored shards; a separate 22-story panel covers every mission. Neither the structural gate nor this packet grants release approval.

## How to review

1. Ask at least two readers who have not seen the generator or answer key to independently read and score every matched case. Split cases across readers if needed, but obtain two independent scores for each case. Use the supplied CSV as a blank template; make one copy per reader. Do not share the answer key yet.
2. Score **each story** 1–5 for prose (clear, natural, not formulaic), mission (objectives and sequence accurate for the linked edition), faction (tactics and choices distinguish both armies), incident (specific causal plot and role-appropriate operative action), and endings (each of win/loss/draw resolves the objective consistently). For matched cases, record a preferred A or B, or tie, in the preference field. Score the 22 openly generated mission previews on the same scale, checking their linked sources.
3. Flag **critical** for a false mission objective, unsupported setup, a contradictory result, or text presented as an account of real match events without supporting records. Flag **major** for generic interchangeable factions, repetitive beats, implausible role actions, or an ending that omits the objective. Note concrete sentences so fixes can be targeted. A factual match review also requires the recorded game and both decoded, unambiguous rosters; these previews do not supply them.
4. Freeze scorecards before opening the private key. Unblind, compare generated and authored scores by mission and role, adjudicate critical disagreements against the linked rules, then revise the generator and run a new sample. Never count generated scenes as individually authored entries.

## Predeclared pilot threshold

- Every one of the 22 missions must have its core objective and all three endings checked against the indicated scenario edition, with **zero unresolved critical errors**. The two setup-dependent missions remain previews until recorded setup exists.
- In the 40 matched cases, at least **80% of generated stories score 4/5 or better** in prose, mission, faction, incident, and endings, using the average of two readers for each dimension. Mean generated score must be no more than **0.5 points below authored** in each dimension. Any critical error blocks approval regardless of averages.
- Review a separate sample of **actual recorded games** with linked rosters, chosen before looking at generated text. Verify player/faction assignment, hero eligibility, name rendering, the chosen result, and that invented scenery, weather, tactics, and model actions are clearly labeled as fictional. This packet cannot pass that game-record test on its own.

If a criterion fails, document examples and repeat the blind review with unseen cases. If criteria pass, the commissioner still decides whether a clearly labeled fictional fallback belongs on a game page or Discord feed; do not merge or deploy the pilot solely because ratings passed.

**Edition check:** Corvus Belli's [24 September 2026 ITS 18 hotfix](https://infinityuniverse.com/en/news/its18-hotfix-september) clarified The Dig's analysis/neutralization sequence, Double Bind's selected objectives and antenna repairs, and Crossing Lines' HVT/classified status. Read the mission edition and hotfix before scoring these cases. Older game records may have been played under a different edition; avoid applying today's mission details retroactively.

## Reproduce a review

From the app directory, run \`node --experimental-strip-types scripts/prepare-story-editorial-review.mts --output-dir <empty-private-directory> --seed <seed-from-private-key>\`. The script refuses to overwrite existing review files. Keep the private key away from reviewers until scores are frozen.
`

await mkdir(outputDir, { recursive: true })
for (const [name, contents] of [
  ['blind-story-review-packet.md', packet.join('\n') + '\n'],
  ['story-review-rubric.md', guide],
  ['story-review-scorecard.csv', scoreRows.join('\n') + '\n'],
  ['PRIVATE-story-review-answer-key.json', JSON.stringify(key, null, 2) + '\n'],
] as const) await writeFile(path.join(outputDir, name), contents, { flag: 'wx' })
console.log(`Wrote 40 matched pairs and 22 mission previews to ${outputDir}. Keep the answer key private.`)
