import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const path = new URL('../data/infinity-rules/rules-adjudicator-benchmark.json', import.meta.url)
const benchmark = JSON.parse(await readFile(path, 'utf8'))
const allowedCategories = new Set(Object.keys(benchmark.expectedCategoryCounts))
const allowedStatuses = new Set(['PENDING', 'KNOWN_REGRESSION', 'VERIFIED_DRAFT', 'APPROVED'])
const allowedConclusions = new Set(['YES', 'NO', 'INTERPRETATION', 'UNRESOLVED'])

assert.equal(benchmark.schemaVersion, 1)
assert.equal(benchmark.cases.length, 100)
assert.equal(benchmark.policy.networkRequestsDuringValidation, 0)
assert.equal(benchmark.policy.paidProviderRequestsDuringValidation, 0)
assert.equal(benchmark.policy.approvedAnswersRequiredBeforeRelease, 100)
assert.equal(benchmark.semanticAudit?.auditedCases, 100)
assert.equal(benchmark.semanticAudit?.totalCases, 100)
assert.equal(benchmark.semanticContracts?.contractedCases, 85)

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
  assert.equal(item.semanticAuditStatus, 'PASSED', `Semantic audit incomplete: ${item.id}`)
  assert.equal(typeof item.semanticAuditDate, 'string', `Missing semantic audit date: ${item.id}`)
  assert.ok(item.semanticAuditBasis?.trim(), `Missing semantic audit basis: ${item.id}`)

  if (item.answerContract) {
    assert.ok(item.answerContract.requiredClaims?.length, `Missing required semantic claims: ${item.id}`)
    for (const claim of [...item.answerContract.requiredClaims, ...(item.answerContract.forbiddenClaims || [])]) {
      assert.ok(claim.id?.trim() && claim.description?.trim() && claim.patterns?.length, `Malformed semantic claim: ${item.id}`)
      for (const pattern of claim.patterns) assert.doesNotThrow(() => new RegExp(pattern, 'iu'), `Invalid semantic pattern: ${item.id}/${claim.id}`)
    }
  }

  if (item.reviewStatus === 'VERIFIED_DRAFT') {
    assert.ok(item.draftAnswer?.trim(), `Missing draft answer: ${item.id}`)
    assert.ok(allowedConclusions.has(item.draftConclusion), `Invalid draft conclusion: ${item.id}`)
    assert.ok(item.draftCertainty?.trim(), `Missing draft certainty: ${item.id}`)
    assert.ok(Array.isArray(item.draftCitations), `Missing draft citations array: ${item.id}`)
    if (item.category === 'UNRESOLVED_UNSUPPORTED') {
      assert.equal(item.draftConclusion, 'UNRESOLVED')
      assert.deepEqual(item.draftCitations, [])
    } else {
      assert.ok(item.draftCitations.length > 0, `Missing official citation: ${item.id}`)
    }
  }

  if (item.reviewStatus === 'APPROVED') {
    assert.ok(item.approvedAnswer?.trim())
    assert.ok(item.approvedCitations.length > 0 || item.category === 'UNRESOLVED_UNSUPPORTED')
  } else {
    assert.equal(item.approvedAnswer, null)
    assert.deepEqual(item.approvedCitations, [])
  }
}
assert.deepEqual(counts, benchmark.expectedCategoryCounts)
assert.equal(benchmark.cases.filter((item) => item.reviewStatus === 'VERIFIED_DRAFT').length, 100)
assert.equal(benchmark.cases.filter((item) => item.reviewStatus === 'APPROVED').length, 0)
console.log('Validated 100 semantically audited, citation-backed or safe-escalation drafts; 0 falsely approved answers; 0 network requests.')
