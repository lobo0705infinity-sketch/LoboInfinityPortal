import { readFileSync } from 'node:fs'

const rules = readFileSync('firestore.rules', 'utf8')

const requiredCollections = [
  'events',
  'players',
  'games',
  'registrations',
  'teams',
  'pairings',
  'notifications',
  'missions',
  'factions',
  'analytics',
  'settings',
]

const requiredSnippets = [
  "rules_version = '2'",
  "role() == 'Commissioner'",
  "'Assistant Commissioner'",
  "settings/schema",
  "settings/bootstrapProbe",
  'migrationSource',
  'v7.3.2',
]

const failures = []

for (const collection of requiredCollections) {
  if (!rules.includes(`/${collection}/`) && !rules.includes(`/${collection}{`)) {
    failures.push(`Missing collection rule for ${collection}.`)
  }
}

for (const snippet of requiredSnippets) {
  if (!rules.includes(snippet)) {
    failures.push(`Missing required rule snippet: ${snippet}`)
  }
}

if (/allow\s+read,\s*write:\s*if\s+true/.test(rules)) {
  failures.push('Rules contain broad allow read/write true.')
}

if (/match\s+\/\{document=\*\*\}[\s\S]*allow\s+read,\s*write:\s*if\s+true/.test(rules)) {
  failures.push('Catch-all rule grants public access.')
}

if (!/match\s+\/\{document=\*\*\}[\s\S]*allow\s+read,\s*write:\s*if\s+false/.test(rules)) {
  failures.push('Missing final deny-all catch-all rule.')
}

if (/allow\s+(create|update|delete|write):\s*if\s+true/.test(rules)) {
  failures.push('Rules contain an unconditional public write.')
}

if (failures.length > 0) {
  console.error('Firestore rules check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Firestore rules check passed.')
