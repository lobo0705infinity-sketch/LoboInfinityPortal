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
    for (const question of questions) assert.equal(Boolean(await findApprovedRulesAnswer(question)), trusted, `${item.id}: ${question}`)
  }
}

assert.equal(await findApprovedRulesAnswer('purple bananas orbit a quantum teapot'), null)
assert.equal((await findApprovedRulesAnswer('May a Hidden Deployment trooper place a Mine without revealing itself?'))?.id, 'new-topic-2-482')
let calls = 0
const fallback = async ({ question }) => { calls++; return { question, status: 'FALLBACK' } }
const matched = await retrieveRulesReference({ question: 'What does Mimetism do?', deepSeek: fallback })
assert.equal(matched.answerSource, 'APPROVED_BENCHMARK')
assert.equal(calls, 0)
const unmatched = await retrieveRulesReference({ question: 'purple bananas orbit a quantum teapot', deepSeek: fallback })
assert.equal(unmatched.status, 'FALLBACK')
assert.equal(calls, 1)
console.log(`PASS - ${index.canonicalCases} trusted benchmark rulings route before DeepSeek; unmatched questions fall back exactly once.`)
