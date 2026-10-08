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
  assert.match(render('/players/Lobo'), /Use compact artwork/)
  assert.match(render('/players/Lobo'), /aria-expanded="true"/)
  preferences.set('lobo:artwork:v2:global', 'reduced')
  assert.match(render('/players/Lobo'), /Show full artwork/)
  assert.match(render('/players/Lobo'), /aria-expanded="false"/)
  assert.match(render('/players/Chainsaw'), /Show full artwork/, 'Players share the global artwork preference')
  preferences.set('lobo:artwork:v2:global', 'reduced')
  assert.match(render('/standings?eventId=event-current-league'), /Show full artwork/)
  assert.match(render('/event/event-current-league/standings'), /Show full artwork/, 'Standings aliases share the preference')
  assert.match(render('/event/event-current-league/schedule'), /Show full artwork/, 'Schedule shares the same preference')
  preferences.set('lobo:artwork:v2:global', 'full')
  assert.match(render('/players/Lobo'), /Use compact artwork/, 'Restoring full artwork is remembered')
  globalThis.window = { localStorage: { getItem() { throw new Error('Storage denied') } } }
  assert.match(render('/players/Lobo'), /Use compact artwork/, 'Unavailable storage defaults to full artwork')
  console.log('Artwork defaults, shared preferences, aliases, restoration, and unavailable storage checks passed')
} finally { globalThis.window = originalWindow; await server.close() }
