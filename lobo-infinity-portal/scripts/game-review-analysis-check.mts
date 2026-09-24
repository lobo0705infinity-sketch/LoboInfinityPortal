import assert from 'node:assert/strict'
import { buildGameReviewAnalysis } from '../src/services/gameReviewAnalysis.ts'
import { getGameIntelligenceLists } from '../src/services/gameIntelligenceLinks.ts'
import { getGameArmyLists } from '../src/services/gameArmyListLinks.ts'
import type { ArmyIntelligenceList, RecentGame } from '../src/services/api.ts'
import type { PublicSubmittedArmyList } from '../src/services/publicDetailProjection.ts'
import narrativeCatalog from '../src/data/gameReviewNarratives.json' with { type: 'json' }
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'

assert.deepEqual(Object.keys(narrativeCatalog).sort(), [...CANONICAL_MISSIONS].sort())
for (const [mission, angles] of Object.entries(narrativeCatalog)) {
  assert.equal(angles.length, 10, `${mission}: ten narrative angles`)
  assert.equal(new Set(angles.map((row) => row.angle)).size, 10, `${mission}: distinct angles`)
}
const consecutive = Array.from({ length: 10 }, (_, index) => buildGameReviewAnalysis(game({
  id: 200 + index, mission: 'The Dig', reviewShapeIndex: index,
}), []).story)
assert.equal(new Set(consecutive).size, 10)
assert(new Set(consecutive.map((story) => story.split(' ').slice(0, 5).join(' '))).size >= 7, 'narrative shapes must change paragraph structure')
assert(consecutive.every((story) => /has not yet been decoded/.test(story)))

const missionOverMaterial = game({
  id: 110,
  mission: 'Provisioning',
  op: '6-2',
  vp: '91-217',
  bestMoment: 'Johnny trying his best to save the game',
})
const underdogReview = buildGameReviewAnalysis(missionOverMaterial, [])
assert.match(underdogReview.result, /won the mission while Snakes \/ Lucas finished with more surviving Victory Points/)
assert.match(underdogReview.result, /126-point VP deficit/)
assert.doesNotMatch(underdogReview.result, /decisive win on both mission and attrition/i)
assert.match(underdogReview.story, /Provisioning/)
assert.match(underdogReview.story, /Johnny trying his best/)
assert.match(underdogReview.bottomLine, /Lobo won Provisioning while Snakes \/ Lucas finished with 126 more surviving VP/)

