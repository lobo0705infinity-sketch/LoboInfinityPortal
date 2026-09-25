import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { GAME_STORY_CATALOG } from '../src/data/gameStoryCatalog.ts'
import { storyTemplateKey } from '../src/services/gameStoryTemplate.ts'
import type { GameStoryTemplate } from '../src/services/gameStoryTemplate.ts'
import { assertGameStoryQuality } from './game-story-quality.mts'

const position = process.argv.indexOf('--input')
const input = position >= 0 ? process.argv[position + 1] : ''
if (!input) throw new Error('Pass --input path to a completed Responses Batch output JSONL file.')
const dryRun = process.argv.includes('--dry-run')
const directory = 'public/game-stories'
const slug = (mission: string) => mission.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const existing = new Map<string, GameStoryTemplate>()
for (const story of GAME_STORY_CATALOG) existing.set(storyTemplateKey(story.mission, ...story.factions)!, story)
for (const mission of CANONICAL_MISSIONS) {
  const file = join(directory, `${slug(mission)}.json`)
  const stories = await readFile(file, 'utf8').then(JSON.parse).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return []
    throw error
  }) as GameStoryTemplate[]
  for (const story of stories) {
    const key = storyTemplateKey(story.mission, ...story.factions)
    assert.ok(key && !existing.has(key), `Duplicate existing story: ${key}`)
    existing.set(key, story)
  }
}

const incoming = new Map<string, GameStoryTemplate>()
const source = await readFile(input, 'utf8')
for (const [index, line] of source.trim().split('\n').entries()) {
  if (!line.trim()) continue
  const item = JSON.parse(line)
  assert.equal(item.response?.status_code, 200, `Batch row ${index + 1} did not succeed`)
  const body = item.response.body
  assert.equal(body?.status, 'completed', `Batch row ${index + 1} is not complete`)
  const text = body.output?.flatMap((message: { content?: Array<{ type: string; text?: string }> }) =>
    message.content?.filter((part) => part.type === 'output_text').map((part) => part.text) ?? []).join('')
  assert.ok(text, `Batch row ${index + 1} has no structured story text`)
  const story = JSON.parse(text) as GameStoryTemplate
  const key = storyTemplateKey(story.mission, ...story.factions)
  assert.equal(key, item.custom_id, `Batch row ${index + 1}: mismatched mission and armies`)
  assert.ok(!existing.has(key) && !incoming.has(key), `Duplicate story: ${key}`)
  assertGameStoryQuality(story, key!)
  assert.ok(!/\b(?:OP|VP|TP)\b|the record (?:shows|does not)|submitted highlight/i.test(story.paragraphs.join(' ')), `${key}: factual review instead of fiction`)
  incoming.set(key!, story)
}

console.log(`Validated ${incoming.size} new, distinct mission-matchup scenes. Human review of a sample remains required.`)
if (dryRun) process.exit(0)

const byMission = new Map<string, GameStoryTemplate[]>()
for (const [key, story] of [...existing, ...incoming]) {
  if (!incoming.has(key) && GAME_STORY_CATALOG.includes(story)) continue
  byMission.set(story.mission, [...(byMission.get(story.mission) ?? []), story])
}
await mkdir(directory, { recursive: true })
for (const [mission, stories] of byMission) {
  const file = join(directory, `${slug(mission)}.json`)
  await writeFile(file, `${JSON.stringify(stories.sort((left, right) =>
    storyTemplateKey(left.mission, ...left.factions)!.localeCompare(storyTemplateKey(right.mission, ...right.factions)!)), null, 2)}\n`)
}
await writeFile('src/data/storyManifest.json', `${JSON.stringify({ missions: [...byMission.keys()].sort() }, null, 2)}\n`)
console.log(`Wrote ${byMission.size} on-demand mission files. Run npm run test:game-stories:complete before release.`)
