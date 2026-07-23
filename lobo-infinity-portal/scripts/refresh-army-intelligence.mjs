#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  ARMY_INTELLIGENCE_DECODER_VERSION,
  decodeArmyListToFiles,
} from './infinity-army-decode.mjs'

const args = new Set(process.argv.slice(2))
const options = parseArgs(process.argv.slice(2))
const dryRun = args.has('--dry-run') || !args.has('--write')
const useFixture = args.has('--fixture')
const limit = Number(options.limit || 0)
const outDir = resolve(options.outDir || '.tmp/army-intelligence-refresh')
const decodedDir = resolve(outDir, 'decoded')

const sources = useFixture
  ? fixtureSources()
  : await loadLiveSources(options.apiUrl || await readApiUrl())
const snapshotState = useFixture
  ? new Map()
  : await loadSnapshotState(options.apiUrl || await readApiUrl()).catch(() => new Map())

const candidates = sources
  .filter((source) => source.armyCode)
  .filter((source) => matchesSourceFilters(source, options))
  .filter((source) => {
    const current = snapshotState.get(source.snapshotKey)
    return (
      !current ||
      current.armyCodeHash !== source.armyCodeHash ||
      current.status !== 'decoded' ||
      current.decoderVersion !== ARMY_INTELLIGENCE_DECODER_VERSION ||
      !current.hasProfileMetadata
    )
  })
  .slice(0, limit > 0 ? limit : undefined)

await mkdir(outDir, { recursive: true })
await mkdir(decodedDir, { recursive: true })

const snapshots = []
const failures = []

for (const source of candidates) {
  try {
    const result = await decodeArmyListToFiles({
      input: source.armyCode,
      outputDir: decodedDir,
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

const payload = {
  decoded: snapshots.filter((snapshot) => snapshot.status === 'decoded').length,
  dryRun,
  failures,
  generatedAt: new Date().toISOString(),
  skipped: sources.length - candidates.length,
  snapshots,
  sources: sources.length,
}

const payloadPath = resolve(outDir, 'army-intelligence-refresh-payload.json')
await writeFile(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

if (!dryRun && snapshots.length > 0) {
  await postSnapshots(options.apiUrl || await readApiUrl(), snapshots, readAuthToken(options))
}

console.log(JSON.stringify({
  decoded: payload.decoded,
  dryRun,
  failed: failures.length,
  payloadPath,
  skipped: payload.skipped,
  sources: payload.sources,
}, null, 2))

async function loadLiveSources(apiUrl) {
  const targetedCasualGame =
    options.sourceType === 'casual' && options.sourceId
      ? getAction(apiUrl, 'recentGames', { gameId: options.sourceId, gameType: 'casual' }).then((payload) => payload.games || [])
      : Promise.resolve([])
  const [recentGames, casualGames, sourceIdCasualGames, events] = await Promise.all([
    getAction(apiUrl, 'recentGames').then((payload) => payload.games || []),
    getAction(apiUrl, 'recentGames', { gameType: 'casual' }).then((payload) => payload.games || []),
    targetedCasualGame,
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

  for (const game of [...recentGames, ...casualGames, ...sourceIdCasualGames]) {
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

async function postSnapshots(apiUrl, snapshots, authToken = '') {
  const body = new URLSearchParams()
  body.set('action', 'refreshArmyIntelligence')
  body.set('snapshots', JSON.stringify(snapshots))
  if (authToken) {
    body.set('authToken', authToken)
  }

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

function readAuthToken(options) {
  return String(options.authToken || process.env.LOBO_GOOGLE_ID_TOKEN || process.env.GOOGLE_ID_TOKEN || '').trim()
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

function uniqueSources(sources) {
  const seen = new Set()
  return sources.filter((source) => {
    if (seen.has(source.snapshotKey)) return false
    seen.add(source.snapshotKey)
    return true
  })
}

function matchesSourceFilters(source, filters) {
  if (filters.sourceType && source.sourceType !== filters.sourceType) return false
  if (filters.sourceId && String(source.sourceId) !== String(filters.sourceId)) return false
  if (filters.sourcePlayer && source.sourcePlayer !== filters.sourcePlayer) return false
  return true
}

function fixtureSources() {
  const sources = []
  pushParticipantSource(sources, {
    armyCode: 'gr8Kb3BlcmF0aW9ucwhGb3IgV29ya4EsAgEBAAUAhK0BAgAAhusBAgAAh2oBBQAAgkgBBgAAh1IBAQACAQAKAIJQAQEAAIJTAQEAAIJTAQEAADIBAQAAh28CAQAAh28CAQAAh28BAgAAh0YBAgAAglQBAQAAh2YBAgA%3D',
    date: '2026-07-03',
    event: 'Fixture',
    faction: 'ALEPH',
    gameType: 'League',
    mission: 'Hardlock',
    opponent: '',
    player: 'Lobo',
    result: '',
    sectorial: 'Operations Subsection',
    sourceId: 'fixture-1',
    sourcePlayer: 'winner',
    sourceType: 'league',
  })
  return sources
}

async function readApiUrl() {
  const env = await readFile('.env.local', 'utf8')
  const apiUrl = env.match(/^VITE_API_URL=(.+)$/m)?.[1]?.trim()
  if (!apiUrl) throw new Error('VITE_API_URL is required in .env.local or --api-url.')
  return apiUrl
}

function parseArgs(values) {
  const parsed = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith('--')) continue
    const key = toCamelOption(value.slice(2))
    const next = values[index + 1]
    if (next && !next.startsWith('--')) {
      parsed[key] = next
      index += 1
    } else {
      parsed[key] = 'true'
    }
  }
  return parsed
}

function toCamelOption(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
}

function formatGameType(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'casual') return 'Casual'
  if (normalized === 'tournament') return 'Tournament'
  return 'League'
}

function tournamentResult(result, player) {
  const winner = String(result.winner || '').trim()
  if (!winner) return ''
  if (winner.toLowerCase() === 'draw') return 'Draw'
  return slugKey(winner) === slugKey(player) ? 'Win' : 'Loss'
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function slugKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
