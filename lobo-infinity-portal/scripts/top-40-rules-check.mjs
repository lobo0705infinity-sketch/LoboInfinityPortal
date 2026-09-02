import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const source = await readFile(new URL('../src/pages/EventHome.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/pages/EventHome.css', import.meta.url), 'utf8')
const navigation = await readFile(new URL('../src/config/eventNavigation.ts', import.meta.url), 'utf8')

assert.match(source, /selectedSection === 'rules'/)
assert.match(source, /data\.event\.id === 'event-lobo-s-american-top-40'/)
assert.match(source, /data-event-section="rules"/)
assert.match(source, /<Top40Rules \/>/)

for (const text of [
  '40 Player Max', 'Seeded by Corvus Belli ELO', 'Double Elimination',
  '7+ Days per Active Match', 'No Automatic Forfeits', 'Winners Bracket',
  'Losers Bracket', 'Grand Final', '7 full days', 'Deadline Extension',
  'Other Commissioner Ruling', 'Mission Geist', 'Tournament Points',
  'Objective Points', 'Victory Points', 'Army Intelligence',
  'does not introduce an army-list lock',
  "Lobo&apos;s American Top 40 Champion",
]) {
  assert.ok(source.includes(text), `Top 40 rules must include: ${text}`)
}

assert.match(source, /type EventHomeSection = 'bracket' \| 'overview' \| 'registration' \| 'results' \| 'rules'/)
assert.match(source, /hasEventCapability\(capabilities, 'rules'\) &&[\s\S]*data\.event\.id !== 'event-lobo-s-american-top-40'/)
assert.match(source, /function EventRulesPage[\s\S]*<Top40Rules \/>/)
assert.match(source, /Grand Final — Winner Takes All/)
assert.match(source, /single Grand Final/)
assert.match(source, /regardless of previous losses/)
assert.match(source, /There is no bracket reset or second Grand Final/)
assert.match(source, /function EventRules[\s\S]*<section className="panel event-home-panel" id="rules">/)
assert.doesNotMatch(source, /function EventRules[\s\S]*return <Top40Rules \/>/)
assert.match(styles, /\.top40-rules-grid[\s\S]*grid-template-columns: repeat\(2/)
assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.top40-rules-grid[\s\S]*grid-template-columns: 1fr/)

const top40IdIndex = navigation.indexOf("id: 'event-lobo-s-american-top-40'")
const blockStart = navigation.lastIndexOf('capabilities: [', top40IdIndex)
const blockEnd = navigation.indexOf("type: 'Individual Double Elimination'", top40IdIndex)
const block = navigation.slice(blockStart, blockEnd)
assert.match(block, /'overview',[\s\S]*'registration',[\s\S]*'bracket',[\s\S]*'results',[\s\S]*'rules'/)
assert.doesNotMatch(block, /'teams'|'standings'|'schedule'|'pairings'/)
assert.match(block, /rules: '\/event\/:eventId\/rules'/)
assert.doesNotMatch(source, /Generate Bracket/)

const browserBaseUrl = process.env.TOP40_RULES_BASE_URL?.replace(/\/$/, '')

if (browserBaseUrl) {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { height: 900, width: 1280 } })
    const overviewUrl = `${browserBaseUrl}/event/event-lobo-s-american-top-40`
    const rulesUrl = `${overviewUrl}/rules`

    await page.goto(overviewUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('#event-home-title').waitFor({ timeout: 120000 })
    assert.match(await page.locator('#event-home-title').innerText(), /Lobo(?:'s| S) American Top 40/)
    assert.equal(await page.locator('#top40-rules-title').count(), 0)
    assert.doesNotMatch(await page.locator('body').innerText(), /40 PLAYER MAX/)

    await page.locator('nav[aria-label="Event navigation"]').getByRole('link', { exact: true, name: 'Rules' }).click()
    await page.waitForURL(rulesUrl)
    await page.locator('#top40-rules-title').waitFor({ timeout: 120000 })
    assert.equal(await page.locator('.event-overview-dashboard').count(), 0)
    assert.match(await page.locator('#rules').innerText(), /40 PLAYER MAX/)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('#top40-rules-title').waitFor({ timeout: 120000 })
    assert.equal(page.url(), rulesUrl)

    await page.locator('nav[aria-label="Event navigation"]').getByRole('link', { exact: true, name: 'Overview' }).click()
    await page.waitForURL(overviewUrl)
    await page.locator('#event-home-title').waitFor({ timeout: 120000 })
    assert.equal(await page.locator('#top40-rules-title').count(), 0)
  } finally {
    await browser.close()
  }
}

console.log('Top 40 event-specific Rules regression passed.')
