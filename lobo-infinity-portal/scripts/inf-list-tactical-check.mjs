import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'
import { buildSubmittedProfiles, classifyTacticalBrief, filterCanonicalFireteamMembershipsForProfile, renderTacticalBrief, TACTICAL_EMPTY_MESSAGE } from '../bot/inf-list-tactical.mjs'
import { createInfListResponse } from '../bot/inf-list-command.mjs'
import { validateExactSectorialData } from './inf-list-render-poc.mjs'

const weapon = (name, burst, type = 'WEAPON', mode = '', burstStatus) => ({ name, burst, type, mode, ...(burstStatus ? { burstStatus } : {}) })
const profile = (combinedId, overrides = {}) => ({
  bs: 13, cc: 10, combinedId, equipment: [], linkability: 'unavailable', profileName: `Loadout ${combinedId}`,
  points: 20, skills: [], unitId: Number(combinedId.replace(/\D/g, '')) || 1, unitName: `Unit ${combinedId}`, weapons: [], ...overrides,
})

const fixtures = [
  profile('bs12', { bs: 12, weapons: [weapon('Heavy Machine Gun', 4)] }),
  profile('burst-bonus', { bs: 13, skills: ['BS Attack (+1B)', 'Albedo (-3)'], weapons: [weapon('AP Spitfire', 3)] }),
  profile('b3', { weapons: [weapon('Spitfire', 3)] }),
  profile('apex', { skills: ['Mimetism [-3]', 'MSV L2', 'BS Attack (−3)'], weapons: [weapon('Heavy Machine Gun', 4)] }),
  profile('bs14-apex', { bs: 14, weapons: [weapon('AP Heavy Machine Gun', 4)] }),
  profile('b5-apex', { bs: 10, weapons: [weapon('Hyper-Rapid Magnetic Cannon', 5)] }),
  profile('ajax-pistol', { bs: 13, skills: ['BS Attack (+1B)', 'Mimetism [-3]'], weapons: [weapon('AP Heavy Pistol', 3)] }),
  profile('thamyris-pistol', { bs: 13, skills: ['BS Attack (+1B)', 'Mimetism [-3]'], weapons: [weapon('Assault Pistol', 3)] }),
  profile('apex'), // duplicate exact profile, deliberately different missing data must not aggregate into another ID
  profile('hack', { equipment: ['Killer Hacking Device', 'Fast-Panda', 'Deployable-Repeater', 'Repeater', 'TinBot'], skills: ['Hacker'], weapons: [weapon('Pitcher', 1)] }),
  profile('aro-sniper', { linkability: 'verified-linkable', skills: ['BS Attack (+1SD)'], weapons: [weapon('MULTI Sniper Rifle', 2)] }),
  profile('aro-pzf', { points: 14, linkability: 'unavailable', weapons: [weapon('Panzerfaust', 1), weapon('Flammenspeer', 1)] }),
  profile('aro-hrl', { skills: ['Neurocinetics'], weapons: [weapon('Heavy Rocket Launcher', 2), weapon('Feuerbach', 2)] }),
  profile('hrl-competent', { bs: 14, weapons: [weapon('Heavy Rocket Launcher', 3)] }),
  profile('hrl-bs-near-miss', { bs: 11, weapons: [weapon('Heavy Rocket Launcher', 3)] }),
  profile('tankhunter', { points: 36, skills: ['Mimetism [-3]'], weapons: [{ ...weapon('Portable Autocannon', 2), modifiers: ['+1SD'] }] }),
  profile('pac-near-miss', { points: 36, weapons: [{ ...weapon('Portable Autocannon', 2), modifiers: ['+1SD'] }] }),
  profile('flash', { points: 8, weapons: [weapon('Flash Pulse', 1)] }),
  profile('cheap-sd', { points: 13, skills: ['BS Attack (+1SD)'], weapons: [weapon('Submachine Gun', 3)] }),
  profile('pheroware', { equipment: ['Pheroware Tactics'], skills: ['Total Reaction'] }),
  profile('pt', { equipment: ['PT'], skills: ['Neurocinetics'] }),
  profile('sd-rifle', { points: 30, weapons: [{ ...weapon('Combi Rifle', 3), modifiers: ['+2SD'] }] }),
  profile('vision', { weapons: [weapon('Smoke Grenades', 1), weapon('Discoballer', 1)], equipment: ['Pheroware Mirroball'], skills: ['Eclipse'] }),
  profile('apex-cc', { cc: 22, skills: ['Martial Arts L2', 'Natural Born Warrior', 'Berserk (+3)', 'CC Attack (+1B)'] }),
  profile('cc-near-miss', { cc: 21, skills: ['Martial Arts L4'] }),
  profile('deploy', { skills: ['Parachutist (+3)', 'Combat-Jump (PH=12)', 'Hidden Deployment', 'Impersonation (-6)'], weapons: [weapon('Combi Rifle', 3)] }),
  profile('netrod', { unitName: 'Netrod', skills: ['Combat Jump (PH=12)'] }),
  profile('imetron', { unitName: 'Imetron', skills: ['Parachutist'] }),
  profile('imetron-accented', { unitName: 'ÍMETRON', skills: ['Combat Jump (PH=12)'] }),
  profile('imetron-accented', { unitName: 'ÍMETRON', skills: ['Combat Jump (PH=12)'] }),
  profile('defense', { skills: ['Camouflage (-3)', 'Decoy (2)', 'Minelayer'], weapons: [weapon('Shock Mine', 1)] }),
  profile('mim-only', { skills: ['Mimetism (-6)'] }),
  profile('same-unit-a', { unitId: 99, unitName: 'Same Unit', skills: ['Camouflage'], profileName: 'Camo loadout' }),
  profile('same-unit-b', { bs: 12, unitId: 99, unitName: 'Same Unit', profileName: 'Plain loadout', weapons: [weapon('Breaker Combi Rifle', 4)] }),
  profile('duplicate', { skills: ['Minelayer'], equipment: ['AP Mine'] }),
  profile('duplicate', { skills: ['Minelayer'], equipment: ['AP Mine'] }),
  profile('malformed', { bs: 'thirteen', equipment: [null, 'TinBot Pitcher Defense'], skills: [null, 'Camouflage Unit', 'Hacker Support', 'Combat Jump Expert', 'Hidden Deployment Unit'], weapons: [weapon('Heavy Machine Gun', 'four'), weapon('Panzerfaust Specialist Rifle', null)] }),
  profile('ambiguous-burst', { bs: 15, weapons: [weapon('Armed Turret', null, 'WEAPON', '', 'ambiguous')] }),
  profile('unavailable-burst', { bs: 15, weapons: [weapon('Flammenspeer', null, 'WEAPON', '', 'unknown')] }),
]

