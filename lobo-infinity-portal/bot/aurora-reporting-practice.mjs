import { emptyAuroraState } from '../shared/aurora-public-state.mjs'

export const PRACTICE_ACTIONS = ['practice-mine', 'practice-submit', 'practice-act', 'practice-admin-action', 'practice-claim', 'practice-review-claim', 'practice-reset']
export const PRACTICE_PLAYERS = [
  { userId: 'practice-player-a', name: 'Practice submitter', faction: 'ariadna' },
  { userId: 'practice-player-b', name: 'Practice opponent', faction: 'pano' },
]
export function practicePublication() {
  const state = emptyAuroraState()
  state.turn = 1
  state.deadline = '2099-12-31T23:59:00Z'
  state.territories.forEach((t, i) => { t.vulnerable = i < 4 })
  state.narrativeMission = { title: 'Practice Narrative Mission', briefing: 'Sample mission for testing the reporting form only.', reward: '', sheetUrl: '' }
  return state
}

// Called only after commissioner verification and the normal method/origin/body checks.
// This store is a separate file; no publication, registration, notification or live store is passed in.
export async function reportingPractice(store, action, role, input) {
  if (!['a', 'b', 'commissioner'].includes(role)) throw Error('Choose a practice role.')
  const commissioner = role === 'commissioner', player = commissioner ? null : PRACTICE_PLAYERS[role === 'a' ? 0 : 1], state = practicePublication()
  if (action === 'practice-mine') {
    return { ...await store.view(player?.userId, commissioner, state), state,
      player: player ? { id: player.userId, name: player.name, faction: player.faction } : null,
      players: PRACTICE_PLAYERS.map(p => ({ id: p.userId, name: p.name, faction: p.faction })), reporting: { turn: 1, phase: 'open' }, practice: true }
  }
  if (action === 'practice-reset') { await store.resetPractice(); return { reset: true, practice: true } }
  if (action === 'practice-submit') {
    if (!player) throw Error('Choose a practice player to submit a game.')
    const opponent = PRACTICE_PLAYERS.find(p => p.userId === input.opponent)
    const game = await store.submit(input, player, opponent, state)
    // There is deliberately no Discord delivery call for practice records.
    return { game, verificationUrl: `https://lobo-infinity-portal.vercel.app/commissioner/aurora-vii/reporting-test?as=${game.playerB.id === 'practice-player-a' ? 'a' : 'b'}&game=${game.id}`, practice: true }
  }
  if (action === 'practice-act' || action === 'practice-admin-action') {
    if (action === 'practice-admin-action' && !commissioner) throw Error('Choose the practice commissioner for that action.')
    if (action === 'practice-act' && !player) throw Error('Choose a practice player to confirm a result.')
    return { game: await store.act(input, player?.userId, action === 'practice-admin-action'), practice: true }
  }
  if (action === 'practice-claim') {
    if (!player) throw Error('Choose a practice player to submit a claim.')
    return { claim: await store.claim(input, player), practice: true }
  }
  if (action === 'practice-review-claim') {
    if (!commissioner) throw Error('Choose the practice commissioner to review claims.')
    return { claim: await store.reviewClaim(input), practice: true }
  }
  throw Error('Choose a valid practice action.')
}
