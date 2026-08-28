import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getDoubleEliminationBracketReadiness } from '../src/services/bracketReadiness.ts'

const individualType = 'Individual Double Elimination'
const registered = (seed: string) => ({ seed, status: 'Registered' })
const inactive = (seed: string) => ({ seed, status: 'Removed' })
const readiness = (
  count: number,
  options: { capacity?: number; open?: boolean; seeds?: string[] } = {},
) => getDoubleEliminationBracketReadiness({
  capacity: options.capacity ?? 40,
  eventType: individualType,
  participants: (options.seeds ?? Array.from({ length: count }, (_, index) => String(index + 1)))
    .map(registered),
  registrationStatus: options.open ? 'Registration Open' : 'Registration Closed',
})

assert.equal(readiness(0).ready, false)
assert.match(readiness(0).reasons.join(' '), /At least 2 registered players/)
assert.equal(readiness(1).ready, false)
assert.equal(readiness(2).ready, true)
assert.equal(readiness(2, { open: true }).ready, false)
assert.match(readiness(2, { open: true }).reasons.join(' '), /Close registration/)
assert.equal(readiness(17).ready, true)
assert.equal(readiness(37).ready, true)
assert.equal(readiness(40).ready, true)
assert.equal(readiness(41).ready, false)
assert.match(readiness(41).reasons.join(' '), /exceed the configured capacity/)
assert.equal(readiness(3, { seeds: ['1', '', '3'] }).ready, false)
assert.match(readiness(3, { seeds: ['1', '', '3'] }).reasons.join(' '), /Every registered player must have a seed/)
assert.equal(readiness(3, { seeds: ['1', '1', '3'] }).ready, false)
assert.equal(readiness(3, { seeds: ['1', '2', '4'] }).ready, false)
assert.equal(readiness(3, { seeds: ['1', '2', '0'] }).ready, false)
assert.equal(readiness(3, { seeds: ['1', '2', '2.5'] }).ready, false)

const registeredOnly = getDoubleEliminationBracketReadiness({
  capacity: 40,
  eventType: individualType,
  participants: [registered('1'), registered('2'), inactive('')],
  registrationStatus: 'Registration Closed',
})
assert.equal(registeredOnly.registeredCount, 2)
assert.equal(registeredOnly.ready, true)

const wrongType = getDoubleEliminationBracketReadiness({
  capacity: 40,
  eventType: 'League',
  participants: [registered('1'), registered('2')],
  registrationStatus: 'Registration Closed',
})
assert.equal(wrongType.ready, false)
assert.match(wrongType.reasons.join(' '), /only available for Individual Double Elimination/)

const eventHomeSource = fs.readFileSync('src/pages/EventHome.tsx', 'utf8')
const managerSource = fs.readFileSync('src/components/EventManagerPanel.tsx', 'utf8')
const helperSource = fs.readFileSync('src/services/bracketReadiness.ts', 'utf8')
const seedingSource = fs.readFileSync('backend/EventManagerApi.gs', 'utf8')

assert.match(eventHomeSource, /Bracket has not been generated\./)
assert.match(eventHomeSource, /Registered Players/)
assert.match(eventHomeSource, /Seeded Players/)
assert.doesNotMatch(eventHomeSource.slice(eventHomeSource.indexOf('function EventBracketPage'), eventHomeSource.indexOf('function EventRulesPage')), /Generate Bracket/)
assert.match(managerSource, /<h3>Bracket Generation<\/h3>/)
assert.match(managerSource, />\s*Generate Bracket\s*<\/button>/)
assert.match(managerSource, /disabled=\{!readiness\.ready\}/)
assert.match(managerSource, /Generator implementation is the next step\./)

const generationPanel = managerSource.slice(
  managerSource.indexOf('function BracketGenerationPanel'),
  managerSource.indexOf('function TournamentSeedingPanel'),
)
assert.doesNotMatch(generationPanel, /eventRepository|fetch\(|saveParticipant|setRegistration|setLifecycle/)
assert.doesNotMatch(helperSource, /fetch\(|repository|localStorage|sessionStorage/)
assert.match(helperSource, /participant\.status === 'Registered'/)
assert.match(helperSource, /seed === index \+ 1/)
assert.match(seedingSource, /function saveEventManagerSeeding_/)

for (const forbidden of ['Winners Bracket', 'Losers Bracket', 'Grand Final', 'Match ID']) {
  assert.doesNotMatch(generationPanel, new RegExp(forbidden))
}

console.log('Top 40 bracket readiness regression passed.')
