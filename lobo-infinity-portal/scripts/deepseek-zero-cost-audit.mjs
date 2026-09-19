import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDeepSeekRulesAnswer } from '../bot/deepseek-rules.mjs'

process.env.DEEPSEEK_API_KEY = 'invalid-placeholder-key'
const corpus = { manifest: { sources: [{ id: 'rules', title: 'Rules', version: 'N5.3', officialUrl: 'https://example.test' }, { id: 'faq', title: 'FAQ', version: 'v0.1', officialUrl: 'https://example.test' }, { id: 'its', title: 'ITS', version: '18', officialUrl: 'https://example.test' }] }, chunks: [{ sourceId: 'rules', printedPage: '1', pdfPage: 1, section: 'Rule', text: 'Complete rule text.' }, { sourceId: 'faq', printedPage: '1', pdfPage: 1, section: 'FAQ', text: 'Complete FAQ text.' }, { sourceId: 'its', printedPage: '1', pdfPage: 1, section: 'ITS', text: 'Complete ITS text.' }] }
const dir = await mkdtemp(join(tmpdir(), 'rules-zero-cost-'))
let calls = 0
const provider = createDeepSeekRulesAnswer({ usagePath: join(dir, 'usage.json'), logger: { info() {}, warn() {} }, fetchImpl: async (_url, options) => { calls++; const body = JSON.parse(options.body); assert.match(body.messages[0].content, /Complete rule text/); assert.equal(body.model, 'deepseek-v4-pro'); assert.deepEqual(body.thinking, { type: 'enabled' }); assert.equal(body.reasoning_effort, 'high'); assert.equal(body.max_tokens, 8000); return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ questionMeaning: 'Does the rule apply?', questionType: 'BINARY', materialAmbiguities: [], assumptions: [], requirementChecks: [{ requirement: 'The rule applies.', satisfied: true, explanation: 'The corpus says so.', citationIds: ['C0001'] }], practicalResult: 'The rule applies.', requestedOutcomeApplies: true, answer: 'Yes. The rule applies.', conclusion: 'YES', certainty: 'EXPLICIT RULES ANSWER', citationIds: ['C0001'] }) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) } } })
for (let index = 1; index <= 50; index++) { const before = calls; await provider({ question: `What does the complete rule do? Mock ${index}`, corpus }); assert.equal(calls - before, 1) }
assert.equal(calls, 50)
console.log('Validated 50 retrieval-assisted mocked questions; one provider call each; real network requests: 0.')
