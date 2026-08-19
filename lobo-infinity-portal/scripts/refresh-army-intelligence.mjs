#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import {
  ARMY_INTELLIGENCE_DECODER_VERSION,
  decodeArmyListToFiles,
} from './infinity-army-decode.mjs'

const require = createRequire(import.meta.url)
const CanonicalSnapshotFactory = require('../backend/CanonicalSnapshotFactory.gs')
const CanonicalSourceDiscovery = require('../backend/CanonicalSourceDiscovery.gs')
const CanonicalArmyCodeResolver = require('../backend/CanonicalArmyCodeResolver.gs')

const args = new Set(process.argv.slice(2))
const options = parseArgs(process.argv.slice(2))
const dryRun = args.has('--dry-run') || !args.has('--write')
const useFixture = args.has('--fixture')
const limit = Number(options.limit || 0)
const outDir = resolve(options.outDir || '.tmp/army-intelligence-refresh')
const decodedDir = resolve(outDir, 'decoded')

const sources = useFixture
  ? fixtureSources()
  : await loadLiveSources(options.apiUrl || await readApiUrl(), readSessionToken(options))
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

    snapshots.push(
      CanonicalSnapshotFactory.createSourceRefreshSnapshot(
        source,
        result.list,
        '',
        'decoded',
      ),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push({
      reason: message,
      snapshotKey: source.snapshotKey,
    })
    snapshots.push(
      CanonicalSnapshotFactory.createSourceRefreshSnapshot(
        source,
        null,
        message,
        'failed',
      ),
    )
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
  await postSnapshots(options.apiUrl || await readApiUrl(), snapshots, readSessionToken(options))
}

console.log(JSON.stringify({
  decoded: payload.decoded,
  dryRun,
  failed: failures.length,
  payloadPath,
  skipped: payload.skipped,
  sources: payload.sources,
}, null, 2))

async function loadLiveSources(apiUrl, sessionToken) {
  const payload = await getAction(apiUrl, 'armyIntelligenceSources', { sessionToken })
  return Array.isArray(payload.sources) ? payload.sources : []
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
      Object.hasOwn(entry, 'structure') &&
      Object.hasOwn(entry, 'weapons') &&
      Object.hasOwn(entry, 'equipment'),
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

async function postSnapshots(apiUrl, snapshots, sessionToken = '') {
  const body = new URLSearchParams()
  body.set('action', 'refreshArmyIntelligence')
  body.set('snapshots', JSON.stringify(snapshots))
  if (sessionToken) {
    body.set('sessionToken', sessionToken)
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

function readSessionToken(options) {
  return String(options.sessionToken || process.env.LOBO_SESSION_TOKEN || '').trim()
}

function nodeDiscoveryOptions({ deduplicateGames, eventNames, games, tournamentResults }) {
  return {
    deduplicateGames,
    formatGameType,
    games,
    hashArmyCode: sha256,
    includeArmyListId: false,
    normalizeAll: false,
    normalizeKey: slugKey,
    normalizeString: (value) => String(value || '').trim(),
    resolveArmyCode: (game, side) => CanonicalArmyCodeResolver.resolveGameSideCode(
      game,
      side,
      (value) => String(value || '').trim(),
    ),
    resolveEventName: (game) => game.eventName || eventNames.get(game.eventId) || game.eventId || '',
    sources: [],
    tournamentResult,
    tournamentResults,
  }
}

function matchesSourceFilters(source, filters) {
  if (filters.sourceType && source.sourceType !== filters.sourceType) return false
  if (filters.sourceId && String(source.sourceId) !== String(filters.sourceId)) return false
  if (filters.sourcePlayer && source.sourcePlayer !== filters.sourcePlayer) return false
  return true
}

function fixtureSources() {
  const discoveryOptions = nodeDiscoveryOptions({
    deduplicateGames: false,
    eventNames: new Map(),
    games: [],
    tournamentResults: [],
  })
  discoveryOptions.sources = [{
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
  }]
  return CanonicalSourceDiscovery.discover(discoveryOptions)
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
  return require('node:crypto').createHash('sha256').update(String(value)).digest('hex')
}

function slugKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
