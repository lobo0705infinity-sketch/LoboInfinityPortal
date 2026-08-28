import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync('src/components/EventManagerPanel.tsx', 'utf8')
const api = readFileSync('src/services/api.ts', 'utf8')
const backend = readFileSync('backend/EventManagerApi.gs', 'utf8')
const router = readFileSync('backend/API.gs', 'utf8')

assert.match(panel, /<form className="event-manager-form" onSubmit={saveSelectedEvent}>/)
assert.match(panel, /<strong>Create New Event<\/strong>/)
assert.match(panel, /function startCreateEvent\(\)[\s\S]*?setSelectedEventId\(''\)[\s\S]*?setIsCreatingEvent\(true\)/)
assert.match(panel, /if \(isCreatingEvent\) \{[\s\S]*?await createEvent\(\)[\s\S]*?return/)
assert.match(panel, /eventRepository\.saveEvent\(\{[\s\S]*?\.\.\.eventForm,[\s\S]*?lifecycleStage: 'Planning',[\s\S]*?status: 'Planning'/)
assert.match(panel, /registration: 'Registration Closed'/)
assert.match(panel, /rules: ''/)
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
const createHandler = eventHandlers.slice(eventHandlers.indexOf('async function createEvent'))
assert.doesNotMatch(createHandler, /eventId:/)
assert.match(eventHandlers, /eventId: selectedEventId/)

assert.match(api, /postRequest\('eventManagerEvent', options, params\)/)
assert.match(router, /case "eventManagerEvent":[\s\S]*?return saveEventManagerEvent\(e\)/)
assert.match(backend, /requireApiPermission\(e, "runSeasonControl"/)
assert.match(backend, /buildEventManagerEventId\(params\.name, params\.type\)/)
assert.match(backend, /existing \? existing\.startDate : ""/)
assert.match(backend, /existing \? existing\.endDate : ""/)
assert.match(backend, /ensureEventManagerEventDefaults\(eventId, eventName, eventType\)/)
assert.match(backend, /return buildEventManagerResponse\(eventId\)/)
assert.doesNotMatch(panel, /SpreadsheetApp|eventManagerEvent/)

console.log('PASS: Event Manager Save Event explicitly creates new drafts, updates existing events, and provides visible success or failure feedback.')