const analysis = classifyTacticalBrief(fixtures, { faction: 'Fixture', listName: 'Exact Profiles' })
assert.deepEqual(new Set(analysis.categories.apex.map((item) => item.combinedId)), new Set(['apex', 'burst-bonus', 'bs14-apex', 'b5-apex']))
assert.equal(analysis.categories.apex.some((item) => ['ajax-pistol', 'thamyris-pistol'].includes(item.combinedId)), false)
assert.deepEqual(analysis.categories.apex.find((item) => item.combinedId === 'apex').badges, ['Mimetism [-3]', 'MSV L2', 'BS Attack (−3)'])
assert.equal(analysis.categories.apex.some((item) => ['ambiguous-burst', 'unavailable-burst'].includes(item.combinedId)), false)
assert.deepEqual(analysis.networkSummary, { hackers: 1, pitcherCarriers: 1, fastPandaCarriers: 1, deployableRepeaterCarriers: 1, repeaterCarriers: 1 })
assert.equal(analysis.categories.hacking.length, 1)
assert.equal(analysis.categories.valuableAro.some((item) => item.combinedId === 'pheroware'), true)
assert.equal(analysis.categories.valuableAro.some((item) => item.combinedId === 'pt'), true)
assert.equal(analysis.categories.disposableAro.some((item) => item.combinedId === 'sd-rifle'), false)
assert.equal(analysis.categories.disposableAro.some((item) => item.combinedId === 'aro-pzf'), false)
assert.equal(analysis.categories.disposableAro.some((item) => item.combinedId === 'cheap-sd'), true)
assert.equal(analysis.categories.vision.some((item) => item.combinedId === 'vision'), true)
assert.equal(analysis.categories.apexCc.some((item) => item.combinedId === 'apex-cc'), true)
assert.equal(analysis.categories.apexCc.some((item) => item.combinedId === 'cc-near-miss'), false)
assert.deepEqual(new Set(analysis.categories.competent.map((item) => item.combinedId)), new Set(['bs12', 'same-unit-b', 'sd-rifle', 'hrl-competent', 'tankhunter']))
assert.equal(analysis.categories.competent.some((item) => item.combinedId === 'hrl-bs-near-miss'), false)
assert.equal(analysis.categories.apex.find((item) => item.combinedId === 'burst-bonus').qualifyingWeapons[0].burst, 4)
assert.deepEqual(new Set(analysis.categories.valuableAro.flatMap((item) => item.qualifyingWeapons.map((item) => item.name))), new Set(['MULTI Sniper Rifle', 'Heavy Rocket Launcher', 'Feuerbach', 'Portable Autocannon']))
assert.deepEqual(analysis.categories.valuableAro.find((item) => item.combinedId === 'tankhunter')?.badges, ['Portable Autocannon (+1SD)'])
assert.equal(analysis.categories.competent.some((item) => item.combinedId === 'tankhunter'), true, 'Portable Autocannon +1SD and Mimetism qualifies')
assert.equal(analysis.categories.competent.some((item) => item.combinedId === 'pac-near-miss'), false, 'Portable Autocannon +1SD alone is insufficient')
assert.deepEqual(new Set(analysis.categories.disposableAro.flatMap((item) => item.qualifyingWeapons.map((item) => item.name))), new Set(['Flash Pulse', 'Submachine Gun']))
assert.equal(analysis.categories.valuableAro[0].linkability, 'verified-linkable')
assert.equal(analysis.categories.alternative.length, 1)
assert.equal(analysis.categories.alternative[0].badges.length, 4)
assert.equal(analysis.categories.alternative.some((item) => /netrod|imetron/i.test(item.unitName)), false)
assert.equal(analysis.categories.alternative.some((item) => item.combinedId === 'imetron-accented'), false)
assert.deepEqual(new Set(analysis.categories.defensive.map((item) => item.combinedId)), new Set(['defense', 'duplicate', 'same-unit-a']))
assert.equal(analysis.categories.defensive.find((item) => item.combinedId === 'duplicate').quantity, 2)
assert.equal(analysis.categories.defensive.some((item) => item.combinedId === 'mim-only'), false)
assert.equal(analysis.categories.defensive.some((item) => item.combinedId === 'same-unit-b'), false)

