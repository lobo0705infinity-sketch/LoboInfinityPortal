import type { ArmyIntelligenceList, RecentGame } from './api.ts'
import { getGameIntelligenceLists } from './gameIntelligenceLinks.ts'
import { isDrawGame, getGameSides } from './gameResults.ts'

export const STORY_ARTIFACT_VERSION = 'battle-story-v1'
const ORIGIN = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
const normalize = (value: unknown) => String(value ?? '').trim()
const score = (value: string) => normalize(value).replace(/[-—]/g, '–').replace(/\s/g, '')

export async function getBattleStoryArtifactIdentity(game: RecentGame, lists: ArmyIntelligenceList[]) {
  const linked = getGameIntelligenceLists(game, lists)
  const sides = getGameSides(game)
  const rawDate = normalize(game.date)
  const isoDay = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const slashDay = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  // Game dates are calendar days, independent of the browser/worker timezone.
  const day = isoDay ? isoDay[0] : slashDay
    ? `${slashDay[3]}-${slashDay[1].padStart(2, '0')}-${slashDay[2].padStart(2, '0')}` : rawDate
  const input = {
    version: STORY_ARTIFACT_VERSION, id: game.id,
    date: day,
    mission: normalize(game.mission), winner: normalize(sides[0].player), loser: normalize(sides[1].player),
    winnerFaction: normalize(game.winnerFaction), loserFaction: normalize(game.loserFaction),
    winnerDisplayName: normalize(sides[0].displayName || sides[0].player),
    loserDisplayName: normalize(sides[1].displayName || sides[1].player),
    tp: score(game.tp), op: score(game.op), vp: score(game.vp), draw: isDrawGame(game),
    firstTurn: normalize(game.firstTurn), bestMoment: normalize(game.bestMoment),
    rosters: sides.map((side, index) => {
      const player = side.player
      const list = linked.find((candidate) => normalize(candidate.player) === normalize(player))
      return {
        id: normalize(index ? game.loserArmyListId : game.winnerArmyListId),
        fingerprint: normalize(list?.rosterFingerprint || list?.armyCodeHash ||
          (index ? game.loserRosterFingerprint : game.winnerRosterFingerprint)),
        pipeline: normalize(list?.pipelineVersion), tactical: normalize(list?.tacticalSchemaVersion),
      }
    }),
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)))
  const inputHash = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return { inputHash, pathname: `battle-stories/${game.id}/${inputHash}.json` }
}

export async function readBattleStoryArtifact(game: RecentGame, lists: ArmyIntelligenceList[], fetchObject = fetch) {
  const identity = await getBattleStoryArtifactIdentity(game, lists)
  const response = await fetchObject(ORIGIN + identity.pathname)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Stored battle story returned HTTP ${response.status}.`)
  const payload = await response.json()
  if (payload.schemaVersion !== 1 || payload.generatorVersion !== STORY_ARTIFACT_VERSION ||
      payload.gameId !== game.id || payload.inputHash !== identity.inputHash ||
      typeof payload.story !== 'string' || !payload.story.trim())
    throw new Error('Stored battle story identity is invalid.')
  return { ...identity, story: payload.story as string }
}
