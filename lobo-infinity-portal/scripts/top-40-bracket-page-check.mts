import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { TOP_40_PLACEHOLDER_BRACKET } from '../src/content/top40BracketPlaceholder.ts'

const [page, styles, data, eventHome, publicApp, artwork] = await Promise.all([
  readFile(new URL('../src/components/Top40BracketPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/Top40BracketPage.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/top40BracketPlaceholder.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/EventHome.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/public/SnapshotPublicApp.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/events/top-40-bracket.png', import.meta.url)),
])

assert.equal(createHash('sha256').update(artwork).digest('hex').toUpperCase(), '8F1FEA99EC6AED275B634571E64AB5A1159C0316F7217EEC6FF36C8E34921F5D')
assert.match(page, /src="\/assets\/events\/top-40-bracket\.png"/)
assert.match(page, /height="941"/)
assert.match(page, /width="1672"/)
assert.match(styles, /\.top40-bracket-hero img[\s\S]*width: 100%;[\s\S]*height: auto;[\s\S]*object-fit: contain;/)
assert.match(styles, /\.top40-bracket-scroll[\s\S]*overflow-x: auto;/)
assert.match(eventHome, /isTop40 && selectedSection === 'bracket'[\s\S]*return <Top40BracketPage \/>/)
assert.match(publicApp, /path="\/event\/event-lobo-s-american-top-40\/bracket" element=\{<Top40BracketPage \/>\}/)
assert.doesNotMatch(page, /No Data Yet|Bracket has not been generated|score|winner:/i)

const matches = TOP_40_PLACEHOLDER_BRACKET.flatMap((section) =>
  section.rounds.flatMap((round) => round.matches),
)
const initialSeeds = matches.flatMap((bracketMatch) =>
  bracketMatch.slots.filter((entry) => entry.initialEntry).map((entry) => entry.label),
)
assert.deepEqual(initialSeeds.slice().sort((a, b) => Number(a.slice(5)) - Number(b.slice(5))), Array.from({ length: 40 }, (_, index) => `Seed ${index + 1}`))
assert.equal(new Set(matches.map((bracketMatch) => bracketMatch.id)).size, matches.length, 'Match IDs must be unique.')
assert.equal(TOP_40_PLACEHOLDER_BRACKET.find((section) => section.id === 'winners')?.rounds[0].matches.length, 8)
assert.equal(TOP_40_PLACEHOLDER_BRACKET.find((section) => section.id === 'winners')?.rounds[1].matches.length, 16)
assert.equal(TOP_40_PLACEHOLDER_BRACKET.find((section) => section.id === 'winners')?.rounds.flatMap((round) => round.matches).length, 39)
assert.equal(TOP_40_PLACEHOLDER_BRACKET.find((section) => section.id === 'losers')?.rounds.flatMap((round) => round.matches).length, 38)
assert.equal(TOP_40_PLACEHOLDER_BRACKET.find((section) => section.id === 'grand-final')?.rounds.flatMap((round) => round.matches).length, 1)

const roundTitles = TOP_40_PLACEHOLDER_BRACKET.flatMap((section) => section.rounds.map((round) => round.title))
for (const expected of [
  'Opening Play-In',
  'Round of 32',
  'Round of 16',
  'Quarterfinals',
  'Semifinals',
  'Winners Final',
  'Losers Round 1',
  'Losers Final',
  'Grand Final',
]) assert.ok(roundTitles.includes(expected), `Missing bracket stage: ${expected}`)

assert.match(page, /eliminated after their second loss/)
assert.match(data, /Replace this value with the hourly snapshot[\s\S]*projection/)

console.log('Top 40 bracket page checks passed')
