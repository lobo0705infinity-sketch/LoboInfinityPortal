import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'
import { classifyTacticalBrief, renderTacticalBrief, TACTICAL_EMPTY_MESSAGE } from '../bot/inf-list-tactical.mjs'
import { createInfListResponse } from '../bot/inf-list-command.mjs'

const weapon = (name, burst, type = 'WEAPON', mode = '') => ({ name, burst, type, mode })
const profile = (combinedId, overrides = {}) => ({
  bs: 13, combinedId, equipment: [], linkability: 'unavailable', profileName: `Loadout ${combinedId}`,
  skills: [], unitId: Number(combinedId.replace(/\D/g, '')) || 1, unitName: `Unit ${combinedId}`, weapons: [], ...overrides,
})

const fixtures = [
  profile('bs12', { bs: 12, weapons: [weapon('Heavy Machine Gun', 4)] }),
  profile('b3', { weapons: [weapon('Spitfire', 3)] }),
  profile('apex', { skills: ['Mimetism [-3]', 'MSV L2', 'BS Attack (−3)'], weapons: [weapon('Heavy Machine Gun', 4)] }),
  profile('apex'), // duplicate exact profile, deliberately different missing data must not aggregate into another ID
  profile('hack', { equipment: ['Killer Hacking Device', 'Fast-Panda', 'Deployable-Repeater', 'Repeater', 'TinBot'], skills: ['Hacker'], weapons: [weapon('Pitcher', 1)] }),
  profile('aro-sniper', { linkability: 'verified-linkable', skills: ['Mimetism -6', 'MSV 1'], weapons: [weapon('MULTI Sniper Rifle', 2)] }),
  profile('aro-pzf', { linkability: 'unavailable', weapons: [weapon('Panzerfaust', 1), weapon('Flammenspeer', 1)] }),
  profile('aro-hrl', { weapons: [weapon('Heavy Rocket Launcher', 2), weapon('Feuerbach', 2)] }),
  profile('deploy', { skills: ['Parachutist (+3)', 'Combat-Jump (PH=12)', 'Hidden Deployment'], weapons: [weapon('Combi Rifle', 3)] }),
  profile('defense', { skills: ['Camouflage (-3)', 'Decoy (2)', 'Minelayer'], weapons: [weapon('Shock Mine', 1)] }),
  profile('mim-only', { skills: ['Mimetism (-6)'] }),
  profile('same-unit-a', { unitId: 99, unitName: 'Same Unit', skills: ['Camouflage'], profileName: 'Camo loadout' }),
  profile('same-unit-b', { bs: 12, unitId: 99, unitName: 'Same Unit', profileName: 'Plain loadout', weapons: [weapon('Weapon Named Hidden Deployment', 4)] }),
  profile('duplicate', { skills: ['Minelayer'], equipment: ['AP Mine'] }),
  profile('duplicate', { skills: ['Minelayer'], equipment: ['AP Mine'] }),
  profile('malformed', { bs: 'thirteen', equipment: [null, 'TinBot Pitcher Defense'], skills: [null, 'Camouflage Unit', 'Hacker Support', 'Combat Jump Expert', 'Hidden Deployment Unit'], weapons: [weapon('Heavy Machine Gun', 'four'), weapon('Panzerfaust Specialist Rifle', null)] }),
]

const analysis = classifyTacticalBrief(fixtures, { faction: 'Fixture', listName: 'Exact Profiles' })
assert.deepEqual(analysis.categories.apex.map((item) => item.combinedId), ['apex'])
assert.deepEqual(analysis.categories.apex[0].badges, ['Mimetism [-3]', 'MSV L2', 'BS Attack (−3)'])
assert.deepEqual(analysis.networkSummary, { hackers: 1, pitcherCarriers: 1, fastPandaCarriers: 1, deployableRepeaterCarriers: 1 })
assert.equal(analysis.categories.hacking.length, 1)
assert.deepEqual(new Set(analysis.categories.aro.flatMap((item) => item.qualifyingWeapons.map((item) => item.name))), new Set(['MULTI Sniper Rifle', 'Panzerfaust', 'Flammenspeer', 'Heavy Rocket Launcher', 'Feuerbach']))
assert.equal(analysis.categories.aro[0].linkability, 'verified-linkable')
assert.equal(analysis.categories.alternative.length, 1)
assert.equal(analysis.categories.alternative[0].badges.length, 3)
assert.deepEqual(new Set(analysis.categories.defensive.map((item) => item.combinedId)), new Set(['defense', 'duplicate', 'same-unit-a']))
assert.equal(analysis.categories.defensive.find((item) => item.combinedId === 'duplicate').quantity, 2)
assert.equal(analysis.categories.defensive.some((item) => item.combinedId === 'mim-only'), false)
assert.equal(analysis.categories.defensive.some((item) => item.combinedId === 'same-unit-b'), false)

const empty = classifyTacticalBrief([], { faction: 'Empty' })
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
