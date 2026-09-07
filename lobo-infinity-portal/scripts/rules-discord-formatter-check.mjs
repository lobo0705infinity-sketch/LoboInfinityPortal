import assert from 'node:assert/strict'
import { formatRulesDiscordResponse } from '../bot/rules-command.mjs'

const result = { question: 'What happens through smoke?', status: 'DEEPSEEK RULES ANSWER', versions: [{ label: 'Infinity Rules N5.3' }, { label: 'Infinity FAQ v0.1' }, { label: 'ITS Season 18' }], deepSeek: { answer: 'Apply a -6 MOD. C0001', conclusion: 'YES', certainty: 'EXPLICIT RULES ANSWER', sources: [{ id: 'C0001', title: 'Infinity Rules', version: 'N5.3', page: '125', section: 'MSV1', url: 'https://example.test/rules' }] } }
const rendered = JSON.stringify(formatRulesDiscordResponse(result))
assert.match(rendered, /Apply a -6 MOD/); assert.match(rendered, /OFFICIAL SOURCES/); assert.match(rendered, /MSV1/); assert.doesNotMatch(rendered, /C0001|undefined|null/)
const failed = JSON.stringify(formatRulesDiscordResponse({ question: 'Question?', status: 'AI RULES ANSWER UNAVAILABLE', limitation: 'DeepSeek was unavailable.', versions: [] }))
assert.match(failed, /AI RULES ANSWER UNAVAILABLE/); assert.doesNotMatch(failed, /undefined|null/)
console.log('Direct rules Discord formatter regressions passed.')
