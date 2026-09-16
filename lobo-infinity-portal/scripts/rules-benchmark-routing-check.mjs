import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { findApprovedRulesAnswer, loadRulesBenchmark } from '../bot/rules-benchmark.mjs'
import { retrieveRulesReference } from '../bot/rules-command.mjs'

const root = resolve(import.meta.dirname, '..')
const index = await loadRulesBenchmark({ force: true })
assert.equal(index.canonicalCases, 1387)

for (const file of ['rules-adjudicator-benchmark.json', 'rules-adjudicator-expansion-400.json', 'rules-adjudicator-new-topics-400.json', 'rules-adjudicator-new-topics-500.json', 'rules-benchmark-approved-updates-2026-09-15.json']) {
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
  ['If my hidden deployment trooper delays, does it reveal?', 'new-topic-2-501'],
  ['does delaying your aro cancel hidden deployment state', 'new-topic-2-501'],
  ['Does delaying an ARO break Hidden Deployment?', 'new-topic-2-501'],
  ['Can a hidden model delay without revealing?', 'new-topic-2-501'],
  ['Does choosing to delay break camouflage?', 'new-topic-2-501'],
  ['Can cautious move in zoc without stealth?', 'new-topic-2-502'],
  ['Do you have to declare if a holomask trooper is hackable?', 'new-topic-2-503'],
  ['If I am doing a coordinated order with some targetless weapons and some without targetless can they target different things?', 'new-topic-2-504'],
  ['Can a coordinated rifle and smoke grenade choose different targets?', 'new-topic-2-504'],
  ['Can Targetless and non-Targetless attacks split targets in a coordinated order?', 'new-topic-2-504'],
  ['What is a TacBall and how it works', 'new-topic-2-505'],
  ['How does Tacball work?', 'new-topic-2-505'],
  ['how does request tacball work?', 'new-topic-2-506'],
  ['When can I request a Tacball?', 'new-topic-2-506'],
  ['Can a unit and their synchronize peripheral pick up from the same panoply on the same order?', 'new-topic-2-507'],
]
for (const [question, expectedId] of naturalParaphrases) {
  assert.equal((await findApprovedRulesAnswer(question))?.id, expectedId, question)
}
const holoMaskHackable = await findApprovedRulesAnswer('Do you have to declare if a holomask trooper is hackable?')
assert.equal(holoMaskHackable?.conclusion, 'DEPENDS')
assert.match(holoMaskHackable?.answer || '', /enters or is inside an enemy Hacking Area/i)
assert.match(holoMaskHackable?.answer || '', /lacks Hacker or Hackable status/i)
const mixedCoordinatedTargetless = await findApprovedRulesAnswer('Can Targetless and non-Targetless attacks split targets in a coordinated order?')
assert.equal(mixedCoordinatedTargetless?.conclusion, 'NO')
assert.match(mixedCoordinatedTargetless?.answer || '', /all participating Troopers must act against that same single target/i)
const tacball = await findApprovedRulesAnswer('What is a TacBall and how it works')
assert.equal(tacball?.conclusion, 'INTERPRETATION')
assert.match(tacball?.answer || '', /stationary Deployable Weapon/i)
assert.deepEqual(tacball?.citations.map((citation) => citation.page), [29, 30])
const requestTacball = await findApprovedRulesAnswer('how does request tacball work?')
assert.equal(requestTacball?.conclusion, 'INTERPRETATION')
assert.match(requestTacball?.answer || '', /second Game Round/i)
assert.match(requestTacball?.answer || '', /requires no Roll/i)
assert.match(requestTacball?.answer || '', /only once per game/i)
assert.deepEqual(requestTacball?.citations.map((citation) => citation.page), [29])
const synchronizedPanoply = await findApprovedRulesAnswer('Can a unit and their synchronize peripheral pick up from the same panoply on the same order?')
assert.equal(synchronizedPanoply?.conclusion, 'YES')
assert.match(synchronizedPanoply?.answer || '', /both Models are in Silhouette contact/i)
assert.deepEqual(synchronizedPanoply?.citations.map((citation) => citation.page), [106, 54])
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
const matchedTacball = await retrieveRulesReference({ question: 'What is a TacBall and how it works', deepSeek: fallback })
assert.equal(matchedTacball.answerSource, 'APPROVED_BENCHMARK')
assert.equal(matchedTacball.benchmark.id, 'new-topic-2-505')
assert.equal(calls, 1)
const matchedRequestTacball = await retrieveRulesReference({ question: 'how does request tacball work?', deepSeek: fallback })
assert.equal(matchedRequestTacball.answerSource, 'APPROVED_BENCHMARK')
assert.equal(matchedRequestTacball.benchmark.id, 'new-topic-2-506')
assert.equal(calls, 1)
const matchedSynchronizedPanoply = await retrieveRulesReference({ question: 'Can a unit and their synchronize peripheral pick up from the same panoply on the same order?', deepSeek: fallback })
assert.equal(matchedSynchronizedPanoply.answerSource, 'APPROVED_BENCHMARK')
assert.equal(matchedSynchronizedPanoply.benchmark.id, 'new-topic-2-507')
assert.equal(calls, 1)
console.log(`PASS - ${index.canonicalCases} trusted benchmark rulings route before DeepSeek; unmatched questions fall back exactly once.`)
