import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { evaluateRulesAnswers } from './rules-adjudicator-evaluate.mjs'

const benchmarkPath = new URL('../data/infinity-rules/rules-adjudicator-benchmark.json', import.meta.url)
const benchmark = JSON.parse(await readFile(benchmarkPath, 'utf8'))
let networkRequests = 0
globalThis.fetch = async () => {
  networkRequests++
  throw new Error('Network access is forbidden during zero-cost rules evaluation.')
}

assert.equal(benchmark.cases.length, 100)
assert.equal(benchmark.semanticAudit?.auditedCases, 100)
assert.equal(benchmark.semanticContracts?.contractedCases, 95)
assert.ok(benchmark.cases.every((item) => item.semanticAuditStatus === 'PASSED'))
assert.equal(benchmark.policy.networkRequestsDuringValidation, 0)
assert.equal(benchmark.policy.paidProviderRequestsDuringValidation, 0)

const referenceAnswers = benchmark.cases.map((item) => ({
  id: item.id,
  answer: item.draftAnswer,
  conclusion: item.draftConclusion,
  certainty: item.draftCertainty,
  citations: item.draftCitations,
}))

const baseline = evaluateRulesAnswers(benchmark, referenceAnswers)
assert.equal(baseline.contractPass, true)
assert.equal(baseline.releaseEligible, false)
assert.equal(baseline.approvedReferences, 0)

for (const testCase of benchmark.cases) {
  const omitted = referenceAnswers.filter((item) => item.id !== testCase.id)
  const omittedResult = evaluateRulesAnswers(benchmark, omitted)
  assert.equal(omittedResult.contractPass, false, `Missing answer was accepted: ${testCase.id}`)
  assert.ok(omittedResult.missingIds.includes(testCase.id), `Missing ID was not reported: ${testCase.id}`)

  const contradicted = structuredClone(referenceAnswers)
  const target = contradicted.find((item) => item.id === testCase.id)
  target.conclusion = target.conclusion === 'YES' ? 'NO' : 'YES'
  const contradictedResult = evaluateRulesAnswers(benchmark, contradicted)
  assert.equal(contradictedResult.contractPass, false, `Wrong conclusion was accepted: ${testCase.id}`)
  assert.ok(contradictedResult.failures.some((item) => item.id === testCase.id), `Wrong conclusion was not reported: ${testCase.id}`)
}

const duplicate = [...referenceAnswers, structuredClone(referenceAnswers[0])]
assert.equal(evaluateRulesAnswers(benchmark, duplicate).contractPass, false)
const unexpected = [...referenceAnswers.slice(1), { ...structuredClone(referenceAnswers[0]), id: 'unexpected-case' }]
const unexpectedResult = evaluateRulesAnswers(benchmark, unexpected)
assert.equal(unexpectedResult.contractPass, false)
assert.deepEqual(unexpectedResult.unexpectedIds, ['unexpected-case'])
assert.ok(unexpectedResult.missingIds.includes(referenceAnswers[0].id))

for (const testCase of benchmark.cases.filter((item) => item.category === 'UNRESOLVED_UNSUPPORTED')) {
  const unsafe = structuredClone(referenceAnswers)
  const target = unsafe.find((item) => item.id === testCase.id)
  target.answer = 'The answer is whatever seems most likely.'
  const result = evaluateRulesAnswers(benchmark, unsafe)
  assert.equal(result.contractPass, false, `Unsafe escalation was accepted: ${testCase.id}`)
}

for (const testCase of benchmark.cases.filter((item) => item.answerContract)) {
  const semanticallyEmpty = structuredClone(referenceAnswers)
  const target = semanticallyEmpty.find((item) => item.id === testCase.id)
  target.answer = 'This answer keeps the expected conclusion and citations but omits the practical ruling.'
  const result = evaluateRulesAnswers(benchmark, semanticallyEmpty)
  assert.equal(result.contractPass, false, `Semantically empty answer was accepted: ${testCase.id}`)
  assert.ok(result.failures.some((item) => item.id === testCase.id && !item.semanticContractMatch), `Semantic failure was not reported: ${testCase.id}`)
}

assert.equal(networkRequests, 0)
const faultInjectionCount = benchmark.cases.length * 2 + 2 + benchmark.cases.filter((item) => item.category === 'UNRESOLVED_UNSUPPORTED').length + benchmark.cases.filter((item) => item.answerContract).length
console.log(`Zero-cost rules grading passed: 100 audited cases, ${faultInjectionCount} fault injections, ${benchmark.semanticContracts.contractedCases} semantic contracts, 0 network requests, 0 provider requests, approval gate locked.`)
