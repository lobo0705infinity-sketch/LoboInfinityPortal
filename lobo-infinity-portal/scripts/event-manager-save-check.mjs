import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync('src/components/EventManagerPanel.tsx', 'utf8')
const api = readFileSync('src/services/api.ts', 'utf8')
const backend = readFileSync('backend/EventManagerApi.gs', 'utf8')
const router = readFileSync('backend/API.gs', 'utf8')

assert.match(panel, /<form className="event-manager-form" onSubmit={saveSelectedEvent}>/)
assert.match(panel, /<form className="event-manager-form" onSubmit={createEvent}>/)
assert.match(panel, /eventRepository\.saveEvent\(\{[\s\S]*?\.\.\.newEventForm,[\s\S]*?lifecycleStage: 'Planning',[\s\S]*?status: 'Planning'/)
assert.match(panel, />Individual Double Elimination<\/option>/)
assert.match(panel, /setActionError\([\s\S]*?error instanceof Error[\s\S]*?error\.message/)
assert.match(panel, /setActionMessage\(successMessage\)/)
assert.match(panel, /'Event saved\.'/)
assert.match(panel, /'Event created\.'/)

const actionWrapper = panel.slice(
  panel.indexOf('async function runManagerAction'),
  panel.indexOf('async function setRegistration'),
)
assert.match(actionWrapper, /throw error/)
assert.match(actionWrapper, /applyManagerData\(data\)/)

const eventHandlers = panel.slice(
  panel.indexOf('async function saveSelectedEvent'),
  panel.indexOf('async function saveLeagueOperations'),
)
assert.equal(eventHandlers.match(/runManagerAction\(/g)?.length, 2)
assert.equal(eventHandlers.match(/runManagerAction has already rendered the safe backend error/g)?.length, 2)

assert.match(api, /postRequest\('eventManagerEvent', options, params\)/)
assert.match(router, /case "eventManagerEvent":[\s\S]*?return saveEventManagerEvent\(e\)/)
assert.match(backend, /requireApiPermission\(e, "runSeasonControl"/)
assert.match(backend, /buildEventManagerEventId\(params\.name, params\.type\)/)
assert.match(backend, /existing \? existing\.startDate : ""/)
assert.match(backend, /existing \? existing\.endDate : ""/)
assert.match(backend, /ensureEventManagerEventDefaults\(eventId, eventName, eventType\)/)
assert.match(backend, /return buildEventManagerResponse\(eventId\)/)
assert.doesNotMatch(panel, /SpreadsheetApp|eventManagerEvent/)

console.log('PASS: Event Manager saves use the existing authorized mutation and provide visible success or failure feedback.')
