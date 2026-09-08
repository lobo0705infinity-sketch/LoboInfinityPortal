import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { assertRulesModelEvaluationAllowed } from './rules-adjudicator-model-gate.mjs'

const benchmark = JSON.parse(await readFile(new URL('../data/infinity-rules/rules-adjudicator-benchmark.json', import.meta.url), 'utf8'))
let networkRequests = 0
globalThis.fetch = async () => {
  networkRequests++
  throw new Error('Network access is forbidden during model-gate validation.')
}

assert.deepEqual(assertRulesModelEvaluationAllowed({ benchmark, live: false }), {
  allowed: true,
  mode: 'MOCK',
  approvedCases: 0,
})

assert.throws(
  () => assertRulesModelEvaluationAllowed({
    benchmark,
    live: true,
    maximum: 1,
    environment: { ALLOW_PAID_RULES_BENCHMARK: 'I_UNDERSTAND_THIS_COSTS_MONEY' },
  }),
  /0\/100 benchmark answers are formally approved/,
)

const approved = structuredClone(benchmark)
for (const item of approved.cases) {
  item.reviewStatus = 'APPROVED'
  item.approvedAnswer = item.draftAnswer
  item.approvedCitations = item.draftCitations
  item.approvedConclusion = item.draftConclusion
  item.approvedCertainty = item.draftCertainty
}
assert.throws(
  () => assertRulesModelEvaluationAllowed({ benchmark: approved, live: true, maximum: 1, environment: {} }),
  /explicit cost authorization is missing/,
)
assert.throws(
  () => assertRulesModelEvaluationAllowed({
    benchmark: approved,
    live: true,
    maximum: 0,
    environment: { ALLOW_PAID_RULES_BENCHMARK: 'I_UNDERSTAND_THIS_COSTS_MONEY' },
  }),
  /explicit --max-cases/,
)
assert.deepEqual(
  assertRulesModelEvaluationAllowed({
    benchmark: approved,
    live: true,
    maximum: 1,
    environment: { ALLOW_PAID_RULES_BENCHMARK: 'I_UNDERSTAND_THIS_COSTS_MONEY' },
  }),
  { allowed: true, mode: 'LIVE_PROVIDER', approvedCases: 100, maximum: 1 },
)
assert.equal(networkRequests, 0)
console.log('Rules model gate passed: incomplete approval, missing cost authorization, and invalid request limits are blocked before any network or provider request.')
