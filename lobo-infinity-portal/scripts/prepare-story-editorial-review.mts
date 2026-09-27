import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { SOURCED_STORY_SCENARIOS } from '../src/data/generatedStoryScenarios.ts'
import { composeGameStory } from '../src/services/generatedGameStory.ts'
import type { GameStoryTemplate, HeroRole } from '../src/services/gameStoryTemplate.ts'
import { assertGameStoryMissionObjective, assertGameStoryQuality } from './game-story-quality.mts'

// The older authored catalog is not a mission-fidelity reference set. This
// packet samples the generated pilot on its own terms, including reversals.
const outArg = process.argv.indexOf('--output-dir')
const seedArg = process.argv.indexOf('--seed')
const outputDir = path.resolve(outArg < 0 ? '../story-editorial-review' : process.argv[outArg + 1])
const seed = seedArg < 0 ? randomBytes(24).toString('hex') : process.argv[seedArg + 1]
assert.ok(seed && seed.length >= 16, 'Provide a seed of at least 16 characters')
const armies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
const roles: readonly HeroRole[] = ['objective', 'gunfighting', 'closeCombat']

function rank(value: string): string {
  return createHash('sha256').update(seed + '|' + value).digest('hex')
}

function normalize(value: string, winner: 'A' | 'B' = 'A'): string {
  const tokens: Record<string, string> = {
    '{{heroPlayer}}': 'Player A', '{{otherPlayer}}': 'Player B',
    '{{hero}}': 'the operative', '{{allyGunfighter}}': 'an allied gunfighter',
    '{{enemyGunfighter}}': 'an opposing gunfighter',
    '{{winner}}': 'Player ' + winner, '{{loser}}': 'Player ' + (winner === 'A' ? 'B' : 'A'),
  }
  const rendered = Object.entries(tokens).reduce((text, [token, replacement]) =>
    text.replaceAll(token, replacement), value)
  assert.doesNotMatch(rendered, /\{\{[^}]+\}\}/)
  return rendered.replace(/(^|[.!?]\s+)(the|a|an)\b/g,
    (_, before: string, article: string) => before + article[0].toUpperCase() + article.slice(1))
}

function render(story: GameStoryTemplate): string {
  assert.equal(story.paragraphs.length, 3)
  return story.paragraphs.map((paragraph) => normalize(paragraph)).join('\n\n') +
    '\n\n**Alternative endings** (a game displays only its applicable result):\n\n' +
    '- Player A wins: ' + normalize(story.endings.heroWins) + '\n' +
    '- Player B wins: ' + normalize(story.endings.heroLoses, 'B') + '\n' +
    '- Draw: ' + normalize(story.endings.draw) + '\n'
}

function selectGameId(mission: string, first: string, second: string,
  hero: string, role: HeroRole, incidentIndex: number): number {
  const scenario = SOURCED_STORY_SCENARIOS[mission]
  assert.ok(scenario)
  const gameId = [0, 1, 2, 3].find((candidate) => {
    const story = composeGameStory(mission, first, second, hero, role, candidate)
    return mission === 'Area of Interest'
      ? story?.paragraphs[1].startsWith(scenario.incidents[incidentIndex].complication)
      : story?.paragraphs[0].startsWith(scenario.incidents[incidentIndex].opening)
  })
  assert.notEqual(gameId, undefined, mission + ': incident not selectable')
  return gameId
}

type ReviewCase = { mission: string; hero: string; other: string; role: HeroRole;
  incident: number; gameId: number; story: GameStoryTemplate }
const groups: Array<{ mission: string; cases: ReviewCase[] }> = []
for (const [index, mission] of CANONICAL_MISSIONS.entries()) {
  const a = armies[(index * 2) % armies.length].name
  const b = armies[(index * 2 + 1) % armies.length].name
  const mirror = armies[(index * 2 + 2) % armies.length].name
  const c = armies[(index * 2 + 4) % armies.length].name
  const d = armies[(index * 2 + 5) % armies.length].name
  const e = armies[(index * 2 + 6) % armies.length].name
  const f = armies[(index * 2 + 7) % armies.length].name
  const firstRole = roles[index % roles.length]
  const selections: Array<[string, string, string, HeroRole, number]> = [
    [a, b, a, firstRole, 0],
    [a, b, b, firstRole, 0], // Same incident and factions, reversed hero side.
    [mirror, mirror, mirror, roles[(index + 1) % roles.length], 1],
    [c, d, c, roles[(index + 2) % roles.length], 2],
    [e, f, e, roles[(index + 1) % roles.length], 3],
  ]
  const cases = selections.map(([left, right, hero, role, incident]) => {
    const gameId = selectGameId(mission, left, right, hero, role, incident)
    const story = composeGameStory(mission, left, right, hero, role, gameId)
    assert.ok(story)
    assertGameStoryQuality(story, mission)
    assertGameStoryMissionObjective(story, mission)
    return { mission, hero, other: hero === left ? right : left, role, incident, gameId, story }
  })
  assert.equal(cases[0].gameId, cases[1].gameId, 'reversed sides must share their incident')
  if (mission === 'Area of Interest') assert.deepEqual(cases[0].story.sceneTags, cases[1].story.sceneTags)
  groups.push({ mission, cases })
}

