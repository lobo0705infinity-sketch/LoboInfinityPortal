import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { assessInfListClassifieds, formatInfListClassifiedEmbeds } from '../bot/inf-list-classifieds.mjs'
import { createInfListResponse } from '../bot/inf-list-command.mjs'
import { buildSubmittedProfiles } from '../bot/inf-list-tactical.mjs'

const p = (id, overrides = {}) => ({
  combinedId: id, unitName: id, profileName: id, troopType: 1, troopClassification: 2,
  cc: 12, ph: 10, vita: true, structure: false, skills: [], equipment: [],
  hackingPrograms: [], weapons: [], ...overrides,
})
const byName = (coverage, name) => coverage.cards.find(card => card.name === name)

const profiles = [
  p('Veteran MI', { troopType: 2, troopClassification: 4 }),
  p('Killer Hacker', { skills: ['Hacker'], equipment: ['Killer Hacking Device'] }),
  p('FO', { skills: ['Forward Observer'] }),
  p('Engineer', { skills: ['Engineer'], equipment: ['GizmoKit'], ph: 12 }),
  p('STR REM', { troopType: 5, ph: 8, vita: false, structure: true }),
  p('Doctor', { skills: ['Doctor'], equipment: ['MediKit'], ph: 9 }),
  p('D-Charges profile', { weapons: [{ name: 'D-Charges' }] }),
  p('Impetuous CoC', { troopClassification: 2, skills: ['Chain of Command', 'Impetuous'] }),
  p('Character', { troopClassification: 10 }),
  p('Lieutenant', { skills: ['Lieutenant'] }),
  p('NCO', { skills: ['NCO'] }),
]
const coverage = assessInfListClassifieds(profiles)
assert.deepEqual(coverage.cards.map(card => card.name), [
  'HVT: Follow-Up', 'Net-Undermine', 'HVT: Identity Check', 'Capture', 'HVT: Kidnapping',
  'HVT: Inoculation', 'Sabotage', 'Combat Support', 'HVT: Espionage', 'HVT: Reverse Engineering',
  'Industrial Espionage', 'Nanoespionage', 'Mapping', 'Data Scan', 'HVT: Designation',
  'Telemetry', 'Predator', 'Suspected Infiltration', 'Vigilance', 'HVT: Assassination',
], 'the current Operations Deck cards appear in their printed order')
assert.equal(coverage.total, 20)
assert.deepEqual(byName(coverage, 'HVT: Follow-Up').eligible.map(p => p.unitName), ['Veteran MI'])
assert.deepEqual(byName(coverage, 'HVT: Kidnapping').eligible.map(p => p.unitName), ['Veteran MI', 'Character'], 'Impetuous Chain of Command cannot CivEvac')
assert.deepEqual(byName(coverage, 'Net-Undermine').eligible.map(p => p.unitName), ['Veteran MI', 'Impetuous CoC', 'Character'], 'ITS 18 Long Service makes Characters Veteran Troops')
assert.deepEqual(byName(coverage, 'Sabotage').eligible.map(p => p.unitName), ['D-Charges profile'])
assert.deepEqual(byName(coverage, 'Combat Support').eligible.map(p => p.unitName), ['Engineer', 'Doctor'])
assert.deepEqual(byName(coverage, 'Nanoespionage').eligible.map(p => p.unitName), ['Engineer', 'Doctor'])
assert.deepEqual(byName(coverage, 'Industrial Espionage').eligible.map(p => p.unitName), ['Veteran MI', 'FO', 'Engineer', 'Character'], 'Chain of Command alone does not qualify for Industrial Espionage')
assert.deepEqual(byName(coverage, 'Suspected Infiltration').eligible.map(p => p.unitName), ['Veteran MI', 'Killer Hacker', 'Doctor', 'Character'], 'Chain of Command alone does not qualify for Suspected Infiltration')
assert.deepEqual(byName(coverage, 'Vigilance').eligible.map(p => p.unitName), ['Veteran MI'])
assert.deepEqual(byName(coverage, 'HVT: Assassination').eligible.map(p => p.unitName), ['Impetuous CoC', 'Lieutenant', 'NCO'])
assert.deepEqual(byName(coverage, 'HVT: Designation').eligible.map(p => p.unitName), ['FO'], 'Killer Hacking Device has no Spotlight')
assert.deepEqual(byName(coverage, 'Data Scan').eligible.map(p => p.unitName), ['Killer Hacker'])
assert.ok(coverage.secureHvt.length)

const spotlight = assessInfListClassifieds([p('HD Hacker', { equipment: ['Hacking Device'], hackingPrograms: ['Spotlight'] })])
assert.equal(byName(spotlight, 'Telemetry').possible, true)
assert.equal(byName(spotlight, 'HVT: Designation').possible, true)
assert.equal(byName(spotlight, 'Combat Support').possible, false)
assert.equal(byName(spotlight, 'Nanoespionage').possible, false, 'a Hacker alone lacks both the designated support skill and kit')

const noTarget = assessInfListClassifieds([p('Engineer only', { skills: ['Engineer'], ph: 9 })])
assert.equal(byName(noTarget, 'Combat Support').possible, false, 'an Engineer alone has no allied STR target')
assert.equal(byName(noTarget, 'Nanoespionage').possible, false, 'the attack requires a MediKit or GizmoKit')
const servant = assessInfListClassifieds([p('Servant', { skills: ['Engineer', 'Peripheral'] }), p('STR ally', { vita: false, structure: true })])
assert.equal(byName(servant, 'Combat Support').possible, false, 'a Peripheral (Servant) cannot score Combat Support')

