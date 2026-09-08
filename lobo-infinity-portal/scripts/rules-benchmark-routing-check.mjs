import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { findApprovedRulesAnswer, loadRulesBenchmark } from '../bot/rules-benchmark.mjs'
import { retrieveRulesReference } from '../bot/rules-command.mjs'

const root = resolve(import.meta.dirname, '..')
const index = await loadRulesBenchmark({ force: true })
assert.equal(index.canonicalCases, 1380)

for (const file of ['rules-adjudicator-benchmark.json', 'rules-adjudicator-expansion-400.json', 'rules-adjudicator-new-topics-400.json', 'rules-adjudicator-new-topics-500.json']) {
  const document = JSON.parse(await readFile(resolve(root, 'data/infinity-rules', file), 'utf8'))
  for (const item of document.cases || []) {
    const questions = [item.question, item.canonicalQuestion, ...(item.queryVariants || []).map((variant) => variant.question)].filter(Boolean)
    const trusted = item.reviewStatus === 'APPROVED' || item.reviewStatus === 'AUTO_VERIFIED_EXPLICIT' || file === 'rules-adjudicator-expansion-400.json' || (file === 'rules-adjudicator-new-topics-500.json' && Number(item.id.split('-').at(-1)) >= 481)
    for (const question of questions) {
      const match = await findApprovedRulesAnswer(question)
      assert.equal(Boolean(match), trusted, `${item.id}: ${question}`)
      if (trusted) {
        const expectedFamily = file === 'rules-adjudicator-expansion-400.json' ? item.canonicalId : item.id
        assert.equal(match.familyId, expectedFamily, `wrong ruling family for ${item.id}: ${question}`)
      }
    }
  }
}

assert.equal(await findApprovedRulesAnswer('purple bananas orbit a quantum teapot'), null)
assert.equal((await findApprovedRulesAnswer('May a Hidden Deployment trooper place a Mine without revealing itself?'))?.id, 'new-topic-2-482')
const naturalParaphrases = [
  ['Can a hidden deployment unit drop a mine and stay hidden?', 'new-topic-2-482'],
  ['Does stealth stop hacking AROs through a repeater?', 'new-topic-2-490'],
  ['What are the rules for dodging?', 'direct_definition-02'],
]
for (const [question, expectedId] of naturalParaphrases) {
  assert.equal((await findApprovedRulesAnswer(question))?.id, expectedId, question)
}
for (const question of [
  'Can Alert place a Mine?',
  'When is Alert allowed?',
  'Does Mimetism let a trooper hack through a Repeater?',
  'Can a purple unit shoot a quantum banana?',
]) {
  assert.equal(await findApprovedRulesAnswer(question), null, `unsafe match: ${question}`)
}
let calls = 0
const fallback = async ({ question }) => { calls++; return { question, status: 'FALLBACK' } }
const matched = await retrieveRulesReference({ question: 'What does Mimetism do?', deepSeek: fallback })
assert.equal(matched.answerSource, 'APPROVED_BENCHMARK')
assert.equal(calls, 0)
const unmatched = await retrieveRulesReference({ question: 'purple bananas orbit a quantum teapot', deepSeek: fallback })
assert.equal(unmatched.status, 'FALLBACK')
assert.equal(calls, 1)
console.log(`PASS - ${index.canonicalCases} trusted benchmark rulings route before DeepSeek; unmatched questions fall back exactly once.`)
