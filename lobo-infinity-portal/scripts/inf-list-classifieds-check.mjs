import assert from 'node:assert/strict'
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
  p('Engineer', { skills: ['Engineer'], ph: 12 }),
  p('STR REM', { troopType: 5, ph: 8, vita: false, structure: true }),
  p('Doctor', { skills: ['Doctor'], ph: 9 }),
  p('D-Charges profile', { weapons: [{ name: 'D-Charges' }] }),
  p('Impetuous CoC', { troopClassification: 2, skills: ['Chain of Command', 'Impetuous'] }),
  p('Character', { troopClassification: 10 }),
]
const coverage = assessInfListClassifieds(profiles)
assert.equal(coverage.total, 20, 'audit every card in the official standard deck')
assert.deepEqual(byName(coverage, 'Follow-Up').eligible.map(p => p.unitName), ['Veteran MI'])
assert.deepEqual(byName(coverage, 'HVT: Kidnapping').eligible.map(p => p.unitName), ['Veteran MI', 'Character'], 'Impetuous Chain of Command cannot CivEvac')
assert.deepEqual(byName(coverage, 'Net-Undermine').eligible.map(p => p.unitName), ['Veteran MI', 'Impetuous CoC', 'Character'], 'ITS 18 Long Service makes Characters Veteran Troops')
assert.deepEqual(byName(coverage, 'Sabotage').eligible.map(p => p.unitName), ['D-Charges profile'])
assert.deepEqual(byName(coverage, 'Test Run').eligible.map(p => p.unitName), ['Engineer'])
assert.deepEqual(byName(coverage, 'Experimental Drug').eligible.map(p => p.unitName), ['Doctor'])
assert.deepEqual(byName(coverage, 'HVT: Designation').eligible.map(p => p.unitName), ['FO'], 'Killer Hacking Device has no Spotlight')
assert.deepEqual(byName(coverage, 'Data Scan').eligible.map(p => p.unitName), ['Killer Hacker'])
assert.ok(byName(coverage, 'Rescue').eligible.some(p => p.unitName === 'Engineer'))
assert.ok(coverage.secureHvt.length)

const spotlight = assessInfListClassifieds([p('HD Hacker', { equipment: ['Hacking Device'], hackingPrograms: ['Spotlight'] })])
assert.equal(byName(spotlight, 'Telemetry').possible, true)
assert.equal(byName(spotlight, 'HVT: Designation').possible, true)
assert.equal(byName(spotlight, 'Experimental Drug').possible, false)
assert.equal(byName(spotlight, 'Rescue').possible, false, 'a model cannot Casevac itself')

const noTarget = assessInfListClassifieds([p('Engineer only', { skills: ['Engineer'], ph: 9 })])
assert.equal(byName(noTarget, 'Test Run').possible, false, 'an Engineer alone has no allied STR target')
const unableToCarry = assessInfListClassifieds([p('Low PH', { ph: 8 }), p('High PH', { ph: 12, cc: 0 })])
assert.equal(byName(unableToCarry, 'Rescue').possible, false, 'carrier PH must reach target PH')
const baggage = assessInfListClassifieds([p('Baggage', { ph: 8, equipment: ['Baggage'] }), p('High PH', { ph: 12, cc: 0 })])
assert.equal(byName(baggage, 'Rescue').possible, true, 'Baggage bypasses the PH comparison')

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
assert.equal(compositeProfiles[1].structure, true, 'Billie provides an allied STR target for Test Run')
assert.equal(byName(assessInfListClassifieds(compositeProfiles), 'Net-Undermine').eligible.length, 1, 'Long Service applies to Jazz, not Billie')

const embeds = formatInfListClassifiedEmbeds(coverage)
assert.equal(embeds.length, 2)
assert.deepEqual(embeds.map(embed => embed.fields.length), [10, 11])
assert.ok(embeds.flatMap(embed => embed.fields).every(field => field.name.length < 256 && field.value.length <= 1024))
const reply = await createInfListResponse({
  armyCode: 'QUJDRA==',
  withRenderSlot: task => task(),
  render: async () => ({ classifiedCoverage: coverage, officialArmyUrl: 'https://example.test/army', tacticalPages: [] }),
})
assert.equal(reply.embeds.length, 2, 'both text and slash /inf-list responses include the coverage cards')
assert.equal(reply.embeds[0].fields[0].name, '✓ 1. Follow-Up')
console.log('ITS 18 /inf-list classified coverage passed.')