const fireteamAnalysis = classifyTacticalBrief([
  profile('orc', { bs: 14, unitName: 'ORC', points: 35, fireteamTeams: ['White Company'], weapons: [weapon('Feuerbach', 2)] }),
  profile('hannibal', { bs: 13, unitName: 'Hannibal', points: 33, fireteamTeams: ['White Company'], skills: ['BS Attack (+1SD)'], weapons: [weapon('MULTI Marksman Rifle', 3)] }),
  profile('hawkwood', { bs: 13, unitName: 'Hawkwood', points: 35, fireteamTeams: ['Fusiliers'], skills: ['BS Attack (+1SD)'], weapons: [weapon('K1 Sniper Rifle', 2)] }),
  profile('fusilier', { bs: 12, unitName: 'Fusilier', points: 10, fireteamTeams: ['Fusiliers'], weapons: [weapon('Combi Rifle', 3)] }),
  profile('phoenix', { bs: 13, unitName: 'Phoenix', points: 35, fireteamTeams: ['Myrmidons'], weapons: [weapon('Heavy Rocket Launcher', 2)] }),
  profile('myrmidon', { bs: 12, unitName: 'Myrmidon', points: 16, fireteamTeams: ['Myrmidons'], weapons: [weapon('Combi Rifle', 3)] }),
  profile('moran', { unitName: 'Moran', equipment: ['Repeater'], skills: ['Minelayer'] }),
], { faction: 'White Company' })
assert.deepEqual(new Set(fireteamAnalysis.categories.valuableAro.map((item) => item.combinedId)), new Set(['orc', 'hawkwood', 'phoenix']))
assert.deepEqual(new Set(fireteamAnalysis.categories.competent.map((item) => item.combinedId)), new Set(['hawkwood', 'fusilier', 'myrmidon', 'phoenix']))
assert.equal(fireteamAnalysis.categories.apex.some((item) => item.combinedId === 'hannibal'), true)
assert.deepEqual(fireteamAnalysis.categories.hacking.find((item) => item.combinedId === 'moran')?.roles, ['hacking', 'defensive'])
assert.deepEqual(fireteamAnalysis.categories.defensive.find((item) => item.combinedId === 'moran')?.roles, ['hacking', 'defensive'])

const portableAutocannonFireteamAnalysis = classifyTacticalBrief([
  profile('pac-fireteam', { unitName: 'PAC Fireteam', fireteamTeams: ['PAC Team'], skills: ['BS Attack (-3)'], weapons: [weapon('Portable Autocannon', 2)] }),
  profile('pac-teammate', { unitName: 'PAC Teammate', fireteamTeams: ['PAC Team'] }),
])
assert.equal(portableAutocannonFireteamAnalysis.categories.competent.some((item) => item.combinedId === 'pac-fireteam'), true)

