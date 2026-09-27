import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { composeGameStory } from '../src/services/generatedGameStory.ts'
import type { HeroRole } from '../src/services/gameStoryTemplate.ts'

// A fixed editorial sample: five scenes per mission, including one mirror,
// each role, both incident variants, and all three possible endings. JSONL is
// easier to filter during a human review than 110 consecutive prose blocks.
const armies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
const roles: readonly HeroRole[] = ['objective', 'gunfighting', 'closeCombat']
const middleParagraphs = new Set<string>()
for (const [missionIndex, mission] of CANONICAL_MISSIONS.entries()) {
  const first = armies[(missionIndex * 7) % armies.length].name
  const opponent = armies[(missionIndex * 13 + 17) % armies.length].name
  for (let offset = 0; offset < 5; offset++) {
    const heroFaction = offset === 2 ? armies[(missionIndex * 7 + 3) % armies.length].name :
      offset < 2 ? first : armies[(missionIndex * 7 + offset * 3) % armies.length].name
    const otherFaction = offset === 2 ? heroFaction : offset < 2 ? opponent :
      armies[(missionIndex * 13 + offset * 9 + 17) % armies.length].name
    const role = roles[(missionIndex + offset) % roles.length]
    const story = composeGameStory(mission, heroFaction, otherFaction, heroFaction, role, offset % 2)
    if (!story) throw new Error('Missing editorial sample: ' + mission)
    middleParagraphs.add(story.paragraphs[1])
    console.log(JSON.stringify({ mission, factions: story.factions, heroFaction, role,
      mirror: heroFaction === otherFaction, gameId: offset % 2,
      paragraphs: story.paragraphs, endings: story.endings }))
  }
}
console.error('Editorial sample: 110 scenes, 22 missions, 22 mirrors, ' +
  middleParagraphs.size + ' distinct incident paragraphs. Repetition still requires human review.')
