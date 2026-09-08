import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { evaluateRulesAnswers } from './rules-adjudicator-evaluate.mjs'

const benchmarkPath = new URL('../data/infinity-rules/rules-adjudicator-benchmark.json', import.meta.url)
const benchmark = JSON.parse(await readFile(benchmarkPath, 'utf8'))
let networkRequests = 0
globalThis.fetch = async () => {
  networkRequests++
  throw new Error('Network access is forbidden during adversarial rules evaluation.')
}

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
assert.equal(benchmark.cases.filter((item) => item.answerContract).length, 100)

let requiredClaimAttacks = 0
for (const testCase of benchmark.cases) {
  for (const claim of testCase.answerContract.requiredClaims) {
    requiredClaimAttacks++
    const attacked = structuredClone(referenceAnswers)
    const target = attacked.find((item) => item.id === testCase.id)
    for (const pattern of claim.patterns) {
      target.answer = target.answer.replace(new RegExp(pattern, 'giu'), '')
    }
    const result = evaluateRulesAnswers(benchmark, attacked)
    const failure = result.failures.find((item) => item.id === testCase.id)
    assert.equal(result.contractPass, false, `Required-claim deletion was accepted: ${testCase.id}/${claim.id}`)
    assert.ok(failure?.missingRequiredClaims.includes(claim.id), `Deleted claim was not reported: ${testCase.id}/${claim.id}`)
  }
}

const forbiddenClaimAttacks = {
  'two_rule_interaction-01': 'Zero Pain suffers Firewall on its own Roll.',
  'timing_sequence-01': "The shooter's Visibility MOD is -6.",
  'timing_sequence-02': "The shooter's Visibility MOD is -3.",
  'timing_sequence-03': 'Dodge breaks Stealth.',
  'faq_its_override-02': 'MSV3 must Discover it first.',
  'unresolved_unsupported-01': 'The forum post overrides the official rulebook.',
  'unresolved_unsupported-02': 'Always use the newer rule provision.',
  'unresolved_unsupported-03': 'The official answer is probably determined by common sense.',
  'unresolved_unsupported-04': 'The N4 FAQ decides N5.',
  'unresolved_unsupported-05': "The tournament organizer's ruling becomes an official rule.",
}

for (const [id, injectedClaim] of Object.entries(forbiddenClaimAttacks)) {
  const attacked = structuredClone(referenceAnswers)
  attacked.find((item) => item.id === id).answer += ` ${injectedClaim}`
  const result = evaluateRulesAnswers(benchmark, attacked)
  const failure = result.failures.find((item) => item.id === id)
  assert.equal(result.contractPass, false, `Forbidden claim was accepted: ${id}`)
  assert.ok(failure?.presentForbiddenClaims.length, `Forbidden claim was not reported: ${id}`)
}

assert.equal(requiredClaimAttacks, 380)
assert.equal(Object.keys(forbiddenClaimAttacks).length, 10)
assert.equal(networkRequests, 0)
console.log(`Adversarial rules audit passed: ${requiredClaimAttacks} required-claim deletion attacks and ${Object.keys(forbiddenClaimAttacks).length} plausible forbidden-claim attacks rejected; 0 network requests, 0 provider requests, approval gate locked.`)