const ordered = groups.sort((a, b) => rank(a.mission).localeCompare(rank(b.mission)))
const packet: string[] = [
  '# Generated battle-story editorial review',
  '',
  '**This replaces the earlier generated-versus-authored comparison.** An objective audit found the existing authored stories unsuitable as a mission-fidelity control. Every scene here is generated. Reviewers should not inspect the generator or its configuration before scoring. These are fictional scenes, not transcripts of reported matches.',
  '',
  'Each mission has five cases: the same incident with the hero faction reversed; one mirror; and two further incidents. Together they cover all four incidents and all three hero roles for each of the 22 missions. Player A/B and “the operative” are illustrative substitutions; real rosters and results are tested separately. Read all three alternative endings even though only one would appear for a game.',
]
const privateConfig = { status: 'generated-only pilot; previous authored answer key superseded',
  seed, sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  selection: '22 missions × five cases (one reversed, one mirror, four distinct incidents, three roles); seeded mission order',
  cases: [] as unknown[] }
const scores = ['case_id,mission,role,reviewer,prose_1_5,mission_1_5,faction_1_5,incident_1_5,endings_1_5,repetition_1_5,critical_issue,major_issue,notes']
let total = 0
for (const [groupIndex, group] of ordered.entries()) {
  const scenario = SOURCED_STORY_SCENARIOS[group.mission]
  assert.ok(scenario)
  packet.push('', `## Group ${groupIndex + 1}: ${group.mission}`, '',
    `Rule reference: ${scenario.source} (${scenario.season}).` +
    (scenario.requiresUnreportedSetup ? ' These are **preview-only** scenes: game records lack the chosen setup.' : ''), '')
  for (const [caseIndex, item] of group.cases.entries()) {
    const caseId = 'G' + String(groupIndex + 1).padStart(2, '0') + '-' + (caseIndex + 1)
    packet.push(`### ${caseId} · ${item.role}` + (caseIndex < 2 ? ' · faction reversal' : caseIndex === 2 ? ' · mirror' : ''),
      '', `Player A: ${item.hero}. Player B: ${item.other}.`, '', render(item.story), '')
    privateConfig.cases.push({ caseId, mission: group.mission,
      factions: item.story.factions, heroFaction: item.hero, role: item.role,
      gameId: item.gameId, incidentIndex: item.incident, sceneTags: item.story.sceneTags ?? null,
      runtimeAvailable: !scenario.requiresUnreportedSetup })
    scores.push(`${caseId},${group.mission},${item.role},,,,,,,,,,`)
    total++
  }
}
assert.equal(total, 110)

const guide = `# Generated story pilot · editorial rubric

**Status:** Draft. The earlier paired review was withdrawn: the existing authored stories often follow independent literary plots instead of the scenario objectives. They remain 1,300 structurally valid catalog entries, but they are not a valid benchmark for mission fidelity. No authored entry was rewritten or silently marked objective-verified.

## How to review the 110 generated scenes

1. Give the packet and a blank scorecard to **two independent readers** who have not seen the generator. Both readers score each case 1–5: natural prose, correct mission and edition, faction-specific choices, causal incident and role action, three objective-resolving endings, and variety compared with the other four stories in that mission group.
2. Check the linked mission rules. Each group has one reversed matchup (cases 1 and 2), a mirror (case 3), and all four incidents and three hero roles. Note verbatim phrases repeated across groups, generic faction swaps, endings inconsistent with the winner, and any action that pretends to record actual play. “The operative” is a shared illustrative stand-in; recorded games need an eligible named roster actor.
3. Flag **critical** for a false mission objective, an invalid setup, a contradictory outcome, or fictional details presented as observed match events. Flag **major** for repetitive sentence scaffolds, interchangeable armies, unmotivated scene events, or an ending that omits the mission stake. Record a sentence or case ID for every flag.
4. Freeze both scorecards before reading the configuration file. Resolve rule disagreements using the relevant mission edition. Separately test actual games with linked decoded rosters: player/army assignment, eligible hero, result, and clear labeling of invented setting and actions.

## Predeclared threshold

- All 22 mission premises and three endings per scene must have **zero unresolved critical errors**. Akial Interference, Critical Intervention and Double Bind stay preview-only until the drawn Common Classified cards, attacker assignment, or selected objective set is recorded as applicable.
- At least 80% of generated scenes need an average of **4/5 or better in every rated dimension** across two reviewers. No mission group should have an unaddressed repetition or faction-swap complaint. Revise weak groups, then review new, unseen scenes rather than scoring the same examples until they pass.
- Passing this review does not change the 22,770 individually authored target, prove fictional moves happened in a match, or authorize merging/deploying the pilot.

**Mission versions:** Corvus Belli's [September 24, 2026 ITS 18 hotfix](https://infinityuniverse.com/en/news/its18-hotfix-september) clarified The Dig's console analysis and Player Tokens, Double Bind's objective selection and Engineer/GizmoKit antenna repairs, and Crossing Lines' removal of the HVT and Classified Deck. This pilot does not simulate the Player Token state. Check the depicted sequence against the mission edition; older recorded games may use earlier editions.

Reproduce from the recorded source revision with \`node --experimental-strip-types scripts/prepare-story-editorial-review.mts --output-dir <empty-directory> --seed <seed-in-configuration>\`. The script refuses to overwrite review files.
`

await mkdir(outputDir, { recursive: true })
for (const [filename, contents] of [
  ['blind-story-review-packet.md', packet.join('\n') + '\n'],
  ['story-review-rubric.md', guide],
  ['story-review-scorecard.csv', scores.join('\n') + '\n'],
  ['PRIVATE-story-review-answer-key.json', JSON.stringify(privateConfig, null, 2) + '\n'],
] as const) await writeFile(path.join(outputDir, filename), contents, { flag: 'wx' })
console.log(`Wrote ${total} generated-only scenes across ${ordered.length} missions to ${outputDir}.`)
