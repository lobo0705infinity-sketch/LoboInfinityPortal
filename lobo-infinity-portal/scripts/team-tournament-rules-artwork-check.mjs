#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const rulesSource = await readFile('src/pages/Rules.tsx', 'utf8')
const css = await readFile('src/App.css', 'utf8')
const artwork = await readFile('src/assets/team-tournament-rules-hero.png')

assert.match(rulesSource, /rulebookId === 'teamTournament'[\s\S]*' team-tournament-rules-page'/)
assert.match(css, /\.team-tournament-rules-page > \.page-header\s*\{[\s\S]*?aspect-ratio: 1672 \/ 941;[\s\S]*?background-image: url\("\.\/assets\/team-tournament-rules-hero\.png"\);[\s\S]*?background-size: cover;/)
assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.team-tournament-rules-page > \.page-header\s*\{[\s\S]*?background-size: contain;/)
assert.match(css, /\.team-tournament-rules-page > \.page-header > \*\s*\{[\s\S]*?clip-path: inset\(50%\);/)

assert.equal(artwork.subarray(1, 4).toString('ascii'), 'PNG')
assert.equal(artwork.readUInt32BE(16), 1672)
assert.equal(artwork.readUInt32BE(20), 941)
assert.equal(artwork.length, 2_197_576)
assert.equal(createHash('sha256').update(artwork).digest('hex'), 'aa96129222b1bd37801b9dc53e319f7853b9f69d8803c1c569666e321b17d2ee')

console.log('Team Tournament Rules artwork regression passed.')
