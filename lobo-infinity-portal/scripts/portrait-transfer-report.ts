import { readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { resolveFactionPortrait } from '../src/config/factionPortraits.ts'
import { FACTION_PORTRAIT_DERIVATIVES } from '../src/config/factionPortraitDerivatives.ts'

const inputPath = process.argv[2]

if (!inputPath) throw new Error('Usage: portrait-transfer-report.ts <players-response.json>')

const payload = JSON.parse(readFileSync(resolve(inputPath), 'utf8'))
const standings = payload.standings ?? payload.divisions?.flatMap((division: { standings?: unknown[] }) => division.standings ?? []) ?? []
const portraits = standings
  .map((player: { faction?: string; favoriteArmy?: string }) => resolveFactionPortrait(player.favoriteArmy || player.faction))
  .filter(Boolean)
const unique = [...new Map(portraits.map((portrait: { src: string }) => [portrait.src, portrait])).values()] as { src: string }[]
const rows = unique.map((portrait) => {
  const id = basename(portrait.src, '.png')
  const derivatives = FACTION_PORTRAIT_DERIVATIVES[id]
  return {
    id,
    original: statSync(join('public', portrait.src)).size,
    width320: statSync(join('public', derivatives[0].src)).size,
    width640: statSync(join('public', derivatives[1].src)).size,
  }
})

console.log(JSON.stringify({
  players: standings.length,
  portraitCards: portraits.length,
  uniquePortraits: rows.length,
  originalBytes: sum('original'),
  width320Bytes: sum('width320'),
  width640Bytes: sum('width640'),
  largestOriginal: Math.max(...rows.map((row) => row.original)),
  largest320: Math.max(...rows.map((row) => row.width320)),
}, null, 2))

function sum(key: 'original' | 'width320' | 'width640') {
  return rows.reduce((total, row) => total + row[key], 0)
}
