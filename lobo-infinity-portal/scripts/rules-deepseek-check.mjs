import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildRulesEvidencePrompt, calculateDeepSeekV4ProCost, createDeepSeekRulesAnswer, isDeepSeekPeakPeriod, readUsage, validateDirectAnswer, writeUsage } from '../bot/deepseek-rules.mjs'
import { loadProductionRulesCorpus } from '../bot/infinity-rules-service.mjs'

const corpus = {
  manifest: { sources: [
    { id: 'rules', title: 'Infinity Rules', version: 'N5.3', officialUrl: 'https://example.test/rules' },
    { id: 'faq', title: 'Infinity FAQ', version: 'v0.1', officialUrl: 'https://example.test/faq' },
    { id: 'its', title: 'ITS', version: '18', officialUrl: 'https://example.test/its' },
  ] },
  chunks: [
    { sourceId: 'rules', printedPage: '125', pdfPage: 125, section: 'MSV1', text: 'MSV1 draws LoF through Zero Visibility Zones with a -6 MOD.' },
    { sourceId: 'faq', printedPage: '2', pdfPage: 2, section: 'FAQ', text: 'FAQ clarification.' },
    { sourceId: 'its', printedPage: '10', pdfPage: 10, section: 'ITS', text: 'ITS mission rule.' },
  ],
}
const promptResult = buildRulesEvidencePrompt(corpus, 'What happens through smoke with MSV1?')
const prompt = promptResult.text
assert.match(prompt, /MSV1 draws LoF/)
assert.match(prompt, /breaks Stealth/); assert.match(prompt, /Never state correct premises and then reverse their consequence/)
assert.match(prompt, /Active Trooper declaring Dodge/); assert.match(prompt, /Reactive Trooper’s Dodge/)
assert.doesNotMatch(prompt, /search_rules|get_related_rules|get_rule_section/)

const productionCorpus = await loadProductionRulesCorpus()
for (const [question, required] of [
  ['does dodge break stealth', [/STEALTH/i, /DODGE/i]],
  ['Does Zero Pain suffer Firewall through an enemy Repeater?', [/ZERO PAIN/i, /FIREWALL/i, /REPEATER/i]],
  ['what happens when i shoot through smoke with msv 1 and my opponent dodges, what is my modifier to hit', [/SMOKE/i, /MULTISPECTRAL VISOR LEVEL 1/i]],
]) {
  const evidence = buildRulesEvidencePrompt(productionCorpus, question)
  assert.ok(evidence.entryCount >= 1 && evidence.characterCount <= 60000)
  for (const pattern of required) assert.match(evidence.text, pattern)
}

process.env.DEEPSEEK_API_KEY = 'invalid-placeholder-key'
process.env.DEEPSEEK_HOURLY_LIMIT_USD = '1'
process.env.DEEPSEEK_MONTHLY_LIMIT_USD = '10'
const dir = await mkdtemp(join(tmpdir(), 'deepseek-direct-rules-'))
const usagePath = join(dir, 'usage.json')
let calls = 0
const validAnswer = { questionMeaning: 'Does the rule apply?', questionType: 'BINARY', materialAmbiguities: [], assumptions: [], requirementChecks: [{ requirement: 'The rule applies.', satisfied: true, explanation: 'The cited rule says so.', citationIds: ['C0001'] }], practicalResult: 'The rule applies.', requestedOutcomeApplies: true, answer: 'Yes. Apply a -6 MOD.', conclusion: 'YES', certainty: 'EXPLICIT RULES ANSWER', citationIds: ['C0001'] }
const content = JSON.stringify(validAnswer)
const answer = await createDeepSeekRulesAnswer({
  usagePath,
  logger: { info() {}, warn() {} },
  fetchImpl: async (_url, options) => {
    calls++
    const sent = JSON.parse(options.body)
    assert.equal(sent.messages.length, 2)
    assert.match(sent.messages[0].content, /MSV1 draws LoF/)
    assert.equal(sent.messages[1].content, 'What happens through smoke?')
    assert.equal(sent.tools, undefined)
    assert.equal(sent.model, 'deepseek-v4-pro')
    assert.deepEqual(sent.thinking, { type: 'enabled' })
    assert.equal(sent.reasoning_effort, 'high')
    assert.equal(sent.max_tokens, 8000)
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 20 } }) }
  },
})({ question: 'What happens through smoke?', corpus })
assert.equal(calls, 1); assert.equal(answer.deepSeek.answer, 'Yes. Apply a -6 MOD.'); assert.equal(answer.deepSeek.sources[0].section, 'MSV1')
assert.ok((await readFile(usagePath, 'utf8')).includes('promptTokens'))

