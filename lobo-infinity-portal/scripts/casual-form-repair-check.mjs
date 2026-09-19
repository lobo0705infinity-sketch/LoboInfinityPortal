import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const casual = readFileSync(new URL('../backend/CasualForm.gs', import.meta.url), 'utf8')
const importer = readFileSync(new URL('../backend/ResponseImporter.gs', import.meta.url), 'utf8')
const gameEngine = readFileSync(new URL('../backend/GameEngine.gs', import.meta.url), 'utf8')

assert.match(casual, /function refreshCasualSubmissionForm\(\)[\s\S]*lifUpdateCasualPlayerChoices_\(form, players\)/)
assert.doesNotMatch(
  casual.match(/function refreshCasualSubmissionForm\(\)[\s\S]*?\n\}/)?.[0] ?? '',
  /deleteItem|lifAddCasualGameFields_|createCasualSubmissionForm/,
  'Routine refresh must not rebuild or delete Form items.',
)
assert.match(casual, /function lifNormalizeCasualPlayerChoices_[\s\S]*\.trim\(\)[\s\S]*seen\[normalized\][\s\S]*localeCompare/)
assert.match(casual, /function lifUpdateCasualPlayerChoices_[\s\S]*PLAYER[\s\S]*OPPONENT[\s\S]*previousPlayer[\s\S]*previousOpponent[\s\S]*catch \(err\)[\s\S]*setChoiceValues\(previousPlayer\)/)
assert.match(casual, /setCollectEmail\(false\)/)
assert.doesNotMatch(casual, /Date Played/)

const required = [
  'PLAYER', 'PLAYER_FACTION', 'PLAYER_ARMY_CODE', 'OPPONENT', 'OPPONENT_FACTION',
  'OPPONENT_ARMY_CODE', 'MISSION', 'GAME_RESULT', 'FIRST_TURN', 'PLAYER_TP',
  'OPPONENT_TP', 'PLAYER_OP', 'OPPONENT_OP', 'PLAYER_VP', 'OPPONENT_VP',
]
for (const field of required) {
  assert.match(casual, new RegExp(`f\\.${field}[^\\n]+required: true`), `${field} must remain required.`)
}
assert.match(casual, /f\.BEST_MOMENT[^\n]+required: false/)
assert.match(casual, /f\.NOTES[^\n]+required: false/)
assert.equal((casual.match(/type: "SCORE"/g) ?? []).length, 6)
assert.match(casual, /requireWholeNumber\(\)/)
assert.match(casual, /function repairCasualSubmissionForm\(\)/)
assert.match(casual, /items\.length > expected\.length[\s\S]*repair stopped without deleting anything/)
assert.match(casual, /for \(let index = items\.length; index < expected\.length/)

assert.match(importer, /responseKey \+ ":casual-form-sync"[\s\S]*"Sync Failed"/)
assert.match(importer, /function lifReadSubmission_[\s\S]*player:.*selectedPlayer[\s\S]*opponent: get\(f\.OPPONENT\)/)
assert.doesNotMatch(importer.match(/function lifReadSubmission_[\s\S]*?\n\}/)?.[0] ?? '', /Email Address|collectEmail/)

assert.ok(gameEngine.length > 0, 'Game Engine source must remain present.')
console.log('casual form repair regression checks passed')
