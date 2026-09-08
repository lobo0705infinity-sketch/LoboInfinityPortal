import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { APPROVAL_CONFIRMATION, approveRulesBenchmark } from './rules-adjudicator-approve.mjs'
import { evaluateRulesAnswers } from './rules-adjudicator-evaluate.mjs'

const benchmark = JSON.parse(await readFile(new URL('../data/infinity-rules/rules-adjudicator-benchmark.json', import.meta.url), 'utf8'))
const original = JSON.stringify(benchmark)
let networkRequests = 0
globalThis.fetch = async () => {
  networkRequests++
  throw new Error('Network access is forbidden during approval-workflow validation.')
}

assert.equal(benchmark.cases.filter((item) => item.reviewStatus === 'APPROVED').length, 0)
assert.throws(() => approveRulesBenchmark(benchmark, { confirmation: '', reviewer: 'Lobo' }), /exact explicit approval/)
assert.throws(() => approveRulesBenchmark(benchmark, { confirmation: APPROVAL_CONFIRMATION, reviewer: '' }), /reviewer identity/)

const incomplete = structuredClone(benchmark)
incomplete.cases[0].draftAnswer = ''
assert.throws(
  () => approveRulesBenchmark(incomplete, { confirmation: APPROVAL_CONFIRMATION, reviewer: 'Lobo' }),
  /complete verified draft/,
)

const approvedAt = '2026-09-08T00:00:00.000Z'
const approved = approveRulesBenchmark(benchmark, {
  confirmation: APPROVAL_CONFIRMATION,
  reviewer: 'Lobo',
  approvedAt,
})
assert.equal(JSON.stringify(benchmark), original, 'Approval mutated the input benchmark.')
assert.equal(approved.cases.filter((item) => item.reviewStatus === 'APPROVED').length, 100)
assert.ok(approved.cases.every((item) =>
  item.approvedAnswer === item.draftAnswer &&
  item.approvedConclusion === item.draftConclusion &&
  item.approvedCertainty === item.draftCertainty &&
  JSON.stringify(item.approvedCitations) === JSON.stringify(item.draftCitations) &&
  item.approvedBy === 'Lobo' &&
  item.approvedAt === approvedAt
))
assert.deepEqual(approved.formalApproval, {
  approvedCases: 100,
  totalCases: 100,
  approvedBy: 'Lobo',
  approvedAt,
  method: 'EXPLICIT_ALL_CASE_REVIEW',
})

const candidate = approved.cases.map((item) => ({
  id: item.id,
  answer: item.approvedAnswer,
  conclusion: item.approvedConclusion,
  certainty: item.approvedCertainty,
  citations: item.approvedCitations,
}))
const evaluation = evaluateRulesAnswers(approved, candidate)
assert.equal(evaluation.contractPass, true)
assert.equal(evaluation.releaseEligible, true)
assert.equal(networkRequests, 0)
console.log('Rules approval workflow passed: one explicit action promotes 100 complete drafts atomically in memory; missing consent, reviewer, and incomplete data are blocked; 0 network requests.')
