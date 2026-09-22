import assert from 'node:assert/strict'
import { buildGameReviewAnalysis } from '../src/services/gameReviewAnalysis.ts'
import type { RecentGame } from '../src/services/api.ts'

const missionOverMaterial = game({
  id: 110,
  mission: 'Provisioning',
  op: '6-2',
  vp: '91-217',
  bestMoment: 'Johnny trying his best to save the game',
})
const underdogReview = buildGameReviewAnalysis(missionOverMaterial, [])
assert.match(underdogReview.result, /won the mission while Snakes \/ Lucas won the material battle/)
assert.match(underdogReview.result, /126-point deficit/)
assert.doesNotMatch(underdogReview.result, /decisive win on both mission and attrition/i)
assert.match(underdogReview.story, /battlefield told two different stories/)
assert.match(underdogReview.story, /Johnny trying his best/)
assert.match(underdogReview.bottomLine, /Snakes \/ Lucas won the material battle; Lobo won Provisioning/)

const totalControl = game({
  id: 111,
  mission: "Dead Man's Switch",
  op: '8-1',
  vp: '221-75',
  loser: 'Chainsaw',
  loserDisplayName: 'Chainsaw',
})
const controlReview = buildGameReviewAnalysis(totalControl, [])
assert.match(controlReview.result, /decisive win on both mission and attrition/i)
assert.match(controlReview.story, /tightened control one exchange at a time/)
assert.notEqual(controlReview.story, underdogReview.story)

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
