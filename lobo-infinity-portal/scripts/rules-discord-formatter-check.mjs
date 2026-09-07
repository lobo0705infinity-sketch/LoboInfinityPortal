import assert from 'node:assert/strict'
import { formatRulesDiscordResponse } from '../bot/rules-command.mjs'

for (const conclusion of ['YES', 'NO', 'DEPENDS', 'UNRESOLVED', 'OTHER']) {
  const payload = formatRulesDiscordResponse({ question: 'test', status: 'STATUS', versions: [], rules: [], deepSeek: { conclusion, interpretationRequired: conclusion === 'OTHER', answer: conclusion === 'UNRESOLVED' ? '' : `Answer ${conclusion}` } })
  const serialized = JSON.stringify(payload)
  assert.doesNotMatch(serialized, /undefined|null/)
  assert.match(serialized, /EXPLICIT RULING|EVIDENCE-BOUNDED INTERPRETATION/)
  assert.match(serialized, /YES|NO|DEPENDS|UNRESOLVED|INTERPRETATION/)
}
const unresolved = JSON.stringify(formatRulesDiscordResponse({ question: 'test', status: 'STATUS', versions: [], rules: [], deepSeek: { conclusion: 'UNRESOLVED' } }))
assert.match(unresolved, /The supplied official evidence does not conclusively resolve this interaction/)
console.log('Discord rules formatter conclusion and undefined/null regressions passed.')
