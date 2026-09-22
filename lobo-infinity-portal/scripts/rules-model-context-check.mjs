#!/usr/bin/env node

import assert from 'node:assert/strict'
import { buildRulesEvidencePrompt } from '../bot/deepseek-rules.mjs'
import { loadProductionRulesCorpus } from '../bot/infinity-rules-service.mjs'
import { formatRulesDiscordResponse, retrieveRulesReference } from '../bot/rules-command.mjs'
import {
  formatRulesModelContext,
  loadRulesModelCatalog,
  publicRulesModelResolution,
  resolveRulesModelMentions,
  resolveRulesModelMentionsFromCatalog,
  rulesModelSearchTerms,
} from '../bot/rules-model-context.mjs'

const catalog = await loadRulesModelCatalog({ force: true })
assert.equal(catalog.schemaVersion, 'rules-model-context-v1')
assert.equal(catalog.exactProfileCount, 6850)
assert.equal(catalog.exactProfiles.length, 6850)
assert.ok(catalog.canonicalProfileCount >= 3000)
assert.ok(catalog.aliases.size >= 1800)

// This is deliberately exhaustive rather than a hand-selected model list.
// Every live exact Army profile must be reachable through at least one model
// alias, and one generated natural-language question must resolve every
// distinct canonical profile represented by the bundled official snapshot.
const aliasesByExactProfile = new Map(catalog.exactProfiles.map((profile) => [profile.id, []]))
for (const entry of catalog.aliases.values()) for (const id of entry.exactProfileIds) aliasesByExactProfile.get(id)?.push(entry.alias)
for (const profile of catalog.exactProfiles) assert.ok(aliasesByExactProfile.get(profile.id)?.length, `No model alias reaches ${profile.id} (${profile.name})`)

const checkedCanonicalProfiles = new Set()
for (const profile of catalog.exactProfiles) {
  if (checkedCanonicalProfiles.has(profile.canonicalId)) continue
  checkedCanonicalProfiles.add(profile.canonicalId)
  const alias = aliasesByExactProfile.get(profile.id).sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length)[0]
  const resolution = resolveRulesModelMentionsFromCatalog(catalog, `Can ${alias} dodge?`)
  assert.ok(resolution.models.some((model) => model.variants.some((variant) => variant.canonicalId === profile.canonicalId)), `Generated question did not resolve ${profile.canonicalId} through “${alias}”`)
}
assert.equal(checkedCanonicalProfiles.size, catalog.canonicalProfileCount)

const redeye = await resolveRulesModelMentions('Can a Redeye benefit from Cover?', { catalog })
assert.equal(redeye.models.length, 1)
assert.equal(redeye.models[0].matchedAlias, 'redeye')
assert.ok(redeye.models[0].variants.every((profile) => profile.skills.includes('Aerial')))
assert.ok(redeye.models[0].variants.every((profile) => profile.skills.includes('No Cover')))
assert.ok(redeye.models[0].variants.every((profile) => profile.bs === 14 && profile.silhouette === 7))
assert.ok(redeye.models[0].variants.every((profile) => profile.characteristics.includes('Regular') && profile.characteristics.includes('Hackable')))
assert.ok(rulesModelSearchTerms(redeye).includes('Aerial'))
assert.ok(rulesModelSearchTerms(redeye).includes('No Cover'))

const johnny = await resolveRulesModelMentions('Does Johnny Kao have a Deployable Repeater?', { catalog })
assert.equal(johnny.models.length, 1)
assert.equal(johnny.models[0].variantCount, 3)
assert.ok(johnny.models[0].variants.some((profile) => profile.weapons.includes('Plasma Carbine')))
assert.ok(johnny.models[0].variants.every((profile) => !profile.weapons.includes('Deployable Repeater')))
assert.ok(johnny.models[0].variants.every((profile) => !profile.equipment.includes('Deployable Repeater')))

const leiGong = await resolveRulesModelMentions('Can Lei Gong use Albedo?', { catalog })
assert.equal(leiGong.models.length, 1)
assert.ok(leiGong.models[0].variants.some((profile) => /FTO/i.test(profile.profileName)))
assert.ok(leiGong.models[0].variants.some((profile) => !/FTO/i.test(profile.profileName)))
assert.ok(leiGong.models[0].variants.every((profile) => profile.equipment.some((item) => /^Albedo/i.test(item))))
const leiGongFto = await resolveRulesModelMentions('Can Léi Gōng FTO use Albedo?', { catalog })
assert.ok(leiGongFto.models[0].variants.every((profile) => /FTO/i.test(profile.profileName)))

