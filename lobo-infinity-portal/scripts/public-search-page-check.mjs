import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describePublicSearchPage, publicDatasetForPath } from '../shared/public-search-content.mjs'
import { renderPublicSearchHtml } from '../api/public-search-page.mjs'
import { selectFeaturedReport } from '../shared/featured-report.mjs'

const template = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const homepage = describePublicSearchPage('/')
const army = describePublicSearchPage('/army-intelligence')
assert.notEqual(homepage.title, army.title)
assert.match(army.intro, /Corregidor/)
assert.ok(homepage.links.some(link => link.href === '/games'))
assert.ok(!homepage.links.some(link => link.href === '/games/109'))
assert.ok(army.links.some(link => link.href === '/games/109'))
assert.equal(publicDatasetForPath('/'), 'games')
assert.equal(publicDatasetForPath('/games/117'), 'games')
assert.equal(publicDatasetForPath('/commissioner'), null)
assert.equal(describePublicSearchPage('/hall-of-fame'), null)
assert.equal(describePublicSearchPage('/rivalries'), null)

const reports = [
  { id: 118, mission: "Dead Man's Switch", player1Faction: 'Corregidor Jurisdictional Command', player2Faction: 'Torchlight Brigade', bestMoment: '' },
  { id: 109, mission: "Dead Man's Switch", player1Faction: 'Corregidor Jurisdictional Command', player2Faction: 'Torchlight Brigade', bestMoment: 'A Raveneye almost turned the game in the final orders.' },
  { id: 117, mission: 'The Dig', player1Faction: 'Operations Subsection', player2Faction: 'Ramah Taskforce', bestMoment: 'Yadu HRL Taking out Tariq on opponents turn 1' },
]
assert.equal(selectFeaturedReport(reports)?.id, 117)
assert.equal(selectFeaturedReport([...reports].reverse())?.id, 117)
assert.equal(selectFeaturedReport(reports, 109)?.id, 109)
assert.equal(selectFeaturedReport(reports, 999)?.id, 117)
assert.equal(selectFeaturedReport(reports.slice(0, 1)), null)
const currentHomepage = describePublicSearchPage('/', { games: reports })
assert.ok(currentHomepage.links.some(link => link.href === '/games/117'))
assert.ok(currentHomepage.links.some(link => link.href === '/missions/The%20Dig'))
assert.ok(currentHomepage.links.some(link => link.href === '/factions/Operations%20Subsection'))
assert.ok(currentHomepage.links.some(link => link.href === '/factions/Ramah%20Taskforce'))
assert.ok(!currentHomepage.links.some(link => link.href === '/games/118'))
assert.match(renderPublicSearchHtml(template, currentHomepage), /href="\/games\/117"/)
const pinnedHomepage = describePublicSearchPage('/', { games: reports, pinnedId: 109 })
assert.ok(pinnedHomepage.links.some(link => link.href === '/games/109'))
assert.ok(!pinnedHomepage.links.some(link => link.href === '/games/117'))

const game = {
  id: 117,
  mission: 'The Dig',
  player1Faction: 'Operations Subsection',
  player2Faction: 'Ramah Taskforce',
  winnerFaction: 'Operations Subsection',
  tp: '5–1',
  bestMoment: '</script><script>alert("oops")</script>',
}
const detail = describePublicSearchPage('/games/117', { games: [game] })
assert.match(detail.title, /The Dig: Operations Subsection vs Ramah Taskforce/)
assert.equal(detail.image, '/api/report-preview?id=117')
assert.ok(detail.links.some(link => link.href === '/missions/The%20Dig'))
assert.ok(detail.links.some(link => link.href === '/factions/Operations%20Subsection'))
assert.ok(detail.links.some(link => link.href === '/factions/Ramah%20Taskforce'))
assert.equal(describePublicSearchPage('/games/118', { games: [game] }), null)
const html = renderPublicSearchHtml(template, detail)
assert.match(html, /<h1[^>]*>The Dig: Operations Subsection vs Ramah Taskforce<\/h1>/)
assert.match(html, /href="\/missions\/The%20Dig"/)
assert.match(html, /<link rel="canonical" href="https:\/\/lobo-infinity-portal\.vercel\.app\/games\/117"/)
assert.match(html, /name="google-site-verification"/)
assert.match(html, /property="og:image" content="https:\/\/lobo-infinity-portal\.vercel\.app\/api\/report-preview\?id=117"/)
assert.match(html, /name="twitter:card" content="summary_large_image"/)
assert.match(html, /property="og:image:alt" content="Battle report #117: Operations Subsection vs Ramah Taskforce on The Dig"/)
assert.match(html, /&lt;\/script&gt;&lt;script&gt;alert/)
assert.doesNotMatch(html, /<script>alert\("oops"\)<\/script>/)
assert.match(html, /"pathname":"\/games\/117"/)

const faction = describePublicSearchPage('/factions/Corregidor%20Jurisdictional%20Command', {
  factions: [{ name: 'Corregidor Jurisdictional Command', games: 12, wins: 8, recentGames: [{ id: 117 }] }],
})
assert.match(faction.description, /12 recorded games, 8 wins/)
assert.match(renderPublicSearchHtml(template, faction), /href="\/games\/117"/)
assert.equal(describePublicSearchPage('/factions/Unknown', { factions: [] }), null)

const event = describePublicSearchPage('/event/event-current-league', {
  events: [{ id: 'event-current-league', name: 'Current League', status: 'Active', completedGames: 87 }],
})
assert.match(event.description, /87 recorded games/)
assert.match(describePublicSearchPage('/events', { events: [{ id: 'event-current-league', name: 'Current League', status: 'Active' }] }).links.at(-1).href, /event-current-league/)

console.log('Public search pages expose distinct metadata, useful content, safe text, and canonical links.')
