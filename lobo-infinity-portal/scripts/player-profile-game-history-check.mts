import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getPlayerGameResult, isPlayerInGame } from '../src/public/playerGameResult.ts'
import type { PublicGame } from '../src/public/snapshotTypes.ts'

const source = fs.readFileSync(new URL('../src/public/SnapshotPublicApp.tsx', import.meta.url), 'utf8')
const game = (id: number, winner: string, player1 = 'Zhukov2', player2 = 'Opponent') => ({
  id, player1, player2, winner,
} as PublicGame)
const games = [
  game(1, 'Zhukov2'),
  ...Array.from({ length: 7 }, (_, index) => game(index + 2, 'Opponent')),
  game(9, 'Draw'),
]

const history = games.filter((row) => isPlayerInGame(row, 'Zhukov2'))
const results = history.map((row) => getPlayerGameResult(row, 'Zhukov2'))

assert.equal(history.length, 9, 'Game History must include all player1/player2 appearances, including draws.')
assert.equal(results.filter((result) => result === 'WIN').length, 1)
assert.equal(results.filter((result) => result === 'LOSS').length, 7)
assert.equal(results.filter((result) => result === 'DRAW').length, 1)
assert.equal(getPlayerGameResult(game(10, 'Draw', 'Other', 'Zhukov2'), 'Zhukov2'), 'DRAW')
assert.equal(getPlayerGameResult(game(11, 'Other', 'Other', 'Zhukov2'), 'Zhukov2'), 'LOSS')
assert.equal(getPlayerGameResult(game(12, 'Other', 'Other', 'Third'), 'Zhukov2'), null)

assert.match(source, /filter\(g=>isPlayerInGame\(g,p\.player\)\)/)
assert.match(source, /<GameTable games=\{history\} perspectivePlayer=\{p\.player\}\/>/)
assert.match(source, /perspectivePlayer\?<th>Result<\/th>:null/)
assert.match(source, /getPlayerGameResult\(g,perspectivePlayer\)/)
assert.match(source, /function Games\(\)[\s\S]*?<GameTable games=\{\[\.\.\.state\.data!\]\.reverse\(\)\}\/>/)

console.log('Player Profile Game History result regression passed (1 win, 7 losses, 1 draw).')