const crabbot = await resolveRulesModelMentions('What can a Crabbot do?', { catalog })
assert.ok(crabbot.models[0].variantCount >= 7)
assert.ok(new Set(crabbot.models[0].variants.map((profile) => profile.unitName)).size >= 7)
const avatar = await resolveRulesModelMentions('Does the Avatar have a Repeater?', { catalog })
assert.equal(avatar.models[0].variantCount, 1)
assert.equal(avatar.models[0].variants[0].profileName, 'AVATAR')
const staldron = await resolveRulesModelMentions('Can the Staldron Dodge?', { catalog })
assert.ok(staldron.models[0].variantCount >= 5)
assert.ok(staldron.models[0].variants.every((profile) => profile.profileName === 'STALDRON'))
assert.ok(staldron.models[0].variants.some((profile) => profile.unitName === 'Avatar'))

for (const question of [
  'Can a model Dodge?',
  'Can a unit benefit from Cover?',
  'Can I do a bit more movement?',
  'Does Zero Visibility apply?',
  'Can I spend a Regular Order?',
]) assert.equal((await resolveRulesModelMentions(question, { catalog })).models.length, 0, question)
assert.equal((await resolveRulesModelMentions('Can Bit hack this target?', { catalog })).models[0].displayName, 'Bit & KISS!')
assert.equal((await resolveRulesModelMentions('Can Zero Dodge?', { catalog })).models[0].displayName, 'Zeros')

const multiple = await resolveRulesModelMentions('Can Redeye Discover a Crabbot?', { catalog })
assert.deepEqual(multiple.models.map((model) => model.matchedAlias), ['redeye', 'crabbot'])

const context = formatRulesModelContext(redeye)
assert.match(context, /OFFICIAL INFINITY ARMY MODEL CONTEXT/)
assert.match(context, /Aerial/)
assert.match(context, /No Cover/)
assert.match(context, /MOV 8-2/)
assert.match(context, /Characteristics:.*Hackable.*Regular|Characteristics:.*Regular.*Hackable/)

const corpus = await loadProductionRulesCorpus()
const evidence = buildRulesEvidencePrompt(corpus, 'Can a Redeye benefit from Cover?', { modelResolution: redeye })
assert.match(evidence.text, /Redeye Close Air Support Squad/)
assert.match(evidence.text, /Aerial/)
assert.match(evidence.text, /No Cover/)
assert.ok(evidence.modelSearchTerms.includes('Aerial'))
assert.ok(evidence.modelSearchTerms.includes('No Cover'))
const evidenceEntries = JSON.parse(evidence.text.split('\n').at(-1)).entries
assert.ok(evidenceEntries.some((entry) => /Aerial/i.test(entry.text)))
assert.ok(evidenceEntries.some((entry) => /Cover/i.test(entry.text)))

let providerArguments
const routed = await retrieveRulesReference({
  question: 'Can a Redeye benefit from Cover?',
  deepSeek: async (arguments_) => {
    providerArguments = arguments_
    return {
      question: arguments_.question,
      versions: [],
      status: 'DEEPSEEK RULES ANSWER',
      modelContext: publicRulesModelResolution(arguments_.modelResolution),
      deepSeek: { answer: 'No. The profile and cited rules prevent it.', conclusion: 'NO', certainty: 'EXPLICIT RULES ANSWER', sources: [] },
    }
  },
})
assert.equal(providerArguments.modelResolution.models[0].matchedAlias, 'redeye')
assert.equal(routed.modelContext.models[0].name, 'Redeye Close Air Support Squad')
const discord = formatRulesDiscordResponse(routed)
assert.equal(discord.embeds[0].fields[0].name, 'OFFICIAL ARMY PROFILE')
assert.match(discord.embeds[0].fields[0].value, /2 official profile variants/)
assert.match(discord.embeds[0].fields[0].value, /Aerial/)
assert.equal(discord.embeds[0].fields[1].name, 'ANSWER')

console.log(`PASS - official Army model context covers ${catalog.exactProfileCount} exact profiles, ${catalog.canonicalProfileCount} canonical variants, and ${catalog.aliases.size} model aliases with rules-prompt and Discord routing.`)
