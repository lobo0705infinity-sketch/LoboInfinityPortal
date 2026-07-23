import { createHash } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ARMY_INTELLIGENCE_DECODER_VERSION,
  decodeArmyListToFiles,
} from '../scripts/infinity-army-decode.mjs'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  try {
    const body = await readJsonBody(request)
    const apiUrl = String(body.apiUrl || process.env.VITE_API_URL || '').trim()
    const authToken = String(body.authToken || '').trim()

    if (!apiUrl) {
      response.status(500).json({ error: 'Missing API URL.', success: false })
      return
    }

    if (!authToken) {
      response.status(401).json({ error: 'Sign in with Google to continue.', success: false })
      return
    }

    const sources = await loadLiveSources(apiUrl)
    const state = await loadSnapshotState(apiUrl)
    const candidates = sources.filter((source) => {
      const current = state.get(source.snapshotKey)
      return (
        !current ||
        current.armyCodeHash !== source.armyCodeHash ||
        current.status !== 'decoded' ||
        current.decoderVersion !== ARMY_INTELLIGENCE_DECODER_VERSION ||
        !current.hasProfileMetadata
      )
    })

    const outputDir = await mkdtemp(join(tmpdir(), 'lobo-army-intelligence-'))
    const snapshots = []
    const failures = []

    for (const source of candidates) {
      try {
        const result = await decodeArmyListToFiles({
          input: source.armyCode,
          outputDir,
        })
        snapshots.push({
          decoded: result.list,
          decodedAt: new Date().toISOString(),
          error: '',
          snapshotKey: source.snapshotKey,
          status: 'decoded',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push({
          reason: message,
          snapshotKey: source.snapshotKey,
        })
        snapshots.push({
          decoded: null,
          decodedAt: new Date().toISOString(),
          error: message,
          snapshotKey: source.snapshotKey,
          status: 'failed',
        })
      }
    }

    if (snapshots.length > 0) {
      await postSnapshots(apiUrl, snapshots, authToken)
    }

    response.status(200).json({
      decoded: snapshots.filter((snapshot) => snapshot.status === 'decoded').length,
      failed: failures.length,
      skipped: sources.length - candidates.length,
      sourceCount: sources.length,
      success: true,
      updated: snapshots.length,
    })
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      success: false,
    })
  }
}

async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

async function loadLiveSources(apiUrl) {
  const [recentGames, casualGames, armyLists, events] = await Promise.all([
    getAction(apiUrl, 'recentGames').then((payload) => payload.games || []),
    getAction(apiUrl, 'recentGames', { gameType: 'casual' }).then((payload) => payload.games || []),
    getAction(apiUrl, 'armyLists').then((payload) => payload.lists || []),
    getAction(apiUrl, 'events').catch(() => null),
  ])

  const sources = []
  const eventIds = new Set()
  const eventNames = new Map()

  for (const event of events?.events || []) {
    if (event?.id) {
      eventIds.add(event.id)
      eventNames.set(event.id, event.name || event.eventName || '')
    }
  }
  if (events?.currentEvent?.id) {
    eventIds.add(events.currentEvent.id)
    eventNames.set(events.currentEvent.id, events.currentEvent.name || '')
  }

  for (const game of uniqueGames([...recentGames, ...casualGames])) {
    pushParticipantSource(sources, {
      armyCode: game.winnerArmyCode,
      date: game.date,
      event: game.eventName || eventNames.get(game.eventId) || game.eventId || '',
      faction: game.winnerFaction,
      gameType: formatGameType(game.gameType),
      mission: game.mission,
      opponent: game.loserDisplayName || game.loser,
      player: game.winnerDisplayName || game.winner,
      result: String(game.gameResult || '').toLowerCase() === 'draw' ? 'Draw' : 'Win',
      sectorial: game.winnerFaction,
      sourceId: game.id,
      sourcePlayer: 'winner',
      sourceType: game.gameType === 'casual' ? 'casual' : 'league',
    })
    pushParticipantSource(sources, {
      armyCode: game.loserArmyCode,
      date: game.date,
      event: game.eventName || eventNames.get(game.eventId) || game.eventId || '',
      faction: game.loserFaction,
      gameType: formatGameType(game.gameType),
      mission: game.mission,
      opponent: game.winnerDisplayName || game.winner,
      player: game.loserDisplayName || game.loser,
      result: String(game.gameResult || '').toLowerCase() === 'draw' ? 'Draw' : 'Loss',
      sectorial: game.loserFaction,
      sourceId: game.id,
      sourcePlayer: 'loser',
      sourceType: game.gameType === 'casual' ? 'casual' : 'league',
    })
  }

  for (const list of armyLists) {
    pushParticipantSource(sources, {
      armyCode: list.armyCode || list.armyLink,
      date: list.submissionDate,
      event: list.event,
      faction: list.faction,
      gameType: 'Army List Library',
      mission: list.mission,
      opponent: '',
      player: list.playerDisplayName || list.player,
      result: '',
      sectorial: list.sectorial,
      sourceId: list.id,
      sourcePlayer: 'library',
      sourceType: 'armyLibrary',
    })
  }

  for (const eventId of eventIds) {
    const payload = await getAction(apiUrl, 'teamTournament', { eventId }).catch(() => null)
    for (const result of payload?.results || []) {
      pushParticipantSource(sources, {
        armyCode: result.player1ArmyCode,
        date: result.createdAt || result.updatedAt,
        event: eventNames.get(eventId) || eventId,
        faction: result.winningFaction,
        gameType: 'Tournament',
        mission: result.mission,
        opponent: result.opponent,
        player: result.player,
        result: tournamentResult(result, result.player),
        sectorial: result.winningFaction,
        sourceId: result.resultId,
        sourcePlayer: 'player1',
        sourceType: 'tournament',
      })
      pushParticipantSource(sources, {
        armyCode: result.player2ArmyCode,
        date: result.createdAt || result.updatedAt,
        event: eventNames.get(eventId) || eventId,
        faction: '',
        gameType: 'Tournament',
        mission: result.mission,
        opponent: result.player,
        player: result.opponent,
        result: tournamentResult(result, result.opponent),
        sectorial: '',
        sourceId: result.resultId,
        sourcePlayer: 'player2',
        sourceType: 'tournament',
      })
    }
  }

  return uniqueSources(sources)
}

