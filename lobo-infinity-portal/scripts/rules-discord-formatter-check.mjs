import assert from 'node:assert/strict'
import { formatRulesDiscordResponse } from '../bot/rules-command.mjs'
import { validateModelOutput } from '../bot/deepseek-rules.mjs'

for (const conclusion of ['YES', 'NO', 'DEPENDS', 'UNRESOLVED', 'OTHER']) {
  const payload = formatRulesDiscordResponse({ question: 'Does test?', status: 'STATUS', versions: [], rules: [], deepSeek: { conclusion, interpretationRequired: conclusion === 'OTHER', answer: conclusion === 'UNRESOLVED' ? '' : `Answer ${conclusion}` } })
  const serialized = JSON.stringify(payload)
  assert.doesNotMatch(serialized, /undefined|null/)
  assert.match(serialized, /EXPLICIT RULING|EXPLICIT RULES ANSWER|EVIDENCE-BOUNDED INTERPRETATION/)
  if (conclusion !== 'OTHER') assert.match(serialized, /YES|NO|DEPENDS|UNRESOLVED|INTERPRETATION/)
}
const unresolved = JSON.stringify(formatRulesDiscordResponse({ question: 'test', status: 'STATUS', versions: [], rules: [], deepSeek: { conclusion: 'UNRESOLVED' } }))
assert.match(unresolved, /The supplied official evidence does not conclusively resolve this interaction/)
const mimetism = JSON.stringify(formatRulesDiscordResponse({ question: 'What does Mimetism do?', status: 'STATUS', versions: [], rules: [], deepSeek: { conclusion: 'YES', answer: 'It imposes a MOD.' } }))
assert.match(mimetism, /EXPLICIT RULES ANSWER/); assert.doesNotMatch(mimetism, /\*\*YES\*\*/) 
const zeroPain = JSON.stringify(formatRulesDiscordResponse({ question: 'Does Zero Pain suffer Firewall?', status: 'STATUS', versions: [], rules: [], deepSeek: { conclusion: 'UNRESOLVED', answer: 'UNRESOLVED', interpretationRequired: true } }))
assert.equal((zeroPain.match(/UNRESOLVED/g) || []).length, 1)
const internal = JSON.stringify(formatRulesDiscordResponse({ question: 'Does Zero Pain suffer Firewall?', status: 'STATUS', versions: [], rules: [], deepSeek: { conclusion: 'YES', answer: 'See E2 and E3/E4; E7 supports this.', interpretationRequired: true } }))
assert.doesNotMatch(internal, /E2|E3|E4|E7/)
const mimetism = JSON.stringify(formatRulesDiscordResponse({ question: 'What does Mimetism do?', status: 'STATUS', versions: [], rules: [], deepSeek: { conclusion: 'YES', answer: 'It imposes a MOD.', interpretationRequired: false } }))
assert.match(mimetism, /EXPLICIT RULES ANSWER/); assert.doesNotMatch(mimetism, /\*\*YES\*\*/)
const msv = JSON.stringify(formatRulesDiscordResponse({ question: 'Can MSV3 shoot a Camouflaged Marker?', status: 'STATUS', versions: [], rules: [], deepSeek: { conclusion: 'YES', answer: 'The exception permits it.', interpretationRequired: false } }))
assert.match(msv, /EXPLICIT RULING/)
const contradiction = validateModelOutput({ answer: 'No explicit FAQ adjudication exists.', conclusion: 'YES', certainty: 'EXPLICIT RULING', interpretationRequired: false, evidenceIds: ['E1'] }, [{ id: 'E1', excerpt: 'Firewall rule.' }])
assert.equal(contradiction.ok, false)
console.log('Discord rules formatter conclusion and undefined/null regressions passed.')