const combinedCode = 'gfYKY29ycmVnaWRvcgxORSBUb3VybmV5IDGBLAIBAQAJAIGlAQQAAACBpQEEAAAAh2gBCQAAAIEoAQEAAACGDwABAAAAgYsBBgAAAIGUAQEAAACBlAEDAAAAgRsBAQAAAgEABQCBqgEBAAAAgX8BAgAAAIdlAQEAAACBKAEKAAAAgZoBAQAA'
const compositeProfiles = buildSubmittedProfiles({
  armyCode: combinedCode,
  cards: [{ combinedId: '502-1551-0-1-1', profileName: 'JAZZ' }],
  expandComposite: true,
  metadata: { skills: [{ id: 1, name: 'Hacker' }], equips: [{ id: 7, name: 'Hacking Device Plus' }] },
  officialPayloads: [{ units: [{ id: 1551, isc: 'Jazz & Billie', options: [{ id: 1, includes: [{ group: 1, option: 1, q: 1 }, { group: 2, option: 1, q: 1 }] }], profileGroups: [
    { id: 1, category: 10, profiles: [{ id: 1, cc: 16, ph: 10, str: false, type: 1, equip: [{ id: 7 }] }], options: [{ id: 1, name: 'JAZZ', skills: [{ id: 1 }] }] },
    { id: 2, isc: 'Billie', category: 3, profiles: [{ id: 1, cc: 13, ph: 10, str: true, type: 5 }], options: [{ id: 1, name: 'BILLIE' }] },
  ] }] }],
}).filter(profile => profile.unitId === 1551)
assert.deepEqual(compositeProfiles.map(profile => profile.profileName), ['JAZZ', 'BILLIE'], 'combined Army entries expose both selected models for classified coverage')
assert.equal(compositeProfiles[0].skills.includes('Hacker'), true)
assert.equal(compositeProfiles[1].skills.includes('Hacker'), false, 'Billie does not inherit Jazz’s Hacker skill')
assert.equal(compositeProfiles[1].structure, true, 'Billie provides an allied STR target for Combat Support')
assert.equal(byName(assessInfListClassifieds(compositeProfiles), 'Net-Undermine').eligible.length, 1, 'Long Service applies to Jazz, not Billie')

const source = JSON.parse(gunzipSync(Buffer.from(readFileSync(new URL('../data/infinity-army/benchmark-official-source.json.gz.b64', import.meta.url), 'utf8'), 'base64')))
const exactProfiles = buildSubmittedProfiles({
  armyCode: combinedCode,
  cards: [{ combinedId: '502-1551-0-1-1', profileName: 'JAZZ' }],
  expandComposite: true,
  metadata: source.metadata,
  officialPayloads: [source.payloads.find(payload => payload.url?.endsWith('/502'))],
})
const exactCoverage = assessInfListClassifieds(exactProfiles)
assert.equal(exactCoverage.possible, 19, 'the supplied Corregidor list covers 19 of the current 20 cards')
assert.deepEqual(exactCoverage.cards.filter(card => !card.possible).map(card => card.name), ['HVT: Inoculation'])
assert.ok(byName(exactCoverage, 'Combat Support').eligible.some(profile => profile.profileName === 'TERRITORIAL'))
assert.ok(byName(exactCoverage, 'Nanoespionage').eligible.some(profile => profile.profileName === 'TERRITORIAL'))
assert.ok(byName(exactCoverage, 'HVT: Assassination').eligible.some(profile => profile.skills.includes('Lieutenant')))

const embeds = formatInfListClassifiedEmbeds(coverage)
assert.equal(embeds.length, 1, 'all cards must be in one continuous, visible embed')
assert.equal(embeds[0].fields.length, 21, 'all 20 deck cards and optional Secure HVT fit within Discord’s 25-field limit')
assert.deepEqual(embeds[0].fields.slice(0, 20).map(field => Number(field.name.match(/\d+/)?.[0])), Array.from({ length: 20 }, (_, i) => i + 1))
assert.match(embeds[0].fields[20].name, /Secure HVT/)
assert.ok(embeds[0].fields.every(field => field.name.length < 256 && field.value.length <= 1024))
const crowded = formatInfListClassifiedEmbeds({ ...coverage, cards: coverage.cards.map(card => ({
  ...card, possible: true, eligible: Array.from({ length: 4 }, (_, i) => p(`${'Very Long Unit Name '.repeat(8)}${i}`)), detail: 'A long note about target availability and game conditions.',
})), secureHvt: Array.from({ length: 4 }, (_, i) => p(`${'Very Long Unit Name '.repeat(8)}${i}`)) })[0]
const embedCharacters = embed => embed.title.length + embed.description.length + embed.fields.reduce((total, field) => total + field.name.length + field.value.length, 0)
assert.ok(embedCharacters(crowded) <= 6000, 'one-embed output stays under Discord’s 6000-character limit with long unit names')
const reply = await createInfListResponse({
  armyCode: 'QUJDRA==',
  withRenderSlot: task => task(),
  render: async () => ({ classifiedCoverage: coverage, officialArmyUrl: 'https://example.test/army', tacticalPages: [] }),
})
assert.equal(reply.embeds.length, 1, 'both text and slash /inf-list responses show all cards in one embed')
assert.equal(reply.embeds[0].fields[0].name, '✓ 1. HVT: Follow-Up')
assert.equal(reply.embeds[0].fields[19].name, '✓ 20. HVT: Assassination')
assert.doesNotMatch(reply.embeds[0].url, /classified-deck-en\.pdf/, 'never link players to the obsolete printable deck')
console.log('ITS 18 /inf-list classified coverage passed.')
