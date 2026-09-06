import assert from 'node:assert/strict'
import { classifyTacticalBrief, formatBurst, loadoutDetail, renderTacticalBrief } from '../bot/inf-list-tactical.mjs'
import { chromium } from 'playwright'

const p = (combinedId, overrides = {}) => ({ combinedId, unitId: 1, unitName: 'Beasthunter', profileName: 'Beasthunter', bs: 13, skills: [], equipment: [], weapons: [], linkability: 'unavailable', ...overrides })
const base = p('1-1', { weapons: [{ name: 'MULTI Sniper Rifle', burst: null, burstStatus: 'unknown', type: 'WEAPON' }] })
const same = p('1-1', { weapons: [{ name: 'MULTI Sniper Rifle', burst: null, burstStatus: 'unknown', type: 'WEAPON' }] })
const different = p('1-2', { profileName: 'Beasthunter — Panzerfaust', weapons: [{ name: 'Panzerfaust', burst: 1, type: 'WEAPON' }] })
const analysis = classifyTacticalBrief([base, same, different], { faction: 'Fixture' })
assert.equal(analysis.categories.aro.length, 2)
assert.equal(analysis.categories.aro.find((x) => x.combinedId === '1-1').quantity, 2)
assert.equal(formatBurst({ burst: 4 }), 'B4')
assert.equal(formatBurst({ burst: 1, burstStatus: 'canonical', modeResolution: 'ambiguous' }), 'B1')
assert.equal(formatBurst({ burst: 2, burstStatus: 'canonical', modeResolution: 'ambiguous' }), 'B2')
assert.equal(formatBurst({ burst: '3' }), 'B3')
assert.equal(formatBurst({ burst: null, burstStatus: 'unknown' }), 'Burst unavailable')
assert.equal(formatBurst({ burst: null, burstStatus: 'ambiguous' }), 'Burst ambiguous')
assert.equal(formatBurst({ burst: null, burstStatus: 'not-applicable' }), '')
assert.ok(loadoutDetail(different).includes('Panzerfaust'))
const browser = await chromium.launch({ headless: true })
try {
  const pages = await renderTacticalBrief({ analysis, browser })
  assert.ok(pages.length >= 1)
} finally { await browser.close() }
console.log('Tactical presentation checks passed.')
