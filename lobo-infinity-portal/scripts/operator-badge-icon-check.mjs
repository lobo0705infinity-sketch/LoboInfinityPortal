import { readFileSync } from 'node:fs'

const registry = readFileSync('src/assets/operator-badges/factions/index.ts', 'utf8')
const gameDetails = readFileSync('src/pages/GameDetails.tsx', 'utf8')
const armyLists = readFileSync('src/pages/ArmyLists.tsx', 'utf8')

const failures = []

function expect(condition, message) {
  if (!condition) failures.push(message)
}

const requiredAliases = [
  'Force de Réponse Rapide Merovingienne',
  'Force de Reponse Rapide Merovingienne',
  'FRRM',
  'frrm',
  'Merovingienne',
  'MRRF',
  'mrrf',
]

expect(/import Frrm from "\.\/frrm\.svg";/.test(registry), 'FRRM SVG asset must be imported.')
expect(/"Force de Réponse Rapide Merovingienne": Frrm/.test(registry), 'Canonical FRRM icon mapping is missing.')

for (const alias of requiredAliases.slice(1)) {
  expect(
    registry.includes(`"${alias}": "Force de Réponse Rapide Merovingienne"`),
    `FRRM alias is missing from operator badge registry: ${alias}`,
  )
}

expect(/normalize\("NFD"\)/.test(registry), 'Operator badge lookup must normalize accented faction names.')
expect(/factionIcons\[preferredFaction\]/.test(registry), 'Exact existing faction icon lookups must remain first.')
expect(/return factionIconsByKey\.get\(aliasKey \|\| key\) \?\? LoboDefault/.test(registry), 'Unknown factions must still use LoboDefault.')
expect(/"Steel Phalanx": SteelPhalanx/.test(registry), 'Existing Steel Phalanx mapping changed or disappeared.')
expect(/"Imperial Service": ImperialService/.test(registry), 'Existing Imperial Service mapping changed or disappeared.')
expect(!/<OperatorBadge/.test(gameDetails), 'Game Details must not render Operator Badge hover overlays.')
expect(/preferredFaction=\{displayFaction\}/.test(armyLists), 'Army List Library badges must receive display faction values.')

if (failures.length) {
  console.error('Operator badge icon check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Operator badge icon check passed.')
