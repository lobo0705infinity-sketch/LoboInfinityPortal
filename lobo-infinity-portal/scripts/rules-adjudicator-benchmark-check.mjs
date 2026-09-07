import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const path = new URL('../data/infinity-rules/rules-adjudicator-benchmark.json', import.meta.url)
const benchmark = JSON.parse(await readFile(path, 'utf8'))
const allowedCategories = new Set(Object.keys(benchmark.expectedCategoryCounts))
const allowedStatuses = new Set(['PENDING', 'KNOWN_REGRESSION', 'APPROVED'])

assert.equal(benchmark.schemaVersion, 1)
assert.equal(benchmark.cases.length, 100)
assert.equal(benchmark.policy.networkRequestsDuringValidation, 0)
assert.equal(benchmark.policy.paidProviderRequestsDuringValidation, 0)
assert.equal(benchmark.policy.approvedAnswersRequiredBeforeRelease, 100)

const ids = new Set()
const counts = Object.fromEntries([...allowedCategories].map((category) => [category, 0]))
for (const item of benchmark.cases) {
  assert.equal(typeof item.id, 'string')
  assert.ok(item.id.length > 0 && !ids.has(item.id), `Duplicate or empty benchmark id: ${item.id}`)
  ids.add(item.id)
  assert.ok(allowedCategories.has(item.category), `Unknown category: ${item.category}`)
  assert.ok(allowedStatuses.has(item.reviewStatus), `Unknown review status: ${item.reviewStatus}`)
  assert.equal(typeof item.question, 'string')
  assert.ok(item.question.trim().length >= 8)
  counts[item.category]++
  if (item.reviewStatus === 'KNOWN_REGRESSION') {
    assert.ok(item.candidateExpectation?.expectedCoreResult)
    assert.ok(item.candidateExpectation?.requiredConcepts?.length >= 2)
  }
  if (item.reviewStatus === 'APPROVED') {
    assert.ok(item.approvedAnswer?.trim())
    assert.ok(item.approvedCitations.length > 0)
  } else {
    assert.equal(item.approvedAnswer, null)
    assert.deepEqual(item.approvedCitations, [])
  }
}
assert.deepEqual(counts, benchmark.expectedCategoryCounts)
assert.equal(benchmark.cases.filter((item) => item.reviewStatus === 'KNOWN_REGRESSION').length, 5)
assert.equal(benchmark.cases.filter((item) => item.reviewStatus === 'APPROVED').length, 0)
console.log('Validated 100-question rules benchmark inventory with 5 known regressions, 0 falsely approved answers, and 0 network requests.')
