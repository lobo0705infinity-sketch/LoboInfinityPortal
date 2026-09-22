#!/usr/bin/env node
import assert from 'node:assert/strict'
import { buildRulesEvidencePrompt } from '../bot/deepseek-rules.mjs'
import { loadProductionRulesCorpus } from '../bot/infinity-rules-service.mjs'
import { buildRulesTerminologyCatalog, resolveRulesTerminology } from '../bot/rules-terminology.mjs'

const corpus = await loadProductionRulesCorpus({ force: true })
const catalog = buildRulesTerminologyCatalog(corpus)

assert.ok(catalog.entries.length >= 250, `Expected corpus-wide terminology, found ${catalog.entries.length} entries`)
for (const term of [
  'aerial', 'stealth', 'deployable cover', 'multispectral visor level 2',
  'smoke ammunition', 'repeater', 'firewall', 'carbonite', 'camouflaged state',
  'engaged state', 'line of fire', 'zone of control', 'silhouette contact',
  'partial cover', 'total cover', 'automatic reaction order', 'specialist troops',
  'panoply', 'direct template weapon',
]) assert.ok(catalog.entries.some((entry) => entry.normalizedName === term), `Missing official terminology: ${term}`)

const equivalentPairs = [
  [
    'Can an aerial unit benefit from deployable cover',
    'Can a unit with the Aerial skill gain cover from deployable cover?',
    ['aerial', 'deployable cover'],
  ],
  [
    'Can a link team use stealth?',
    'Can a Fireteam use Stealth?',
    ['fireteam', 'stealth'],
  ],
  [
    'Does MSV2 ignore smoke?',
    'Does Multispectral Visor Level 2 ignore Smoke Ammunition?',
    ['multispectral visor level 2', 'smoke ammunition'],
  ],
  [
    'Can a camo marker declare an ARO?',
    'Can a Camouflaged State marker declare an Automatic Reaction Order?',
    ['automatic reaction order', 'camouflaged state'],
  ],
]

for (const [ordinary, official, expected] of equivalentPairs) {
  const left = resolveRulesTerminology(corpus, ordinary)
  const right = resolveRulesTerminology(corpus, official)
  assert.equal(left.intent, 'INTERACTION', ordinary)
  assert.equal(right.intent, 'INTERACTION', official)
  assert.deepEqual(left.entities.map((item) => item.normalizedName).sort(), expected)
  assert.deepEqual(right.entities.map((item) => item.normalizedName).sort(), expected)
  assert.equal(left.conceptSignature, right.conceptSignature, `${ordinary} <> ${official}`)
}

const typo = resolveRulesTerminology(corpus, 'Can a deployble covr protect an aerial trooper?')
assert.equal(typo.conceptSignature, 'INTERACTION:aerial|deployable cover')
assert.ok(typo.entities.some((item) => item.matchType === 'TYPO_CORRECTED'))
assert.equal(typo.correctedQuestion, 'can a deployable cover protect an aerial trooper')

const unrelated = resolveRulesTerminology(corpus, 'purple bananas orbit a quantum teapot')
assert.equal(unrelated.intent, 'BROAD_SEARCH')
assert.deepEqual(unrelated.entities, [])
assert.equal(unrelated.correctedQuestion, unrelated.normalized)

const aerialQuestions = equivalentPairs[0].slice(0, 2)
const prompts = aerialQuestions.map((question) => buildRulesEvidencePrompt(corpus, question))
assert.equal(prompts[0].terminology.conceptSignature, prompts[1].terminology.conceptSignature)
for (const prompt of prompts) {
  const document = JSON.parse(prompt.text.split('\n').at(-1))
  const pages = new Set(document.entries.map((entry) => entry.page))
  for (const page of ['20', '41', '86', '122']) assert.ok(pages.has(page), `${page} missing for: ${prompt.terminology.original}`)
  assert.ok(document.entries.some((entry) => entry.page === '86' && /never in\s+Silhouette contact/i.test(entry.text)), 'Aerial contact restriction missing')
  assert.ok(document.entries.some((entry) => entry.page === '122' && /allows the Partial Cover rule/i.test(entry.text)), 'Deployable Cover rule missing')
  assert.ok(document.entries.some((entry) => entry.page === '41' && /in contact with a piece of\s+scenery/i.test(entry.text)), 'Partial Cover contact requirement missing')
  assert.match(prompt.text, /Do not reinterpret a recognized official term as an ordinary adjective or generic noun/)
}

const controllingPages = (prompt) => {
  const entries = JSON.parse(prompt.text.split('\n').at(-1)).entries
  return entries.filter((entry) => ['20', '41', '86', '122'].includes(entry.page)).map((entry) => `${entry.sourceId}:${entry.page}:${entry.text}`).sort()
}
assert.deepEqual(controllingPages(prompts[0]), controllingPages(prompts[1]), 'Equivalent wording must activate identical controlling evidence')

console.log(`PASS - corpus-wide terminology resolver (${catalog.entries.length} official terms), aliases, inflections, typo correction, ambiguity guard, and equivalent evidence routing.`)
