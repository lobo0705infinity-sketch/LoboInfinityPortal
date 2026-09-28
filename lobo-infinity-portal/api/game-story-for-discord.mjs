import { timingSafeEqual } from 'node:crypto'
import { getGameIntelligenceLists } from '../src/services/gameIntelligenceLinks.ts'
import {
  loadBattleStory, NO_ELIGIBLE_HERO_BATTLE_STORY, PENDING_BATTLE_STORY,
  UNSUPPORTED_MISSION_VERSION_BATTLE_STORY,
} from '../src/services/gameStoryRouting.ts'

// The Apps Script queue calls this only after persisting a canonical game and
// decoding the two army lists. Recheck the linkage here before producing any
// text that could be sent to Discord.
export default async function handler(request, response) {
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
    if (!Number.isSafeInteger(game?.id) || game.id <= 0 || !Array.isArray(lists) || lists.length !== 2) {
      response.status(400).json({ error: 'A canonical game and its two lists are required.', success: false })
      return
    }

    const linked = getGameIntelligenceLists(game, lists)
    if (linked.length !== 2 || linked[0] === linked[1]) {
      response.status(200).json({ error: 'Waiting for both game-linked decoded lists.', pending: true, success: false })
      return
    }

    const story = await loadBattleStory(game, linked)
    if (story && ![PENDING_BATTLE_STORY, NO_ELIGIBLE_HERO_BATTLE_STORY,
      UNSUPPORTED_MISSION_VERSION_BATTLE_STORY].includes(story)) {
      response.status(200).json({ story, success: true })
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

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
