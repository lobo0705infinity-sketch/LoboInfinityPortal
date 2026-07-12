import assert from 'node:assert/strict'
import { resolveSubmitGamePlayer } from '../src/services/submitGameIdentity.ts'

assert.equal(
  resolveSubmitGamePlayer(false, '', '', 'Guest'),
  'Guest',
  'Unauthenticated shell state may display Guest.',
)

assert.equal(
  resolveSubmitGamePlayer(true, '', '', 'Guest'),
  '',
  'Authenticated submission must not resolve Guest as a player.',
)

assert.equal(
  resolveSubmitGamePlayer(true, 'Lobo', 'Lobo Display', 'Lobo Real Name'),
  'Lobo',
  'League submission should prefer the authenticated league player.',
)

assert.equal(
  resolveSubmitGamePlayer(true, '', 'Portal Handle', 'Portal Player'),
  'Portal Handle',
  'Casual submission should use the authenticated portal player display name when no league player exists.',
)

assert.equal(
  resolveSubmitGamePlayer(true, '', '', 'Casual Player'),
  'Casual Player',
  'Casual submission should fall back to the authenticated portal display name.',
)

const staleCasualPlayer = 'Guest'
const hydratedCasualPlayer =
  resolveSubmitGamePlayer(true, 'Lobo', 'Lobo Display', 'Lobo Real Name') ||
  staleCasualPlayer

assert.equal(
  hydratedCasualPlayer,
  'Lobo',
  'Authenticated Casual Game hydration must replace stale Guest with the authenticated player.',
)

console.log('submit game identity checks passed')
