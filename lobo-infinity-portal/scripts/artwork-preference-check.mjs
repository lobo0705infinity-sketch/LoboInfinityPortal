import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const preferences = new Map()
const originalWindow = globalThis.window
try {
  globalThis.window = { localStorage: { getItem: key => preferences.get(key) ?? null } }
  const { default: Artwork } = await server.ssrLoadModule('/src/components/CompactArtwork.tsx')
  const render = path => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(Artwork, { title: 'Artwork', src: '/original.png' })))
  assert.match(render('/players/Lobo'), /Reduce artwork/)
  assert.match(render('/players/Lobo'), /aria-expanded="true"/)
  preferences.set('lobo:artwork:v1:/players/Lobo', 'reduced')
  assert.match(render('/players/Lobo'), /Show full artwork/)
  assert.match(render('/players/Lobo'), /aria-expanded="false"/)
  assert.match(render('/players/Chainsaw'), /Reduce artwork/, 'Each player page has its own preference')
  preferences.set('lobo:artwork:v1:/event/event-current-league/standings', 'reduced')
  assert.match(render('/standings?eventId=event-current-league'), /Show full artwork/)
  assert.match(render('/event/event-current-league/standings'), /Show full artwork/, 'Standings aliases share the preference')
  assert.match(render('/event/event-current-league/schedule'), /Reduce artwork/, 'Reducing standings does not reduce schedule')
  preferences.set('lobo:artwork:v1:/players/Lobo', 'full')
  assert.match(render('/players/Lobo'), /Reduce artwork/, 'Restoring full artwork is remembered')
  globalThis.window = { localStorage: { getItem() { throw new Error('Storage denied') } } }
  assert.match(render('/players/Lobo'), /Reduce artwork/, 'Unavailable storage defaults to full artwork')
  console.log('Artwork defaults, page-specific preferences, aliases, restoration, and unavailable storage checks passed')
} finally { globalThis.window = originalWindow; await server.close() }