async function loadSnapshotState(apiUrl) {
  const payload = await getAction(apiUrl, 'armyIntelligence')
  const state = new Map()
  for (const list of payload.lists || []) {
    state.set(list.snapshotKey, {
      armyCodeHash: list.armyCodeHash,
      decoderVersion: list.decoded?.decoderVersion || '',
      hasProfileMetadata: snapshotHasDecodedProfileMetadata(list),
      status: list.status,
    })
  }
  return state
}

function snapshotHasDecodedProfileMetadata(list) {
  if (list.status !== 'decoded' || !list.decoded) {
    return false
  }

  const groups = Array.isArray(list.decoded.combatGroups) ? list.decoded.combatGroups : []
  return groups.every((group) => {
    const entries = Array.isArray(group.entries) ? group.entries : []
    return entries.every((entry) =>
      Object.hasOwn(entry, 'troopType') &&
      Object.hasOwn(entry, 'skills') &&
      Object.hasOwn(entry, 'wounds') &&
      Object.hasOwn(entry, 'structure'),
    )
  })
}

async function getAction(apiUrl, action, params = {}) {
  const url = new URL(apiUrl)
  url.searchParams.set('action', action)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value))
    }
  }
  const response = await fetch(url, { redirect: 'follow' })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${action} failed with HTTP ${response.status}: ${text.slice(0, 180)}`)
  }
  return JSON.parse(text)
}

async function postSnapshots(apiUrl, snapshots, authToken) {
  const body = new URLSearchParams()
  body.set('action', 'refreshArmyIntelligence')
  body.set('authToken', authToken)
  body.set('snapshots', JSON.stringify(snapshots))

  const response = await fetch(apiUrl, {
    body,
    method: 'POST',
    redirect: 'follow',
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`refreshArmyIntelligence failed with HTTP ${response.status}: ${text.slice(0, 180)}`)
  }
  const payload = JSON.parse(text)
  if (payload.success === false) {
    throw new Error(payload.error || 'refreshArmyIntelligence failed.')
  }
}

function pushParticipantSource(sources, source) {
  const armyCode = String(source.armyCode || '').trim()
  if (!armyCode) return

  const armyCodeHash = sha256(armyCode)
  const player = String(source.player || '').trim()
  const sourceType = String(source.sourceType || '').trim()
  const sourceId = String(source.sourceId || '').trim()
  const sourcePlayer = String(source.sourcePlayer || '').trim()

  sources.push({
    ...source,
    armyCode,
    armyCodeHash,
    player,
    snapshotKey: [
      sourceType,
      sourceId,
      sourcePlayer,
      slugKey(player),
      armyCodeHash,
    ].join(':'),
    sourceId,
    sourcePlayer,
    sourceType,
  })
}

function uniqueGames(games) {
  const seen = new Set()
  return games.filter((game) => {
    const key = `${game.id}:${game.gameType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function uniqueSources(sources) {
  const seen = new Set()
  return sources.filter((source) => {
    if (seen.has(source.snapshotKey)) return false
    seen.add(source.snapshotKey)
    return true
  })
}

function tournamentResult(result, player) {
  const winner = String(result.winner || '').trim()
  if (!winner) return ''
  if (winner.toLowerCase() === 'draw') return 'Draw'
  return slugKey(winner) === slugKey(player) ? 'Win' : 'Loss'
}

function formatGameType(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'casual') return 'Casual'
  if (normalized === 'tournament') return 'Tournament'
  return 'League'
}

function slugKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}
