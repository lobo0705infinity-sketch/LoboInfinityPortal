import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = filename => readFileSync(new URL(`../backend/${filename}`, import.meta.url), 'utf8')
const context = vm.createContext({ canonicalizeArmyName: value => value, normalizeGameType: value => value || 'league' })
vm.runInContext(source('GamePipelineReliability.gs'), context)
vm.runInContext(source('GameEngine.gs'), context)
context.getGameEngineEventId = () => ''
context.getGameEngineGameType = () => 'casual'
context.isGameEngineFirstTurnPlayer = () => false
context.getGameEnginePlayerArmyListId = () => ''
const row = ['', 'Casual', '2026-09-21', 'Superiority', 'Retrofuturist', 'Blitchga',
  2, 2, 0, 0, 0, 0, '', 'Yu Jing', 'Operations Subsection']
for (const winner of [0, 1, 2]) {
  assert.equal(context.buildPlayerRow(row, 1, winner)[9], winner === 2 ? row[14] : row[13])
  assert.equal(context.buildPlayerRow(row, 2, winner)[9], winner === 2 ? row[13] : row[14])
}
vm.runInContext(source('Constants.gs'), context)
vm.runInContext(source('ResponseImporter.gs'), context)
const imported = rows => context.lifWasImported_({ getLastRow: () => rows.length + 1,
  getRange: (start, column, count, width) => {
    assert.equal(width, 6)
    return { getDisplayValues: () => rows }
  } }, 'submission-1')
assert.equal(imported([['submission-1', 'casual', '', '', 'Rejected', 'bad faction']]), false)
assert.equal(imported([['submission-1', 'casual', '', 123, 'Imported', '']]), true)
assert.equal(imported([['submission-1', 'casual', '', 123, 'Rebuild Failed', 'timeout']]), true)
assert.equal(imported([['submission-1', 'casual', '', '', 'Rebuild Failed', 'timeout']]), false)
assert.equal(imported([['submission-1', 'join-community', '', '', 'Duplicate', '']]), true)
console.log('Pipeline audit regression PASS: draw factions and rejected-versus-persisted import retries')
