import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { SOURCED_STORY_SCENARIOS } from '../src/data/generatedStoryScenarios.ts'
import { composeGameStory } from '../src/services/generatedGameStory.ts'
import type { HeroRole } from '../src/services/gameStoryTemplate.ts'

// A fixed editorial sample: five scenes per mission, including one mirror,
// each role, all four incident variants, and all three possible endings. JSONL is
// easier to filter during a human review than 110 consecutive prose blocks.
const armies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
const roles: readonly HeroRole[] = ['objective', 'gunfighting', 'closeCombat']
const middleParagraphs = new Set<string>()
let highestOverlap = { score: 0, mission: '' }

function trigrams(value: string): Set<string> {
  const words = value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return new Set(words.slice(2).map((_, index) => words.slice(index, index + 3).join(' ')))
}

function overlap(first: string, second: string): number {
  const a = trigrams(first)
  const b = trigrams(second)
  const shared = [...a].filter((gram) => b.has(gram)).length
  return shared / (a.size + b.size - shared)
}

for (const [missionIndex, mission] of CANONICAL_MISSIONS.entries()) {
  const incidents = SOURCED_STORY_SCENARIOS[mission]?.incidents
  if (!incidents) throw new Error('Missing scenario source: ' + mission)
  const missionMiddles: string[] = []
  for (let offset = 0; offset < 5; offset++) {
    const heroFaction = armies[(missionIndex * 7 + offset * 3) % armies.length].name
    const otherFaction = offset === 2 ? heroFaction :
      armies[(missionIndex * 13 + offset * 9 + 17) % armies.length].name
    const role = roles[(missionIndex + offset) % roles.length]
    const incidentIndex = Math.min(offset, 3)
    const gameId = [0, 1, 2, 3].find((candidate) =>
      composeGameStory(mission, heroFaction, otherFaction, heroFaction, role, candidate)
        ?.paragraphs[0].startsWith(incidents[incidentIndex].opening))
    if (gameId === undefined) throw new Error('Incident was not selectable: ' + mission)
    const story = composeGameStory(mission, heroFaction, otherFaction, heroFaction, role, gameId)
    if (!story) throw new Error('Missing editorial sample: ' + mission)
    middleParagraphs.add(story.paragraphs[1])
    if (offset < 4) missionMiddles.push(story.paragraphs[1])
    // factions is an unordered catalog key; these two fields bind the
    // placeholders in narrative order for human-facing samples.
    console.log(JSON.stringify({ mission, factions: story.factions, heroFaction,
      otherFaction, role,
      mirror: heroFaction === otherFaction, gameId, incidentIndex,
      paragraphs: story.paragraphs, endings: story.endings }))
  }
  if (new Set(missionMiddles).size !== 4) throw new Error('Repeated incident: ' + mission)
  for (let i = 0; i < missionMiddles.length; i++) {
    for (let j = i + 1; j < missionMiddles.length; j++) {
      const score = overlap(missionMiddles[i], missionMiddles[j])
      if (score > highestOverlap.score) highestOverlap = { score, mission }
    }
  }
}
console.error('Editorial sample: 110 scenes, 22 missions, 22 mirrors, ' +
  middleParagraphs.size + ' distinct incident paragraphs. Highest within-mission middle-paragraph ' +
  '3-gram Jaccard: ' + highestOverlap.score.toFixed(3) + ' (' + highestOverlap.mission + '). ' +
  'Repetition still requires human review.')