let timeoutCalls = 0
const timeoutStarted = Date.now()
const timedOut = await createDeepSeekRulesAnswer({ usagePath: join(dir, 'timeout.json'), requestTimeoutMs: 5, logger: { info() {}, warn() {} }, fetchImpl: async () => { timeoutCalls++; return await new Promise(() => {}) } })({ question: 'Timed complete rule request', corpus })
assert.equal(timeoutCalls, 1); assert.match(timedOut.limitation, /timed out after 60 seconds/i); assert.ok(Date.now() - timeoutStarted < 1000)

for (const [name, response] of [
  ['empty', { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => '' }],
  ['html', { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<html>' }],
  ['http', { ok: false, status: 500, headers: { get: () => 'application/json' }, text: async () => '{}' }],
  ['truncated', { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ finish_reason: 'length', message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) }],
  ['tool', { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{}] } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) }],
]) {
  let branchCalls = 0
  const result = await createDeepSeekRulesAnswer({ usagePath: join(dir, `${name}.json`), logger: { info() {}, warn() {} }, fetchImpl: async () => { branchCalls++; return response } })({ question: `${name} complete rule`, corpus })
  assert.equal(branchCalls, 1); assert.equal(result.deepSeek, undefined); assert.ok(result.limitation)
}

assert.equal(validateDirectAnswer(validAnswer, corpus).ok, true)
const reversedStealth = { ...validAnswer, questionMeaning: 'Does Dodge remove Stealth protection?', practicalResult: 'Dodge does not qualify, so Stealth protection is lost.', requestedOutcomeApplies: true, answer: 'No. Dodge does not qualify for Stealth.', conclusion: 'NO' }
assert.equal(validateDirectAnswer(reversedStealth, corpus).ok, false)
const ambiguousStealth = { ...validAnswer, questionMeaning: 'Does declaring Dodge remove Stealth protection?', materialAmbiguities: [{ missingFact: 'Whether the Dodge is declared by the Active or Reactive Trooper', alternatives: [{ state: 'Active Trooper declares Dodge', outcome: 'Stealth protection does not apply to that declaration.' }, { state: 'Reactive Trooper declares Dodge', outcome: 'Stealth is not operating for that Trooper.' }] }], practicalResult: 'The result differs by active/reactive role.', requestedOutcomeApplies: null, answer: 'It depends. An Active Trooper loses Stealth protection for the declaration; a Reactive Trooper is not using Stealth.', conclusion: 'DEPENDS' }
assert.equal(validateDirectAnswer(ambiguousStealth, corpus).ok, true)
for (const invalid of [
  { ...validAnswer, answer: '' },
  { ...validAnswer, conclusion: 'MAYBE' },
  { ...validAnswer, certainty: 'CERTAIN' },
  { ...validAnswer, citationIds: ['BAD'] },
  { ...validAnswer, requestedOutcomeApplies: false },
  { ...validAnswer, requirementChecks: [] },
  { ...validAnswer, assumptions: ['Assume Reactive Turn'] },
  { ...ambiguousStealth, conclusion: 'NO', requestedOutcomeApplies: false, answer: 'No. Dodge does not break Stealth.' },
]) assert.equal(validateDirectAnswer(invalid, corpus).ok, false)

assert.deepEqual((await readUsage(join(dir, 'missing.json'))).records, [])
for (const [index, raw] of ['', ' ', '{bad', '{"records":{}}'].entries()) { const path = join(dir, `bad-${index}.json`); await writeFile(path, raw); assert.deepEqual((await readUsage(path, { warn() {} })).records, []) }
await writeUsage(join(dir, 'atomic.json'), { records: [{ timestamp: 1, cost: 0.01 }] })

const mondayPeak = Date.parse('2026-09-07T02:00:00Z')
const mondayOffPeak = Date.parse('2026-09-07T12:00:00Z')
assert.equal(isDeepSeekPeakPeriod(mondayPeak), true)
assert.equal(isDeepSeekPeakPeriod(mondayOffPeak), false)
assert.deepEqual(calculateDeepSeekV4ProCost({ prompt_tokens: 200000, prompt_cache_hit_tokens: 150000, prompt_cache_miss_tokens: 50000, completion_tokens: 500 }, mondayPeak), {
  promptTokens: 200000, completionTokens: 500, cacheHitTokens: 150000, cacheMissTokens: 50000, ratePeriod: 'peak', cost: 150000 / 1e6 * 0.044 + 50000 / 1e6 * 1.32 + 500 / 1e6 * 3.96,
})
assert.equal(calculateDeepSeekV4ProCost({ prompt_tokens: 200000, completion_tokens: 500 }, mondayOffPeak).cost, 200000 / 1e6 * 0.66 + 500 / 1e6 * 1.98)
console.log('Retrieval-assisted DeepSeek path passed with exactly one mocked request and zero real network requests.')
