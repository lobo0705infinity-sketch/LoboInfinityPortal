import { timingSafeEqual } from 'node:crypto'
import { put } from '@vercel/blob'
import { readBattleStoryArtifact, getBattleStoryArtifactIdentity, STORY_ARTIFACT_VERSION } from '../../src/services/gameStoryArtifact.ts'
import { getStoryListReadiness } from '../../src/services/gameIntelligenceLinks.ts'
import {
  FAILED_DECODE_BATTLE_STORY, getSubmittedHighlightBattleStory, loadBattleStory,
  NO_ELIGIBLE_HERO_BATTLE_STORY, PENDING_BATTLE_STORY,
  UNSUPPORTED_MISSION_VERSION_BATTLE_STORY,
} from '../../src/services/gameStoryRouting.ts'

// The Apps Script queue calls this after persisting a canonical game and
// consulting the decoder. Wait for submitted lists that can still decode;
// confirmed missing or terminally invalid lists use a roster-free scene.
export function createGameStoryHandler({
  readArtifact = readBattleStoryArtifact, writeArtifact = put,
  persistenceEnabled = () => {
    if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL_ENV === 'production')
      throw new Error('Battle story storage is not configured.')
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  },
} = {}) {
return async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  const authorization = String(request.headers?.authorization || '').trim()
  const suppliedToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim() : ''
  if (!workerToken || !safeEqual(suppliedToken, workerToken)) {
    response.status(401).json({ error: 'Background worker authentication is required.', success: false })
    return
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    const game = body?.game
    const lists = body?.lists
    if (!Number.isSafeInteger(game?.id) || game.id <= 0 || !Array.isArray(lists) || lists.length > 100 ||
      !game.mission || !game.winnerFaction || !game.loserFaction ||
      (game.winnerArmyListId && game.winnerArmyListId === game.loserArmyListId)) {
      response.status(400).json({ error: 'A canonical game and its candidate army lists are required.', success: false })
      return
    }

    const readiness = getStoryListReadiness(game, lists)
    if (readiness === 'pending') {
      response.status(200).json({ error: PENDING_BATTLE_STORY, pending: true, success: false })
      return
    }

    const persist = persistenceEnabled()
    const stored = persist ? await readArtifact(game, lists) : null
    let story = stored?.story || await loadBattleStory(game, lists)
    if (story && ![PENDING_BATTLE_STORY, FAILED_DECODE_BATTLE_STORY, NO_ELIGIBLE_HERO_BATTLE_STORY,
      UNSUPPORTED_MISSION_VERSION_BATTLE_STORY].includes(story)) {
      const identity = stored || await getBattleStoryArtifactIdentity(game, lists)
      if (persist && !stored) {
        try { await writeArtifact(identity.pathname, JSON.stringify({ schemaVersion: 1,
          generatorVersion: STORY_ARTIFACT_VERSION, gameId: game.id, inputHash: identity.inputHash, story }),
          { access: "public", addRandomSuffix: false, allowOverwrite: false,
            contentType: "application/json", cacheControlMaxAge: 31_536_000 })
        } catch (error) {
          const concurrent = await readArtifact(game, lists)
          if (!concurrent) throw error
          story = concurrent.story
        }
      }
      response.status(200).json({ story, success: true,
        artifact: persist ? identity.pathname : null,
        rosterless: readiness === 'rosterless' && !getSubmittedHighlightBattleStory(game) })
      return
    }

    response.status(200).json({
      error: story || 'A story cannot be generated for this game and mission.',
      pending: story === PENDING_BATTLE_STORY,
      success: false,
    })
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      success: false,
    })
  }
}

}
export default createGameStoryHandler()

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
