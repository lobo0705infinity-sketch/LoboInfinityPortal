import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/pages/EventHome.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/pages/EventHome.css', import.meta.url), 'utf8')
const navigation = await readFile(new URL('../src/config/eventNavigation.ts', import.meta.url), 'utf8')

assert.match(source, /data\.event\.id === 'event-lobo-s-american-top-40'/)
assert.match(source, /return <Top40Rules \/>/)

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

assert.match(source, /function EventRules[\s\S]*if \(data\.event\.id === 'event-lobo-s-american-top-40'\)[\s\S]*<section className="panel event-home-panel" id="rules">/)
assert.match(styles, /\.top40-rules-grid[\s\S]*grid-template-columns: repeat\(2/)
assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.top40-rules-grid[\s\S]*grid-template-columns: 1fr/)

const top40IdIndex = navigation.indexOf("id: 'event-lobo-s-american-top-40'")
const blockStart = navigation.lastIndexOf('capabilities: [', top40IdIndex)
const blockEnd = navigation.indexOf("type: 'Individual Double Elimination'", top40IdIndex)
const block = navigation.slice(blockStart, blockEnd)
assert.match(block, /'overview',[\s\S]*'registration',[\s\S]*'bracket',[\s\S]*'players',[\s\S]*'results',[\s\S]*'statistics',[\s\S]*'rules'/)
assert.doesNotMatch(block, /'teams'|'standings'|'schedule'|'pairings'/)
assert.doesNotMatch(source, /Generate Bracket/)

console.log('Top 40 event-specific Rules regression passed.')
