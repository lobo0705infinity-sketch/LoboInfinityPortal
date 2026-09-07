import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const eventHome = await readFile(new URL('../src/pages/EventHome.tsx', import.meta.url), 'utf8')
const publicApp = await readFile(new URL('../src/public/SnapshotPublicApp.tsx', import.meta.url), 'utf8')
const source = await readFile(new URL('../src/components/Top40RulesPage.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/components/Top40RulesPage.css', import.meta.url), 'utf8')
const rulebook = await readFile(new URL('../src/content/rulebooks/top40.ts', import.meta.url), 'utf8')
const navigation = await readFile(new URL('../src/config/eventNavigation.ts', import.meta.url), 'utf8')
const artwork = await readFile(new URL('../public/assets/events/top-40-rules-v2.png', import.meta.url))

const eventId = 'event-lobo-s-american-top-40'
const expectedHash = '9e71cc4c09d6330aa0bd8d8974debd3ad1f58e7cd80c781e72fb69bf29834135'
const sectionIds = [
  'eligibility-and-field',
  'tournament-format-and-seeding',
  'army-points',
  'army-lists',
  'missions',
  'match-scheduling',
  'reporting-results-and-draws',
  'defaults-and-forfeits',
]

assert.equal(createHash('sha256').update(artwork).digest('hex'), expectedHash)
assert.match(eventHome, /isTop40 && selectedSection === 'rules'/)
assert.match(eventHome, /return <Top40RulesPage \/>/)
assert.match(publicApp, /path="\/event\/event-lobo-s-american-top-40\/rules" element=\{<Top40RulesPage \/>\}/)
assert.match(source, /src="\/assets\/events\/top-40-rules-v2\.png"/)
assert.match(source, /<h2>On This Page<\/h2>/)
assert.match(source, /href=\{`#\$\{section\.id\}`\}/)
assert.doesNotMatch(eventHome, /function Top40Rules\(|No Automatic Forfeits|There is no bracket reset/)
assert.match(styles, /\.top40-rules-hero img[\s\S]*width: 100%;[\s\S]*height: auto;[\s\S]*object-fit: contain;/)
assert.doesNotMatch(styles, /object-fit:\s*cover|filter:|\.top40-rules-hero::(?:before|after)/)
assert.match(source, /current-league-rules-page top40-rules-page/)
assert.match(source, /height="941"[\s\S]*width="1672"/)
assert.match(publicApp, /item==='rules'&&eventId==='event-lobo-s-american-top-40'\?`\/event\/\$\{eventId\}\/rules`/)

for (const id of sectionIds) assert.ok(rulebook.includes(`id: '${id}'`), `missing section: ${id}`)
for (const text of [
  'Lobo’s American Top 40 Rules',
  'Lobo’s American Top 40 is an individual, 300-point, double-elimination Infinity tournament open to players throughout the Americas. Players are eliminated after their second match loss.',
  'The field is limited to a maximum of 40 players.',
  'Players are manually seeded using Corvus Belli rankings.',
  'Every match is played at 300 points.',
  'Players choose the army list they will use at the time of each game.',
  'The complete mission pool will be published before the tournament begins.',
  'both players receive at least seven full days',
  'If a match ends in a draw, the winner is determined by Victory Points.',
  'The Tournament Organizer’s ruling on defaults and forfeits is final.',
]) assert.ok(rulebook.includes(text), `missing required content: ${text}`)

for (const forbidden of ['entry fee', 'prize', 'sportsmanship score', 'bracket reset', 'classified objective', 'sectorial lock', 'faction lock']) {
  assert.equal(rulebook.toLowerCase().includes(forbidden), false, `unexpected rule: ${forbidden}`)
}

const top40Index = navigation.indexOf(`id: '${eventId}'`)
const top40Block = navigation.slice(top40Index, navigation.indexOf('\n  },', top40Index) + 5)
assert.match(top40Block, /rules: '\/event\/:eventId\/rules'/)
assert.equal((navigation.match(/rules: '\/event\/:eventId\/rules'/g) || []).length, 1)

const browserBaseUrl = process.env.TOP40_RULES_BASE_URL?.replace(/\/$/, '')
const screenshotDirectory = process.env.TOP40_RULES_SCREENSHOT_DIR
if (browserBaseUrl) {
  if (screenshotDirectory) await mkdir(resolve(screenshotDirectory), { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { height: 900, width } })
      const rulesUrl = `${browserBaseUrl}/event/${eventId}/rules`
      await page.goto(rulesUrl, { waitUntil: 'domcontentloaded' })
      await page.locator('#event-rules-page-title').waitFor({ timeout: 120000 })
      assert.equal(await page.locator('#event-rules-page-title').innerText(), 'Lobo’s American Top 40 Rules')
      assert.equal(await page.locator('.rules-card').count(), 8)
      assert.equal(await page.locator('.rules-toc a').count(), 8)
      assert.equal(await page.locator('.snapshot-event-overview').count(), 0)
      assert.equal(
        await page.getByRole('navigation', { name: 'Event navigation' }).getByRole('link', { name: 'Rules' }).getAttribute('href'),
        `/event/${eventId}/rules`,
      )
      for (const id of sectionIds) {
        assert.equal(await page.locator(`.rules-toc a[href="#${id}"]`).count(), 1)
        assert.equal(await page.locator(`#${id}`).count(), 1)
      }
      const image = page.locator('.top40-rules-hero img')
      await image.waitFor()
      assert.equal(await image.evaluate((node) => node.complete && node.naturalWidth > 0), true)
      assert.equal(await image.evaluate((node) => getComputedStyle(node).objectFit), 'contain')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true)
      const layout = await page.locator('.rules-layout').evaluate((node) => {
        const bounds = node.getBoundingClientRect()
        const toc = node.querySelector('.rules-toc')?.getBoundingClientRect()
        const document = node.querySelector('.rules-document')?.getBoundingClientRect()
        return {
          documentTop: document?.top ?? 0,
          left: bounds.left,
          right: bounds.right,
          tocBottom: toc?.bottom ?? 0,
          viewportWidth: window.innerWidth,
        }
      })
      assert.ok(layout.left >= 0 && layout.right <= layout.viewportWidth)
      if (width === 390) assert.ok(layout.documentTop >= layout.tocBottom, 'mobile rules columns must stack')
      if (screenshotDirectory) {
        await page.screenshot({
          fullPage: true,
          path: resolve(screenshotDirectory, `top-40-rules-${width}.png`),
        })
      }
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.locator('#event-rules-page-title').waitFor({ timeout: 120000 })
      assert.equal(page.url(), rulesUrl)
      await page.close()
    }

    for (const [referenceUrl, referenceSelector] of [
      ['/rules?eventId=event-current-league', '.current-league-rules-page'],
      ['/rules?eventId=event-august-2026-team-tournament', '.team-tournament-rules-page'],
    ]) {
      const reference = await browser.newPage({ viewport: { height: 900, width: 1280 } })
      await reference.goto(`${browserBaseUrl}${referenceUrl}`, { waitUntil: 'domcontentloaded' })
      await reference.locator(referenceSelector).waitFor({ timeout: 120000 })
      assert.equal(await reference.locator('.top40-rules-hero').count(), 0)
      await reference.close()
    }
  } finally {
    await browser.close()
  }
}

console.log('Top 40 event-specific Rules regression passed.')
