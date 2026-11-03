import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const str = value => String(value ?? '').trim()
const ctx = vm.createContext({
  Date, Set,
  getEventManagerString:str, getResultSubmissionString:str,
  normalizeResultSubmissionValue:value => str(value).toLowerCase(),
  parseResultSubmissionScore:value => str(value) && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null,
  canonicalizeArmyName:str,
  getResultSubmissionTimestamp:() => '2026-11-02 20:05:26',
  getResultSubmissionDate:() => '2026-11-02',
  getResultSubmissionArmyCode:str,
  getResultSubmissionArmyListId:list => list.id,
  validateResultSubmissionArmyListId:(id) => ({valid:true,id}),
  determineLeagueSubmissionWinner:(a,b,at,bt,ao,bo,av,bv) => at !== bt ? at > bt ? a : b : ao !== bo ? ao > bo ? a : b : av !== bv ? av > bv ? a : b : 'Draw',
  Session:{getScriptTimeZone:() => 'UTC'},
  Utilities:{formatDate:() => '2026-11-02'},
})
for (const file of ['DoubleEliminationBracketApi.gs','CanonicalValidationService.gs','CanonicalSubmissionService.gs','GameFactory.gs'])
  vm.runInContext(fs.readFileSync(`backend/${file}`,'utf8'),ctx)
ctx.getEventById = () => ({type:'Individual Double Elimination'})
ctx.readEventBracketMatches_ = () => [{matchId:'W1-M4',status:'Active',playerA:'Rysanov',playerB:'Sam',bracket:'Winners',bracketRound:1}]
ctx.getEventBracketMission_ = () => 'Corporate Appropriation'

for (const [winner, expectedResult, expectedFaction, expectedList] of [
  ['Player Victory','Player 1 Victory','Oban','rysanov-list'],
  ['Opponent Victory','Player 2 Victory','Tohaa','sam-list'],
  ['Rysanov','Player 1 Victory','Oban','rysanov-list'],
  ['Sam','Player 2 Victory','Tohaa','sam-list'],
]) {
  const params = {eventId:'top40',matchId:'W1-M4',player:'Rysanov',opponent:'Sam',winner,
    firstTurn:'Opponent',playerFaction:'Oban',opponentFaction:'Tohaa',
    playerArmyListId:'rysanov-list',opponentArmyListId:'sam-list',
    playerTournamentPoints:'5',opponentTournamentPoints:'2',playerObjectivePoints:'6',opponentObjectivePoints:'5',
    playerVictoryPoints:'169',opponentVictoryPoints:'203'}
  const checked = ctx.validateCanonicalGame({source:'portal',workflow:'top-40',params})
  assert.equal(checked.valid,true,checked.error)
  const row = ctx.buildCanonicalGameRow(ctx.canonicalSubmissionBuildPortalGameCommand_({params},'top-40',checked.value))
  assert.equal(row[18],expectedResult,winner)
  assert.equal(row[13],expectedFaction,`${winner} winner faction`)
  assert.equal(row[21],expectedList,`${winner} winner list`)
  assert.deepEqual(Array.from(row.slice(6,12)),[5,2,6,5,169,203],`${winner} preserves player score order`)
}
console.log('PASS: Top 40 form labels and named winners retain the correct winner, factions, lists and scores.')

// Guarded repair must reject changed records before mutating any game; reruns are no-ops.
vm.runInContext(fs.readFileSync('backend/GameScoreCorrectionApi.gs','utf8'),ctx)
vm.runInContext(fs.readFileSync('backend/Top40ResultCorrection.gs','utf8'),ctx)
vm.runInContext('const FORM = {P1TP:6,P2TP:7,P1OP:8,P2OP:9,P1VP:10,P2VP:11,WINNINGFACTION:13,LOSINGFACTION:14,GAME_RESULT:18,WINNER_ARMY_LIST_ID:21,LOSER_ARMY_LIST_ID:22};',ctx)
const rows = new Map([
  [138,['Harrower','KharuS',5,0,7,2,154,174,'Kestrel Colonial Force','Oban',3531976050,3450897997]],
  [139,['Rysanov','Sam',5,2,6,51,169,203,'Tohaa','Oban',2730349916,4931006337]],
].map(([id,v]) => {
  const r = []; [r[4],r[5]]=v.slice(0,2); r.splice(6,6,...v.slice(2,8));
  [r[13],r[14]]=v.slice(8,10); r[18]='Player 2 Victory'; [r[21],r[22]]=v.slice(10);
  return [id,r]
}))
let writes=0, audits=0, progressions=0
let match = {matchId:'W1-M4',status:'Active',playerA:'Rysanov',playerB:'Sam'}
ctx.LockService = {getScriptLock:() => ({waitLock(){},releaseLock(){}})}
ctx.Logger = {log(){}}
ctx.SpreadsheetApp = {flush(){}}
ctx.readEventBracketMatches_ = () => [{matchId:'W1-M6',status:'Completed',gameId:138,winner:'Harrower',loser:'KharuS'},match]
ctx.getGameScoreCorrectionTarget = id => ({found:true,eventId:'event-lobo-s-american-top-40',player1:rows.get(id)[4],player2:rows.get(id)[5],row:rows.get(id),rowNumber:id,
  sheet:{getRange:(row,column) => ({setValue:value => {writes++; rows.get(row)[column-1]=value}})}})
ctx.recordGameScoreCorrectionAudit = () => audits++
ctx.markCanonicalRebuildRequired_ = () => {}
ctx.invalidateResultSubmissionCaches = () => {}
ctx.markCanonicalRebuildRecoveryProjectionsDirty_ = () => {}
ctx.setEventBracketMatchGameId_ = (_e,_m,id) => {match.gameId=id}
ctx.applyTop40BracketProgression_ = (_e,_m,_id,winner,loser) => { if(match.status !== 'Completed') progressions++; Object.assign(match,{status:'Completed',winner,loser}) }
rows.get(139)[9]=50
assert.throws(() => ctx.repairTop40Results20261102(),/changed/)
assert.equal(writes,0)
rows.get(139)[9]=51
ctx.repairTop40Results20261102()
assert.equal(rows.get(139)[9],5)
assert.equal(rows.get(139)[18],'Player 1 Victory')
assert.equal(rows.get(138)[18],'Player 1 Victory')
assert.equal(rows.get(139)[13],'Oban')
assert.equal(rows.get(138)[21],3450897997)
assert.equal(audits,2)
assert.equal(progressions,1)
const writesAfter=writes
ctx.repairTop40Results20261102()
assert.equal(writes,writesAfter)
assert.equal(audits,2)
assert.equal(progressions,1)
console.log('PASS: Repair rejects concurrent changes, audits both corrections, advances once and safely reruns.')
