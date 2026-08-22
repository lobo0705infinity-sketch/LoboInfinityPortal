import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { timingSafeEqual } from 'node:crypto'
import {
  ARMY_INTELLIGENCE_DECODER_VERSION,
  decodeArmyListToFiles,
} from '../scripts/infinity-army-decode.mjs'

const require = createRequire(import.meta.url)
const CanonicalSnapshotFactory = require('../backend/CanonicalSnapshotFactory.gs')

const DEFAULT_REFRESH_BATCH_LIMIT = 4

export default async function handler(request, response) {
  const automatic = request.method === 'GET'

  if (!automatic && request.method !== 'POST') {
    response.setHeader('allow', 'GET, POST')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  try {
    const body = automatic ? {} : await readJsonBody(request)
    const apiUrl = String(body.apiUrl || process.env.VITE_API_URL || '').trim()
    const sessionToken = String(body.sessionToken || '').trim()
    const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
    const batchLimit = Math.max(1, Number(body.batchLimit) || DEFAULT_REFRESH_BATCH_LIMIT)
    const requestedSectorial = String(body.sectorial || '').trim()
    const requestedSnapshotKeys = Array.isArray(body.snapshotKeys)
      ? new Set(body.snapshotKeys.map((key) => String(key || '').trim()).filter(Boolean))
      : new Set()
    const excludedSnapshotKeys = Array.isArray(body.excludeSnapshotKeys)
      ? new Set(body.excludeSnapshotKeys.map((key) => String(key || '').trim()).filter(Boolean))
      : new Set()

    if (!apiUrl) {
      response.status(500).json({ error: 'Missing API URL.', success: false })
      return
    }

    if (automatic && !isAuthorizedCronRequest(request, workerToken)) {
      response.status(401).json({ error: 'Automatic refresh authentication is required.', success: false })
      return
    }

    if (!automatic && !sessionToken) {
      response.status(401).json({ error: 'Commissioner authentication is required.', success: false })
      return
    }

    if (automatic && !workerToken) {
      response.status(500).json({ error: 'Automatic refresh credential is unavailable.', success: false })
      return
    }

    const upstreamCredential = automatic
      ? { workerToken }
      : { sessionToken }

    const sources = filterRequestedSources(
      await loadAuthoritativeSources(apiUrl, upstreamCredential),
      {
        sectorial: requestedSectorial,
        excludeSnapshotKeys: excludedSnapshotKeys,
        snapshotKeys: requestedSnapshotKeys,
      },
    )
    const state = await loadSnapshotState(apiUrl)
    const allCandidates = selectRefreshCandidates(sources, state)
    const currentCount = sources.length - allCandidates.length
    const candidates = allCandidates.slice(0, batchLimit)

    const outputDir = await mkdtemp(join(tmpdir(), 'lobo-army-intelligence-'))
    const snapshots = []
    const failures = []
    const processed = []

    for (const source of candidates) {
      try {
        const result = await decodeArmyListToFiles({
          input: source.armyCode,
          outputDir,
        })
        snapshots.push(
          CanonicalSnapshotFactory.createSourceRefreshSnapshot(
            source,
            result.list,
            '',
            'decoded',
          ),
        )
        processed.push({
          listName: result.list?.listName || source.mission || '',
          player: source.player,
          sectorial: result.list?.sectorial || source.sectorial || '',
          snapshotKey: source.snapshotKey,
          status: 'decoded',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const failure = {
          listName: source.mission || source.event || '',
          player: source.player,
          reason: message,
          sectorial: source.sectorial || '',
          snapshotKey: source.snapshotKey,
        }
        failures.push(failure)
        snapshots.push(
          CanonicalSnapshotFactory.createSourceRefreshSnapshot(
            source,
            null,
            message,
            'failed',
          ),
        )
        processed.push({
          ...failure,
          status: 'failed',
        })
      }
    }

    if (snapshots.length > 0) {
      await postSnapshots(apiUrl, snapshots, upstreamCredential)
    }

    response.status(200).json({
      candidateCount: allCandidates.length,
      currentCount,
      decoded: snapshots.filter((snapshot) => snapshot.status === 'decoded').length,
      failed: failures.length,
      failures,
      hasMore: allCandidates.length > candidates.length,
      processed,
      remaining: Math.max(0, allCandidates.length - candidates.length),
      requestedSectorial,
      requestedSnapshotKeys: Array.from(requestedSnapshotKeys),
      skipped: currentCount,
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

export function selectRefreshCandidates(sources, state) {
  return sources.filter((source) => {
    const current = state.get(source.snapshotKey)
    return (
      !current ||
      current.armyCodeHash !== source.armyCodeHash ||
      current.status !== 'decoded' ||
      current.decoderVersion !== ARMY_INTELLIGENCE_DECODER_VERSION ||
      !current.hasProfileMetadata
    )
  })
}

function isAuthorizedCronRequest(request, workerToken) {
  const configuredCronSecret = String(process.env.CRON_SECRET || '').trim()
  const authorization = String(request.headers?.authorization || '').trim()
  const suppliedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''

  return Boolean(
    workerToken &&
    configuredCronSecret &&
    safeEqual(suppliedSecret, configuredCronSecret),
  )
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function filterRequestedSources(sources, filters) {
  return sources.filter((source) => {
    if (filters.excludeSnapshotKeys.size > 0 && filters.excludeSnapshotKeys.has(source.snapshotKey)) {
      return false
    }

    if (filters.snapshotKeys.size > 0 && !filters.snapshotKeys.has(source.snapshotKey)) {
      return false
    }

    if (filters.sectorial && source.sectorial !== filters.sectorial) {
      return false
    }

    return true
  })
}

async function loadAuthoritativeSources(apiUrl, credential) {
  const payload = await getAction(apiUrl, 'armyIntelligenceSources', credential)
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

async function postSnapshots(apiUrl, snapshots, credential) {
  const body = new URLSearchParams()
  body.set('action', 'refreshArmyIntelligence')
  for (const [key, value] of Object.entries(credential)) {
    body.set(key, value)
  }
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
