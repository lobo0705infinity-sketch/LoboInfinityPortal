import assert from 'node:assert/strict'
import { createGameStoryHandler } from '../api/game-story-for-discord.mjs'
import { getBattleStoryArtifactIdentity, readBattleStoryArtifact } from '../src/services/gameStoryArtifact.ts'

const game = { id: 9082, date: '2026-10-04', mission: 'The Dig', winner: 'Alice', loser: 'Bob',
  winnerFaction: 'USAriadna Ranger Force', loserFaction: 'O-12', tp: '4–1', op: '2–0', vp: '171–64',
  winnerArmyListId: '', loserArmyListId: '' }
const priorToken = process.env.ARMY_INTELLIGENCE_WORKER_TOKEN
process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = 'artifact-test-token'
const records = new Map<string, string>()
let writes = 0
const read = async (candidate: typeof game) => {
  const identity = await getBattleStoryArtifactIdentity(candidate, [])
  const raw = records.get(identity.pathname)
  return raw ? { ...identity, story: JSON.parse(raw).story } : null
}
const invoke = async (handler: Function, candidate = game) => {
  const result: { status?: number; body?: any } = {}
  await handler({ method: 'POST', headers: { authorization: 'Bearer artifact-test-token' },
    body: { game: candidate, lists: [] } }, { status(code: number) { result.status = code; return this },
    json(body: unknown) { result.body = body }, setHeader() {} })
  return result
}
try {
  const handler = createGameStoryHandler({ persistenceEnabled: () => true, readArtifact: read,
    writeArtifact: async (path: string, raw: string, options: any) => {
      assert.equal(options.allowOverwrite, false); assert.equal(options.addRandomSuffix, false)
      records.set(path, raw); writes++
    } })
  const first = await invoke(handler)
  assert.equal(first.body.success, true); assert.equal(writes, 1)
  const replay = await invoke(handler)
  assert.equal(replay.body.story, first.body.story); assert.equal(writes, 1)
  const publicStory = await readBattleStoryArtifact(game, [], async (url: any) =>
    new Response(records.get(String(url).split('.com/')[1]), { status: 200 }))
  assert.equal(publicStory?.story, first.body.story, 'portal reads exactly the Discord artifact')
  assert.deepEqual(await getBattleStoryArtifactIdentity(game, []),
    await getBattleStoryArtifactIdentity({ ...game, date: '10/4/2026', tp: '4-1', op: '2 - 0', vp: '171-64',
      winnerDisplayName: 'Alice', loserDisplayName: 'Bob' }, []), 'public/private formatting shares identity')
  const draw = { ...game, gameResult: 'draw', tp: '2–2', op: '3–3', vp: '100–100' }
  assert.deepEqual(await getBattleStoryArtifactIdentity(draw, []),
    await getBattleStoryArtifactIdentity({ ...draw, winner: 'Draw', loser: 'Draw',
      winnerDisplayName: 'Draw', loserDisplayName: 'Draw', player1: 'Alice', player2: 'Bob',
      player1DisplayName: 'Alice', player2DisplayName: 'Bob' }, []), 'draw participants share the same artifact')
  const changed = await invoke(handler, { ...game, bestMoment: 'A dramatic last order.' })
  assert.notEqual(changed.body.artifact, first.body.artifact); assert.equal(writes, 2)
  const failed = await invoke(createGameStoryHandler({ persistenceEnabled: () => true,
    readArtifact: async () => null, writeArtifact: async () => { throw Error('Storage unavailable') } }))
  assert.equal(failed.status, 500); assert.equal(failed.body.success, false, 'no successful delivery before storage')
  const concurrent = await invoke(createGameStoryHandler({ persistenceEnabled: () => true,
    readArtifact: (() => { let reads = 0; return async () => ++reads === 1 ? null :
      { ...(await getBattleStoryArtifactIdentity(game, [])), story: 'Concurrent authoritative story' } })(),
    writeArtifact: async () => { throw Error('Already exists') } }))
  assert.equal(concurrent.body.story, 'Concurrent authoritative story')
  const corrupt = JSON.parse(records.get(first.body.artifact)!)
  await assert.rejects(readBattleStoryArtifact(game, [], async () => new Response(JSON.stringify({ ...corrupt, gameId: 1 }))),
    /identity is invalid/)
  console.log('Stored story replay, portal/Discord parity, corrections, storage failure and concurrent generation PASS')
} finally {
  if (priorToken === undefined) delete process.env.ARMY_INTELLIGENCE_WORKER_TOKEN
  else process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = priorToken
}
