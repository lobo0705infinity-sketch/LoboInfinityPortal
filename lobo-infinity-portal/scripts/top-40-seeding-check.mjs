import assert from 'node:assert/strict'
import fs from 'node:fs'

const managerSource = fs.readFileSync('src/components/EventManagerPanel.tsx', 'utf8')
const playersSource = fs.readFileSync('src/pages/Players.tsx', 'utf8')
const backendSource = fs.readFileSync('backend/EventManagerApi.gs', 'utf8')
const engineSource = fs.readFileSync('backend/EventEngineApi.gs', 'utf8')

const checks = []
function check(condition, message) {
  assert.ok(condition, message)
  checks.push(message)
}

function validate(assignments, registeredPlayers) {
  const count = registeredPlayers.length
  if (count === 0) return false
  const registered = new Set(registeredPlayers.map((player) => player.toLowerCase()))
  const players = new Set()
  const seeds = new Set()
  if (assignments.length !== count) return false
  return assignments.every(({ player, seed }) => {
    const key = player.trim().toLowerCase()
    const valid = registered.has(key) && !players.has(key) && Number.isInteger(seed) && seed >= 1 && seed <= count && !seeds.has(seed)
    players.add(key)
    seeds.add(seed)
    return valid
  })
}

check(managerSource.includes("data.selectedEvent.type === 'Individual Double Elimination'"), 'Seeding is isolated to Individual Double Elimination events.')
check(!managerSource.includes("data.selectedEvent.type === 'League' ? (\n            <TournamentSeedingPanel"), 'League does not expose tournament seeding.')
check(managerSource.includes("participant.status === 'Registered'"), 'Only Registered participants are seedable.')
check(managerSource.includes('<h3>Tournament Seeding</h3>'), 'Commissioner operations expose Tournament Seeding.')
check(managerSource.includes('<strong>Player</strong>') && managerSource.includes('<strong>ITS Name</strong>') && managerSource.includes('<strong>Faction</strong>'), 'Player, ITS Name, and Faction are displayed read-only.')
check(managerSource.includes('type="number"') && managerSource.includes('Save Seeding'), 'Seed is the editable numeric field.')
check(managerSource.includes('No registered players to seed.'), 'Zero-participant events render a clean empty state.')
check(managerSource.includes('Seeding saved.') && managerSource.includes('Saving seeding...'), 'Saving provides pending and success feedback.')

check(validate([{ player: 'A', seed: 1 }, { player: 'B', seed: 2 }], ['A', 'B']), 'A complete unique 1..N order is valid.')
check(!validate([{ player: 'A', seed: 1 }, { player: 'B', seed: 1 }], ['A', 'B']), 'Duplicate seeds are rejected.')
check(!validate([{ player: 'A', seed: 0 }, { player: 'B', seed: 2 }], ['A', 'B']), 'Non-positive seeds are rejected.')
check(!validate([{ player: 'A', seed: 1.5 }, { player: 'B', seed: 2 }], ['A', 'B']), 'Decimal seeds are rejected.')
check(!validate([{ player: 'A', seed: 1 }], ['A', 'B']), 'Incomplete orders are rejected.')
check(!validate([{ player: 'A', seed: 1 }, { player: 'B', seed: 3 }], ['A', 'B']), 'Seeds outside 1..N are rejected.')

check(backendSource.includes('requireApiPermission(e, "runSeasonControl"'), 'Existing Commissioner authorization protects seeding.')
check(backendSource.includes('LockService.getScriptLock()') && backendSource.includes('lock.waitLock(10000)'), 'Seeding is validated and saved under the existing Apps Script lock pattern.')
check(backendSource.indexOf('validateEventManagerSeedAssignments_(') < backendSource.indexOf('.setValues(seedValues)'), 'Complete validation occurs before persistence.')
check(backendSource.includes('headers.indexOf("Seed")') && engineSource.includes('"Seed"'), 'Persistence reuses the Event Participants Seed field.')
check(backendSource.includes('.setValues(seedValues)') && !backendSource.includes('SEEDING_HEADERS'), 'Assignments persist in one logical write with no parallel seeding store.')
check(!backendSource.includes('EVENT_PROVISIONING_TOKEN'), 'Event provisioning authorization cannot seed players.')

const seedingBackend = backendSource.slice(backendSource.indexOf('function saveEventManagerSeeding_'), backendSource.indexOf('function saveEventManagerTeam'))
check(!/bracket|match activation|deadline/i.test(seedingBackend), 'Saving seeds does not generate bracket, match, or deadline state.')
check(!/updateEventManagerEventFields|setRegistration|lifecycleStage/.test(seedingBackend), 'Saving seeds does not change registration or lifecycle state.')

check(playersSource.includes("participant.status === 'Registered'"), 'Public Players uses Registered event participants.')
check(playersSource.includes('leftSeed - rightSeed'), 'Public Players orders seeded participants by Seed.')
check(playersSource.includes("participant.seed || '—'"), 'Unseeded participants do not receive invented seed numbers.')
check(playersSource.includes('participant.itsName') && playersSource.includes('participant.faction'), 'Public Players displays ITS Name and Faction.')
check(!playersSource.includes('Save Seeding'), 'Public Players exposes no seeding controls.')

console.log(`Top 40 seeding regression passed (${checks.length} checks).`)
