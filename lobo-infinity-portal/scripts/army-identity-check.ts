import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import {
  getArmiesForParent,
  getArmyParentFaction,
  getCanonicalArmyName,
  getCanonicalArmyOptions,
  getCanonicalParentFactionOptions,
  normalizeArmyForDisplay,
  resolveArmyIdentity,
} from '../src/services/armyIdentity.ts'

const sourceFiles = {
  armyIdentity: read('src/services/armyIdentity.ts'),
  armies: read('src/config/armies.ts'),
  armyIntelligence: read('src/pages/ArmyIntelligence.tsx'),
  armyLists: read('src/pages/ArmyLists.tsx'),
  dashboard: read('src/pages/Dashboard.tsx'),
  factionPortraits: read('src/config/factionPortraits.ts'),
  myProfile: read('src/pages/MyProfile.tsx'),
  playerFactionIdentity: read('src/services/playerFactionIdentity.ts'),
  playerProfile: read('src/pages/PlayerProfile.tsx'),
  primaryFactionCard: read('src/components/PrimaryFactionCard.tsx'),
  submitArmyList: read('src/pages/SubmitArmyList.tsx'),
  submitResult: read('src/pages/SubmitResult.tsx'),
  teamTournament: read('src/pages/TeamTournament.tsx'),
}

for (const entry of CANONICAL_ARMY_REGISTRY) {
  const identity = resolveArmyIdentity(entry.id)

  assert.ok(identity, `${entry.id} must resolve`)
  assert.equal(identity.id, entry.id, `${entry.id} resolves to its canonical id`)
  assert.equal(identity.displayName, entry.name, `${entry.id} resolves to its canonical display name`)
  assert.equal(identity.parentFactionName, entry.parentFaction, `${entry.id} resolves to its canonical parent faction`)
  assert.equal(identity.registryEntry, entry, `${entry.id} returns the canonical registry entry`)
  assert.equal(resolveArmyIdentity(entry.name)?.id, entry.id, `${entry.name} display name resolves`)

  for (const alias of entry.aliases || []) {
    assert.equal(resolveArmyIdentity(alias)?.id, entry.id, `${alias} alias resolves to ${entry.id}`)
  }
}

const aliasExamples = [
  ['Operations Subsection', 'operations-subsection'],
  ['operations-subsection', 'operations-subsection'],
  ['OSS', 'operations-subsection'],
  ['Shasvastii', 'shasvastii-expeditionary-force'],
  ['shasvastii', 'shasvastii-expeditionary-force'],
  ['Force De Reponse Rapide Merovingienne', 'force-de-reponse-rapide-merovingienne'],
  ['force-de-reponse-rapide-merovingienne', 'force-de-reponse-rapide-merovingienne'],
  ['FRRM', 'force-de-reponse-rapide-merovingienne'],
  ['Starco Free Company Of The Star', 'starco'],
  ['starco-free-company-of-the-star', 'starco'],
  ['Tunguska', 'tunguska-jurisdictional-command'],
  ['tunguska', 'tunguska-jurisdictional-command'],
  ['Operations Subsection (9 games)', 'operations-subsection'],
] as const

for (const [value, expectedId] of aliasExamples) {
  assert.equal(resolveArmyIdentity(value)?.id, expectedId, `${value} resolves to ${expectedId}`)
}

assert.equal(getCanonicalArmyName('OSS'), 'Operations Subsection')
assert.equal(normalizeArmyForDisplay('operations-subsection'), 'Operations Subsection')
assert.equal(getArmyParentFaction('OSS'), 'ALEPH')
assert.ok(getCanonicalArmyOptions().includes('Operations Subsection'))
assert.ok(getCanonicalParentFactionOptions().includes('ALEPH'))
assert.deepEqual(getArmiesForParent('aleph'), ['ALEPH', 'Operations Subsection', 'Steel Phalanx'])

const displayNames = getCanonicalArmyOptions()
const displayNameKeys = displayNames.map((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
assert.equal(new Set(displayNameKeys).size, displayNameKeys.length, 'Canonical army options must not duplicate display names.')

assert.doesNotMatch(sourceFiles.armies, /armyNameByKey|armyAliasEntries|normalizeArmyKey|getCanonicalArmyName|getArmyParentFaction|normalizeArmyForDisplay/)
assert.match(sourceFiles.armyIdentity, /export function resolveArmyIdentity/)
assert.match(sourceFiles.armyIdentity, /registryEntry\.aliases/)
assert.match(sourceFiles.armyIdentity, /normalizeArmyIdentityKey/)

for (const [name, source] of Object.entries(sourceFiles)) {
  if (name === 'armies' || name === 'armyIdentity') {
    continue
  }

  assert.doesNotMatch(
    source,
    /import\s*\{[^}]*\b(?:getCanonicalArmyName|getArmyParentFaction|normalizeArmyForDisplay|getCanonicalArmyOptions|getCanonicalParentFactionOptions|getArmiesForParent|normalizeArmyKey|resolveArmyIdentity)\b[^}]*\}\s*from ['"](?:\.\.\/config\/armies|\.\/armies)(?:\.ts)?['"]/,
    `${name} must not import army normalization helpers from the registry module.`,
  )
}

assert.match(sourceFiles.primaryFactionCard, /resolveArmyIdentity/)
assert.match(sourceFiles.armyIntelligence, /from '..\/services\/armyIdentity'/)
assert.match(sourceFiles.playerFactionIdentity, /resolveArmyIdentity/)
assert.match(sourceFiles.submitArmyList, /from '..\/services\/armyIdentity'/)
assert.match(sourceFiles.teamTournament, /from '..\/services\/armyIdentity'/)
assert.match(sourceFiles.submitResult, /from '..\/services\/armyIdentity'/)

console.log('Army Identity checks passed.')

function read(path: string) {
  return readFileSync(path, 'utf8')
}
