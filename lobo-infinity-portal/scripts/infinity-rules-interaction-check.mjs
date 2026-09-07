import assert from 'node:assert/strict'
import { buildRulesReference, loadProductionRulesCorpus } from '../bot/infinity-rules-service.mjs'
import { formatRulesDiscordResponse } from '../bot/rules-command.mjs'

const corpus = await loadProductionRulesCorpus({ force: true })
const ask = (question) => buildRulesReference(corpus, question)
const canonical = ask('does dodge break stealth')
assert.equal(canonical.resolution.intent, 'INTERACTION')
assert.equal(canonical.conclusion.label, 'YES')
assert.ok(canonical.rules.some((rule) => rule.ruleName === 'STEALTH' && /AROs are granted normally/i.test(rule.excerpt)))
assert.ok(canonical.rules.some((rule) => rule.ruleName === 'DODGE'))
assert.equal(canonical.rules.find((rule) => rule.ruleName === 'STEALTH').pageLabel, 'p. 112')

for (const question of ['Does Dodge break Stealth?', 'DOES DODGE BREAK STEALTH!', 'does dodg break stealt', 'does stealth get broken by dodge']) {
  const result = ask(question)
  assert.equal(result.conclusion.label, 'YES', question)
  assert.equal(result.resolution.interaction.concepts.length, 2)
}

const no = ask('does disconnected state cancel cautious movement')
assert.ok(['NO', 'NOT EXPLICITLY RESOLVED'].includes(no.conclusion?.label ?? 'NOT EXPLICITLY RESOLVED'))
const conditional = ask('does stealth cancel mimetism')
assert.ok(['CONDITIONAL', 'YES'].includes(conditional.conclusion.label))
const unresolved = ask('can stealth trigger an aro')
assert.equal(unresolved.conclusion.label, 'NOT EXPLICITLY RESOLVED')
const faq = ask('What happens if several troopers use Stealth and generate AROs?')
assert.ok(faq.rules.some((rule) => rule.sourceId.includes('faq')))
const its = ask('In ITS, which troopers count as Specialist Troops?')
assert.ok(its.rules.every((rule) => rule.scope === 'ITS'))
const commonVocabulary = ask('does dodge affect mimetism')
assert.equal(commonVocabulary.conclusion.label, 'NOT EXPLICITLY RESOLVED')
const definition = ask('How does Dodge work?')
assert.equal(definition.conclusion, null)
assert.ok(definition.rules.some((rule) => rule.ruleName === 'DODGE'))
const referenced = ask('Can I Discover a Camouflaged Marker and shoot it with the same trooper?')
assert.equal(referenced.conclusion, null)
assert.ok(referenced.rules.length >= 3)

const payload = formatRulesDiscordResponse(canonical)
const embed = payload.embeds[0]
assert.equal(embed.fields[0].name, 'ANSWER')
assert.equal(embed.fields[1].name, 'WHY')
assert.ok(embed.fields.some((field) => field.name === 'STATUS' && /DIRECT CORPUS-SUPPORTED ANSWER/.test(field.value)))
assert.ok(embed.fields.every((field) => field.name.length <= 256 && field.value.length <= 1024))
assert.ok((embed.title.length + embed.description.length + embed.footer.text.length + embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0)) <= 6000)
for (const rule of canonical.rules) for (const clause of rule.selectedClauses) {
  assert.ok(['5.3', '0.1', '2026.09.04'].includes(clause.sourceVersion))
  assert.ok(clause.page && clause.sourceUrl && clause.text)
}
console.log('Rules interaction resolver checks passed (normalization, typo tolerance, conclusion safety, FAQ/ITS, citations, and Discord limits).')
