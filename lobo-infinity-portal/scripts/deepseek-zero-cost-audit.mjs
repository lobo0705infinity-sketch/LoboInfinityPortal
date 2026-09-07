import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDeepSeekFallback } from '../bot/deepseek-rules.mjs'

process.env.DEEPSEEK_API_KEY = 'invalid-placeholder-key'
const dir = await mkdtemp(join(tmpdir(), 'rules-audit-'))
const questions = Array.from({ length: 50 }, (_, i) => `Mocked rules question ${i + 1}`)
let calls = 0, realNetwork = 0
const fallback = createDeepSeekFallback({ usagePath: join(dir, 'usage.json'), fetchImpl: async () => { calls++; return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: 'Supported by the supplied excerpt.', conclusion: 'UNRESOLVED', interpretationRequired: true, evidenceIds: ['E1'] }) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) } }, logger: { info() {}, warn() {} } })
for (const question of questions) { const before = calls; await fallback({ question, rules: [{ sourceId: 'rules', sourceLabel: 'Rules', pageLabel: 'p. 1', excerpt: 'Supplied excerpt.' }], versions: [{ id: 'rules', version: '5.3' }], status: 'DIRECT RULE REFERENCE' }); assert.ok(calls - before <= 1) }
assert.equal(realNetwork, 0)
console.log(`Validated ${questions.length} mocked questions; provider calls <=1 each; real network requests: 0`)
