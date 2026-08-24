import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8')
const styles = readFileSync('src/pages/Dashboard.css', 'utf8')
const appStyles = readFileSync('src/App.css', 'utf8')

assert.doesNotMatch(dashboard, /Commander Overview|CommanderOverview|dashboard-commander/)
assert.doesNotMatch(styles, /dashboard-commander/)
assert.doesNotMatch(dashboard, /PrimaryFactionCard/)

for (const label of [
  'Live Transmissions',
  "This Week's Operations",
  'Community Intelligence',
  'Season Status',
  'Season Progress',
  'Recent Reports',
  'Streamed Reports',
  'Your Rank',
  'Your Division',
  'Join the Lobo Infinity League Discord',
]) {
  assert.ok(dashboard.includes(label), `Dashboard must preserve ${label}`)
}

assert.match(
  styles,
  /\.dashboard-ops-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.12fr\) minmax\(0, 1\.03fr\) minmax\(0, 0\.88fr\);/,
  'Desktop Dashboard operations must use three intentional columns.',
)
assert.match(
  styles,
  /\.dashboard-community-card\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/,
  'Lower Discord card must span the reflowed operations grid without an empty slot.',
)
assert.match(styles, /@media \(max-width: 1280px\)[\s\S]*?\.dashboard-ops-grid\s*\{\s*grid-template-columns:\s*1fr 1fr;/)
assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.dashboard-ops-grid,[\s\S]*?grid-template-columns:\s*1fr;/)

assert.match(appStyles, /@media \(max-width:\s*920px\)/)
assert.match(appStyles, /\.app-shell\s*\{[\s\S]*?grid-template-columns:\s*300px minmax\(0, 1fr\);/)
assert.doesNotMatch(styles, /overflow-x:\s*hidden/)

console.log('dashboard Commander Overview removal checks passed')
