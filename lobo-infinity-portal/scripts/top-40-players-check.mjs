import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const playersSource = await readFile(new URL('../src/pages/Players.tsx', import.meta.url), 'utf8')
const eventHomeSource = await readFile(new URL('../src/pages/EventHome.tsx', import.meta.url), 'utf8')

assert.match(playersSource, /getEventRegistration\(eventId/)
assert.match(playersSource, /eventType === 'Individual Double Elimination'/)
assert.match(playersSource, /eventScoped && !individualTournament/)
assert.match(playersSource, /divisionLabel=\{individualTournament \? undefined : player\.divisionLabel\}/)
assert.match(playersSource, /No players are registered for this event\./)
assert.match(playersSource, /className="division-tabs"/)
assert.match(playersSource, /getDivisionIdentity/)

assert.match(eventHomeSource, /data\.event\.type === 'Individual Double Elimination'/)
assert.match(eventHomeSource, /individualTournament \? null : \(/)
assert.match(eventHomeSource, /label="Team"/)
assert.match(eventHomeSource, /label="Captain"/)
assert.match(eventHomeSource, /label="Next Match"/)
assert.match(eventHomeSource, /registeredCount\} \/ \$\{data\.registration\.capacity\.maximumPlayers/)
assert.match(eventHomeSource, />\s*Player\s*</)
assert.match(eventHomeSource, /Corvus Belli ITS Name/)
assert.match(eventHomeSource, />\s*Faction\s*</)

const browserBaseUrl = process.env.TOP40_PRESENTATION_BASE_URL?.replace(/\/$/, '')

if (browserBaseUrl) {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { height: 900, width: 1280 } })

    await page.goto(`${browserBaseUrl}/players?eventId=event-lobo-s-american-top-40`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('#players-title').waitFor({ timeout: 120000 })
    await page.locator('[aria-label="Portal players"], [aria-label="No event participants"]').first().waitFor({ timeout: 120000 })
    const playersMain = await page.locator('main').innerText()
    assert.doesNotMatch(playersMain, /Main Man|Proving Grounds/)
    assert.equal(await page.locator('main .division-tabs').count(), 0)

    await page.goto(`${browserBaseUrl}/event/event-lobo-s-american-top-40/registration`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('#event-registration-title').waitFor({ timeout: 120000 })
    const registrationMain = await page.locator('main').innerText()
    assert.match(registrationMain, /YOUR STATUS/i)
    assert.doesNotMatch(registrationMain, /^TEAM$|^CAPTAIN$|Pending Pairings|Preferred Team|Free Agent/im)
    assert.match(registrationMain, /REGISTERED PLAYERS\s+\d+ \/ 40/i)
    assert.match(registrationMain, /Corvus Belli ITS Name/)
    assert.match(registrationMain, /^Player$|^Faction$/im)
  } finally {
    await browser.close()
  }
}

console.log('Top 40 individual-player presentation regression passed.')