const beasthunterMemberships = [{ team: 'Caledonian Fireteam', minSize: 3, required: false, requiredNames: [], memberName: 'BEASTHUNTER FTO', countsAs: '' }]
const beasthunterFtoMemberships = filterCanonicalFireteamMembershipsForProfile(beasthunterMemberships, ['BEASTHUNTER FTO'])
const beasthunterNonFtoMemberships = filterCanonicalFireteamMembershipsForProfile(beasthunterMemberships, ['BEASTHUNTERS'])
assert.equal(beasthunterFtoMemberships.length, 1, 'Beasthunter FTO retains exact-profile Fireteam eligibility')
assert.equal(beasthunterNonFtoMemberships.length, 0, 'non-FTO Beasthunter must not inherit its sibling Fireteam eligibility')
const beasthunterAnalysis = classifyTacticalBrief([
  profile('beasthunter-non-fto', { unitId: 700, unitName: 'Beasthunters Free Guild', profileName: 'BEASTHUNTERS', points: 17, linkability: 'verified-not-linkable', fireteamMemberships: beasthunterNonFtoMemberships, fireteamTeams: [], weapons: [weapon('Panzerfaust', 1)] }),
  profile('beasthunter-fto', { unitId: 700, unitName: 'Beasthunters Free Guild', profileName: 'BEASTHUNTER FTO', points: 17, linkability: 'verified-linkable', fireteamMemberships: beasthunterFtoMemberships, fireteamTeams: ['Caledonian Fireteam'], weapons: [weapon('Panzerfaust', 1)] }),
  profile('caledonian-teammate-1', { fireteamMemberships: [{ ...beasthunterMemberships[0], memberName: 'Teammate' }], fireteamTeams: ['Caledonian Fireteam'] }),
  profile('caledonian-teammate-2', { fireteamMemberships: [{ ...beasthunterMemberships[0], memberName: 'Teammate' }], fireteamTeams: ['Caledonian Fireteam'] }),
])
assert.equal(beasthunterAnalysis.categories.valuableAro.some((item) => item.combinedId === 'beasthunter-fto'), true)
assert.equal(beasthunterAnalysis.categories.valuableAro.some((item) => item.combinedId === 'beasthunter-non-fto'), false, 'non-FTO Beasthunter must not receive a Fireteam-derived Valuable ARO classification')

const ajaxCode = 'gr4Nc3RlZWwtcGhhbGFueA9CdXJuaW5nIEJyaWRnZXOBLAIBAQAFAIY6AQMAAACCaAECAAAAh0ABAwAAAIJQAQEAAAAyAQEAAAIBAAoAgmIBAgAAAIJRAQEAAACCUQEBAAAAglMBAQAAAIJTAQEAAACCVAEBAAAAglkBAgAAAIJgAQEAAACCZAEDAAAAglsBBgAA'
const ajaxProfiles = buildSubmittedProfiles({
  armyCode: ajaxCode,
  cards: [{ combinedId: '702-610-1-2-1', bs: 13, profileName: 'AJAX', skills: [], weapons: ['MULTI Rifle'] }],
  metadata: {
    skills: [{ id: 201, name: 'BS Attack' }],
    weapons: [
      { id: 41, name: 'MULTI Rifle', mode: 'Anti-Materiel Mode', type: 'WEAPON', burst: '1' },
      { id: 41, name: 'MULTI Rifle', mode: 'AP Mode', type: 'WEAPON', burst: '3' },
      { id: 41, name: 'MULTI Rifle', mode: 'Shock Mode', type: 'WEAPON', burst: '3' },
    ],
  },
  officialPayloads: [{
    filters: { extras: [{ id: 8, name: '+1B' }] },
    units: [{ id: 610, isc: 'Ajax the Great, Myrmidon Officer', profileGroups: [{ id: 1, profiles: [{ id: 1, bs: 13, skills: [{ id: 201, extra: [8] }], weapons: [] }], options: [{ id: 2, name: 'AJAX', weapons: [{ id: 41 }] }] }] }],
  }],
})
const ajaxAnalysis = classifyTacticalBrief(ajaxProfiles)
const ajaxCompetent = ajaxAnalysis.categories.competent.find((item) => item.combinedId === '702-610-1-2-1')
assert.ok(ajaxCompetent, 'Ajax qualifies through official BS Attack (+1B), not an identity exception')
assert.equal(ajaxCompetent.qualifyingWeapons.some((item) => item.name === 'MULTI Rifle' && item.burst === 4), true)
assert.deepEqual(ajaxCompetent.badges, ['BS Attack (+1B)'])

