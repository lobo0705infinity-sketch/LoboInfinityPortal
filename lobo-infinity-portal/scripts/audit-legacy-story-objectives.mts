import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GAME_STORY_CATALOG } from '../src/data/gameStoryCatalog.ts'
import manifest from '../src/data/storyManifest.json' with { type: 'json' }
import { storyTemplateKey } from '../src/services/gameStoryTemplate.ts'
import type { GameStoryTemplate } from '../src/services/gameStoryTemplate.ts'
import { assertGameStoryMissionObjective } from './game-story-quality.mts'

// A conservative text audit, not human mission approval. It records references
// missing from a plot or its endings without changing the legacy stories.
const outAt = process.argv.indexOf('--output')
const output = path.resolve(outAt < 0 ? '../legacy-story-objective-audit.csv' : process.argv[outAt + 1])
const rows: Array<{ story: GameStoryTemplate; source: string; index: number }> =
  GAME_STORY_CATALOG.map((story, index) => ({ story, source: 'inline catalog', index }))
for (const mission of manifest.missions) {
  const filename = mission.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json'
  const shard = JSON.parse(await readFile(`public/game-stories/${filename}`, 'utf8')) as GameStoryTemplate[]
  rows.push(...shard.map((story, index) => ({ story, source: filename, index })))
}
const csv = ['mission,matchup_key,source,zero_based_index,objective_signals_present,reason']
const counts = new Map<string, { candidates: number; flagged: number }>()
for (const { story, source, index } of rows) {
  const key = storyTemplateKey(story.mission, ...story.factions) ?? 'invalid-key'
  let error = ''
  try { assertGameStoryMissionObjective(story, key) }
  catch (failure) { error = failure instanceof Error ? failure.message : String(failure) }
  const summary = counts.get(story.mission) ?? { candidates: 0, flagged: 0 }
  if (error) summary.flagged++
  else summary.candidates++
  counts.set(story.mission, summary)
  const fields = [story.mission, key, source, String(index), String(!error), error]
  csv.push(fields.map((field) => '"' + field.replaceAll('"', '""') + '"').join(','))
}
await writeFile(output, csv.join('\n') + '\n', { flag: 'wx' })
console.log(`Legacy story objective audit: ${rows.length} structurally valid authored entries.`)
for (const [mission, { candidates, flagged }] of counts) {
  console.log(`${mission}: ${candidates} text candidates, ${flagged} flagged for review`)
}
console.log('Matches are text candidates, not human approval. Detailed report: ' + output)