const totalControl = game({
  id: 111,
  mission: "Dead Man's Switch",
  op: '8-1',
  vp: '221-75',
  loser: 'Chainsaw',
  loserDisplayName: 'Chainsaw',
})
const controlReview = buildGameReviewAnalysis(totalControl, [])
assert.match(controlReview.result, /decisive on the recorded scores/i)
assert.match(controlReview.story, /Dead Man's Switch/)
assert.notEqual(controlReview.story, underdogReview.story)

// Deleting/invalidating an old Form response leaves public game IDs ahead of
// the Army Intelligence source IDs. The submitted list ID must win the join.
const linkedGame = game({
  id: 115,
  winner: 'THE FLOOP DROOPSBY',
  loser: 'KaktusGalaxus',
  date: '2026-09-22T04:00:00.000Z',
  mission: "Dead Man's Switch",
  winnerArmyListId: '2555913601',
  loserArmyListId: '3382380291',
})
const staleSourceId = decodedList({
  armyListId: '2555913601',
  sourceId: '114',
  player: linkedGame.winner,
  opponent: linkedGame.loser,
  date: '2026-09-22',
  mission: linkedGame.mission,
})
const matched = getGameIntelligenceLists(linkedGame, [staleSourceId])
assert.equal(matched.length, 1)
assert.match(buildGameReviewAnalysis(linkedGame, matched).decidingFactors, /decoded roster/)
assert.doesNotMatch(buildGameReviewAnalysis(linkedGame, matched).decidingFactors, /Without decoded lists/)
const winnerSubmission = { id: '2555913601', player: linkedGame.winner, opponent: linkedGame.loser, mission: linkedGame.mission, date: '2026-09-22', gameId: 114 } as PublicSubmittedArmyList
const unrelatedSubmission = { id: '3382380291', player: 'Defuser', opponent: 'Arg', mission: 'Neutralization', date: '2026-09-06', gameId: 115 } as PublicSubmittedArmyList
assert.deepEqual(getGameArmyLists(linkedGame, [unrelatedSubmission, winnerSubmission]), [winnerSubmission])
assert.deepEqual(getGameArmyLists({ ...linkedGame, winnerArmyListId: '', loserArmyListId: '' }, [winnerSubmission, unrelatedSubmission]), [winnerSubmission])

const nextGame = game({ id: 116, winner: 'Jqam1', loser: 'Igor Your Humble Servant', winnerArmyListId: '3983751212', loserArmyListId: '5071712090', mission: 'The Dig', date: '2026-09-23T04:00:00.000Z' })
const nextWinnerSubmission = { ...winnerSubmission, id: nextGame.winnerArmyListId, player: nextGame.winner, opponent: '', mission: nextGame.mission, date: nextGame.date, gameId: 0 } as PublicSubmittedArmyList
const nextLoserSubmission = { ...nextWinnerSubmission, id: nextGame.loserArmyListId, player: nextGame.loser } as PublicSubmittedArmyList
assert.deepEqual(getGameArmyLists(nextGame, [nextWinnerSubmission, nextLoserSubmission]), [nextWinnerSubmission, nextLoserSubmission])
assert.deepEqual(getGameArmyLists(nextGame, [{ ...nextWinnerSubmission, opponent: 'Somebody else' }]), [])
assert.deepEqual(getGameArmyLists({ ...nextGame, winnerArmyListId: '', loserArmyListId: '' }, [nextWinnerSubmission, nextLoserSubmission]), [])
assert.deepEqual(getGameIntelligenceLists(nextGame, [staleSourceId]), [])
assert.match(buildGameReviewAnalysis(nextGame, []).decidingFactors, /no decoded roster in this public snapshot yet/)
assert.doesNotMatch(buildGameReviewAnalysis(nextGame, []).decidingFactors, /Without decoded lists/)
assert.match(buildGameReviewAnalysis({ ...nextGame, bestMoment: 'Yadu HRL Taking out Tariq on opponents turn 1' }, []).turningPoint, /does not establish whether that moment changed the final score/)

const legacy = { ...staleSourceId, armyListId: undefined }
assert.equal(getGameIntelligenceLists(linkedGame, [legacy]).length, 1)
assert.deepEqual(getGameIntelligenceLists(linkedGame, [legacy, { ...legacy, snapshotKey: 'duplicate' }]), [])
assert.deepEqual(getGameIntelligenceLists(linkedGame, [{ ...legacy, opponent: 'Another player' }]), [])

console.log('Game Review narrative and score-direction regression passed.')

function game(overrides: Partial<RecentGame>): RecentGame {
  return {
    eventId: 'event-current-league',
    id: 1,
    date: '2026-09-21',
    division: 'League',
    winner: 'Lobo',
    winnerDisplayName: 'Lobo',
    loser: 'Snakes / Lucas',
    loserDisplayName: 'Snakes / Lucas',
    winnerFaction: 'Kosmoflot',
    loserFaction: 'Yu Jing',
    winnerArmyCode: '',
    loserArmyCode: '',
    winnerArmyListId: '',
    loserArmyListId: '',
    mission: 'Provisioning',
    tp: '5-0',
    op: '6-2',
    vp: '91-217',
    bestMoment: '',
    firstTurn: 'Snakes / Lucas',
    ...overrides,
  }
}

function decodedList(overrides: Partial<ArmyIntelligenceList>): ArmyIntelligenceList {
  return {
    armyCode: '',
    armyCodeHash: '',
    date: '',
    decoded: { combatGroups: [] } as ArmyIntelligenceList['decoded'],
    decodedAt: '',
    error: '',
    event: '',
    faction: '',
    gameType: 'League',
    knownArmyLists: 0,
    mission: '',
    opponent: '',
    player: '',
    result: '',
    sectorial: '',
    snapshotKey: '',
    sourceId: '',
    sourcePlayer: '',
    sourceType: 'league',
    status: 'decoded',
    ...overrides,
  }
}