const onyxCode = 'glwEb255eAEggSwBAQEAAwCB7QEBAAAAge0BAQAAAIMPAQcAAA%3D%3D'
const onyxPayload = {
  url: 'https://api.corvusbelli.com/army/units/en/604',
  filters: { extras: [] },
  fireteamChart: { teams: [
    { name: 'Unidrons Fireteams', type: ['CORE'], units: [{ name: 'UNIDRON', slug: 'unidron-batroids', required: true }] },
    { name: 'Wildcards', type: [], units: [{ name: 'NEXUS', slug: 'nexus-operatives', comment: '(Unidron)' }] },
  ] },
  units: [
    { id: 493, isc: 'Unidron Batroids', slug: 'unidron-batroids', profileGroups: [{ id: 1, profiles: [{ id: 1, bs: 11 }], options: [{ id: 1, name: 'UNIDRON' }] }] },
    { id: 783, isc: 'Nexus Operatives', slug: 'nexus-operatives', profileGroups: [{ id: 1, profiles: [{ id: 1, bs: 13 }], options: [{ id: 7, name: 'NEXUS', weapons: [{ id: 41 }] }] }] },
  ],
}
const onyxMetadata = { skills: [], weapons: [
  { id: 41, name: 'MULTI Rifle', mode: 'Anti-Materiel Mode', type: 'WEAPON', burst: '1' },
  { id: 41, name: 'MULTI Rifle', mode: 'AP Mode', type: 'WEAPON', burst: '3' },
] }
assert.deepEqual(validateExactSectorialData({ armyCode: onyxCode, metadata: onyxMetadata, payload: onyxPayload }), {
  ok: true, issues: [], memberCount: 3, resolvedMemberCount: 3, sectorialId: 604, sourceUrl: onyxPayload.url,
})
const onyxAnalysis = classifyTacticalBrief(buildSubmittedProfiles({ armyCode: onyxCode, metadata: onyxMetadata, officialPayloads: [onyxPayload] }))
assert.equal(onyxAnalysis.categories.competent.some((item) => item.unitId === 783), true, 'Nexus qualifies with a legal three-member Unidron Fireteam')
assert.equal(Object.values(onyxAnalysis.categories).some((entries) => entries.length), true, 'Onyx tactical brief must not be entirely blank')
assert.equal(validateExactSectorialData({ armyCode: onyxCode, metadata: onyxMetadata, payload: { ...onyxPayload, url: 'https://api.corvusbelli.com/army/units/en/601' } }).ok, false)

const empty = classifyTacticalBrief([], { faction: 'Empty' })
if (!process.argv.includes('--logic-only')) {
  const browser = await chromium.launch({ headless: true })
  const keepOutput = process.argv.includes('--keep')
  const output = await mkdtemp(keepOutput ? resolve('.tmp', 'inf-list-tactical-audit-') : join(tmpdir(), 'inf-list-tactical-'))
  try {
  const pages = await renderTacticalBrief({ analysis, browser })
  const emptyPages = await renderTacticalBrief({ analysis: empty, browser })
  assert.ok(pages.length >= 1 && pages.length <= 5)
  assert.equal(emptyPages.length, 1)
  assert.equal(pages.every((page) => page.width === 1440 && page.height <= 7500), true)
  await Promise.all(pages.map((page, index) => writeFile(join(output, `brief-${index + 1}.png`), page.imageBuffer)))
  const response = await createInfListResponse({
    armyCode: 'QUJDRA==',
    withRenderSlot: (task) => task(),
    render: async () => ({ officialArmyUrl: 'https://example.test/army', readableImageBuffer: Buffer.from('readable'), tacticalPages: pages, profilePages: [{ imageBuffer: Buffer.from('profile-1') }, { imageBuffer: Buffer.from('profile-2') }] }),
  })
  assert.deepEqual(response.files.map((file) => file.name), [
    'infinity-army-list-readable.png',
    ...pages.map((_, index) => pages.length > 1 ? `infinity-army-tactical-brief-${index + 1}.png` : 'infinity-army-tactical-brief.png'),
    'infinity-army-profiles-1.png', 'infinity-army-profiles-2.png',
  ])
  assert.ok(response.files.length <= 10)
  assert.equal(JSON.stringify(empty).includes(TACTICAL_EMPTY_MESSAGE), false)
  console.log(JSON.stringify({ result: 'PASS', dimensions: pages.map(({ width, height }) => ({ width, height })), attachmentOrder: response.files.map((file) => file.name), output }, null, 2))
  } finally {
    await browser.close()
    if (!keepOutput) await rm(output, { recursive: true, force: true })
  }
}
