import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { GAME_STORY_CATALOG } from '../src/data/gameStoryCatalog.ts'
import { storyTemplateKey } from '../src/services/gameStoryTemplate.ts'

const value = (flag: string) => {
  const index = process.argv.indexOf(flag)
  return index === -1 ? '' : process.argv[index + 1] || ''
}
const model = value('--model')
const output = value('--output') || '.tmp/game-story-batch.jsonl'
const selectedMission = value('--mission')
if (!model) throw new Error('Pass --model with a model available in the project’s API account.')
if (selectedMission && !CANONICAL_MISSIONS.some((mission) => mission === selectedMission)) {
  throw new Error(`Unknown canonical mission: ${selectedMission}`)
}
const missions = selectedMission ? [selectedMission] : CANONICAL_MISSIONS
const armies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
const written = new Set(GAME_STORY_CATALOG.map((story) => storyTemplateKey(story.mission, ...story.factions)))
const instructions = `Write an original, dramatic three-paragraph fictional battle scene for the specified Infinity mission and unordered army matchup. One independently written story is needed for every mission and army pair, including mirror games. The player-submitted highlight, when useful, has its own higher-priority story; this request supplies only the no-highlight fallback.

Write a small plot with a concrete opening, an escalating complication, a model's hero moment, and an image that closes the scene. Let the mission and both armies materially shape that plot. Never simply swap faction names in a generic story, and never make a faction's name the subject of an action verb. Use a person, a trooper, or a machine as the actor. This is openly fictional: do not claim to know actual turns, list contents, kills, scores, final objectives, or exact mission mechanics. Avoid invented named characters or specific unit types: the app will supply actual models from the submitted list.

Pick one of gunfighting, closeCombat, or objective as the hero role. Make the hero moment fit that role. The story must contain {{hero}}, a model selected from the highest-point eligible submitted profile. It may use {{allyGunfighter}} and {{enemyGunfighter}}. A unit type is automatically called 'the Raveneye'; a verified named character is called 'William Wallace'. Do not add your own article to {{hero}} or use he/she pronouns for that token; use 'the trooper' when needed. The players' names can be inserted with {{heroPlayer}} and {{otherPlayer}}. If both armies are the same, distinguish their two forces by those player tokens.

Return 3 paragraphs of 40-75 words each and 3 different one-sentence endings (heroWins, heroLoses, draw). Endings must suit the scene and not falsely imply the hero won when their player lost. Never use result summaries, numeric scores, disclaimers, coaching notes, or phrases like 'the record shows'. Make the writing varied, natural, and readable aloud.`

const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    mission: { type: 'string' },
    factions: { type: 'array', items: { type: 'string' } },
    heroFaction: { type: 'string' },
    role: { type: 'string', enum: ['gunfighting', 'closeCombat', 'objective'] },
    paragraphs: { type: 'array', items: { type: 'string' } },
    endings: {
      type: 'object', additionalProperties: false,
      properties: { heroWins: { type: 'string' }, heroLoses: { type: 'string' }, draw: { type: 'string' } },
      required: ['heroWins', 'heroLoses', 'draw'],
    },
  },
  required: ['mission', 'factions', 'heroFaction', 'role', 'paragraphs', 'endings'],
}

const lines: string[] = []
for (const mission of missions) {
  for (let i = 0; i < armies.length; i++) {
    for (let j = i; j < armies.length; j++) {
      const first = armies[i]
      const second = armies[j]
      const key = storyTemplateKey(mission, first.name, second.name)
      if (!key || written.has(key)) continue
      lines.push(JSON.stringify({
        custom_id: key,
        method: 'POST',
        url: '/v1/responses',
        body: {
          model,
          store: false,
          instructions,
          input: `Mission: ${mission}. Armies: ${first.name} and ${second.name}. Write their unique scene for this mission. Return these exact mission and faction labels; choose heroFaction from these two army names.`,
          text: { format: { type: 'json_schema', name: 'battle_story', strict: true, schema } },
          max_output_tokens: 750,
        },
      }))
    }
  }
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${lines.join('\n')}\n`)
console.log(`Prepared ${lines.length} missing mission-matchup requests in ${output}. This file has not been submitted.`)
