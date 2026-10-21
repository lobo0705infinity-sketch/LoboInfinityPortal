import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { retrieveRulesReference, formatRulesDiscordResponse } from '../bot/rules-command.mjs'
import { findApprovedRulesAnswer } from '../bot/rules-benchmark.mjs'

const document = JSON.parse(await readFile(new URL('../data/infinity-rules/rules-benchmark-approved-updates-2026-09-15.json', import.meta.url)))
let checked = 0
for (const id of ['new-topic-2-533', 'new-topic-2-534']) {
  const item = document.cases.find(item => item.id === id)
  for (const question of [item.canonicalQuestion, ...item.queryVariants.map(variant => variant.question)]) {
    const result = await retrieveRulesReference({ question, deepSeek: async () => { throw new Error('Reported question must bypass the AI provider') } })
    assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
    assert.equal(result.benchmark.id, id, question)
    assert.equal(result.deepSeek.conclusion, 'NO', question)
    assert.equal(result.deepSeek.certainty, item.approvedCertainty)
    assert.equal(result.deepSeek.interpretationRequired, id.endsWith('533'))
    assert.ok(result.deepSeek.sources.every(source => source.url.startsWith('https://infinitythewiki.com/')))
    assert.ok(result.deepSeek.sources.every(source => source.page === undefined))
    const payload = formatRulesDiscordResponse(result)
    const answer = payload.embeds[0].fields.find(field => field.name === 'ANSWER').value
    assert.ok(answer.length <= 1024)
    if (id.endsWith('533')) {
      assert.match(answer, /not an explicit official FAQ ruling/)
      assert.match(answer, /opponent or tournament organizer/)
      assert.doesNotMatch(answer, /EXPLICIT RULES ANSWER/)
    } else {
      assert.match(answer, /Round 1 CC kills do not count/)
      assert.match(JSON.stringify(payload), /ITS_FAQ#Akial_Interference/)
    }
    checked++
  }
}
for (const question of [
  'In Countermeasures, do kills before drawing Predator count?',
  'Do template weapons give my ally cover?',
  'Does Predator count earlier kills in a different mission?',
]) assert.ok(!['new-topic-2-533', 'new-topic-2-534'].includes((await findApprovedRulesAnswer(question))?.id), question)
console.log(`Friendly-fire Cover and Akial Predator: ${checked} no-provider answers, certainty labels, complete Discord replies, official links and unrelated-query guards passed.`)
