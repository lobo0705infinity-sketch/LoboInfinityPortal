import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import serverlessChromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import { timingSafeEqual } from 'node:crypto'
import {
  ARMY_INTELLIGENCE_DECODER_VERSION,
  decodeArmyListToFiles,
} from '../scripts/infinity-army-decode.mjs'
import { createCanonicalEnricher } from '../scripts/army-intelligence-canonical-enrichment.mjs'
import {
  ARMY_INTELLIGENCE_PIPELINE_VERSION,
  ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION,
  snapshotHasCompleteTacticalMetadata,
} from '../scripts/army-intelligence-snapshot-schema.mjs'

const require = createRequire(import.meta.url)
const CanonicalSnapshotFactory = require('../backend/CanonicalSnapshotFactory.gs')

const DEFAULT_REFRESH_BATCH_LIMIT = 100
const APPS_SCRIPT_FETCH_ATTEMPTS = 3

export default async function handler(request, response) {
  const automatic = isScheduledRequest(request)
  const scopedBackfill = Boolean(request.headers?.['x-army-backfill-token'])

  if (!automatic && request.method !== 'POST') {
    response.setHeader('allow', 'GET, POST')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  try {
    const body = request.method === 'POST' ? await readJsonBody(request) : {}
    const apiUrl = String(body.apiUrl || process.env.VITE_API_URL || '').trim()
    const sessionToken = String(body.sessionToken || '').trim()
    const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
    const backfillToken = String(process.env.ARMY_INTELLIGENCE_BACKFILL_TOKEN || '').trim()
    const batchLimit = Math.max(1, Number(body.batchLimit) || DEFAULT_REFRESH_BATCH_LIMIT)
    const requestedSectorial = String(body.sectorial || '').trim()
    const publishPublicSnapshot = automatic && body.publishPublicSnapshot === true
    const deferReadModelRebuild = scopedBackfill && body.deferReadModelRebuild === true
    const finalizeMigration = scopedBackfill && body.finalizeMigration === true
    const dryRun = scopedBackfill && body.dryRun === true
    const exportSources = body.exportSources === true
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

    if (exportSources && !isAuthorizedBackfillRequest(request, backfillToken)) {
      response.status(401).json({ error: 'Backfill authentication is required for source export.', success: false })
      return
    }

    if (automatic && !isAuthorizedScheduledRequest(request, workerToken, backfillToken)) {
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

    const authoritativeSources = await loadAuthoritativeSources(apiUrl, upstreamCredential)

    if (exportSources) {
      response.status(200).json({
        sources: authoritativeSources.map(exportAuthoritativeSource),
        success: true,
        totalDistinctLists: new Set(authoritativeSources.map((source) => source.snapshotKey)).size,
      })
      return
    }

    const sources = filterRequestedSources(
      authoritativeSources,
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

    if (dryRun) {
      const keyCounts = new Map()
      for (const source of sources) keyCounts.set(source.snapshotKey, (keyCounts.get(source.snapshotKey) || 0) + 1)
      response.status(200).json({
        audit: true,
        currentVersionSnapshots: currentCount,
        duplicateSnapshotKeys: Array.from(keyCounts).filter(([, count]) => count > 1).map(([snapshotKey, count]) => ({ snapshotKey, count })),
        missingStoredSnapshots: sources.filter((source) => !state.has(source.snapshotKey)).map((source) => source.snapshotKey),
        obsoleteSnapshots: allCandidates.map((source) => source.snapshotKey),
        pipelineVersion: ARMY_INTELLIGENCE_PIPELINE_VERSION,
        staleSnapshots: allCandidates.length,
        storedSnapshots: state.size,
        success: true,
        sourceSnapshotKeys: sources.map((source) => source.snapshotKey),
        totalDistinctLists: new Set(sources.map((source) => source.snapshotKey)).size,
      })
      return
    }

    const outputDir = await mkdtemp(join(tmpdir(), 'lobo-army-intelligence-'))
    const snapshots = []
    const failures = []
    const processed = []

    let browser
    let enrich
    try {
      browser = await playwrightChromium.launch({
        args: serverlessChromium.args,
        executablePath: await serverlessChromium.executablePath(),
        headless: true,
      })
      enrich = await createCanonicalEnricher({ browser, cacheDir: join(outputDir, 'fireteams') })
    } catch (error) {
      failures.push({ reason: `Canonical enrichment unavailable: ${error instanceof Error ? error.message : String(error)}`, snapshotKey: '' })
    }
    for (const source of candidates) {
      try {
    const result = await decodeArmyListToFiles({
          input: source.armyCode,
          outputDir,
    })
        if (!enrich) throw new Error('Canonical enrichment unavailable; decoded snapshot was not persisted.')
        const enriched = await enrich(result.list)
        if (enriched.enrichment?.status !== 'complete') {
          const detail = [`fireteamStatus=${enriched.enrichment?.fireteamStatus || 'unknown'}`, `unitCount=${enriched.enrichment?.unitCount ?? 0}`, enriched.enrichment?.warning ? `warning=${enriched.enrichment.warning}` : ''].filter(Boolean).join('; ')
          throw new Error(`Canonical enrichment incomplete (${detail}); decoded snapshot was not persisted.`)
        }
        snapshots.push(
          CanonicalSnapshotFactory.createSourceRefreshSnapshot(
            source,
            enriched,
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
    await browser?.close()

    if (snapshots.length > 0 || publishPublicSnapshot || finalizeMigration) {
      await postSnapshots(apiUrl, snapshots, upstreamCredential, {
        deferReadModelRebuild,
        finalizeMigration,
        publishPublicSnapshot,
      })
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

export function exportAuthoritativeSource(source) {
  return {
    snapshotKey: String(source.snapshotKey || ''),
    armyCode: String(source.armyCode || ''),
    armyListId: String(source.armyListId || ''),
    player: String(source.player || ''),
    sourceId: String(source.sourceId || ''),
    sourcePlayer: String(source.sourcePlayer || ''),
    faction: String(source.faction || ''),
    sectorial: String(source.sectorial || ''),
    sourceType: String(source.sourceType || ''),
  }
}

export function selectRefreshCandidates(sources, state) {
  return sources.filter((source) => {
    const current = state.get(source.snapshotKey)
    const unchangedCurrentSchemaFailure = Boolean(
      current &&
      current.armyCodeHash === source.armyCodeHash &&
      current.status === 'failed' &&
      current.pipelineVersion === ARMY_INTELLIGENCE_PIPELINE_VERSION &&
      current.tacticalSchemaVersion === ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION
    )
    if (unchangedCurrentSchemaFailure) return false
    return (
      !current ||
      current.armyCodeHash !== source.armyCodeHash ||
      current.status !== 'decoded' ||
      current.pipelineVersion !== ARMY_INTELLIGENCE_PIPELINE_VERSION ||
      current.decoderVersion !== ARMY_INTELLIGENCE_DECODER_VERSION ||
      current.tacticalSchemaVersion !== ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION ||
      !current.hasProfileMetadata ||
      !current.hasTacticalMetadata
    )
  })
}

function isAuthorizedScheduledRequest(request, workerToken, backfillToken = '') {
  const authorization = String(request.headers?.authorization || '').trim()
  const suppliedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
  const suppliedBackfillSecret = String(request.headers?.['x-army-backfill-token'] || '').trim()

  return Boolean(
    (workerToken && safeEqual(suppliedSecret, workerToken)) ||
    (backfillToken && safeEqual(suppliedBackfillSecret, backfillToken)),
  )
}

function isAuthorizedBackfillRequest(request, backfillToken) {
  const supplied = String(request.headers?.['x-army-backfill-token'] || '').trim()
  return Boolean(backfillToken && safeEqual(supplied, backfillToken))
}

function isScheduledRequest(request) {
  const authorization = String(request.headers?.authorization || '').trim()
  return request.method === 'GET' || Boolean(request.headers?.['x-army-backfill-token']) || (
    request.method === 'POST' && authorization.startsWith('Bearer ')
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
      pipelineVersion: list.pipelineVersion || list.decoded?.pipelineVersion || '',
      hasProfileMetadata: snapshotHasDecodedProfileMetadata(list),
      hasTacticalMetadata: snapshotHasTacticalMetadata(list),
      tacticalSchemaVersion: list.tacticalSchemaVersion || list.decoded?.tacticalSchemaVersion || '',
      status: list.status,
    })
  }
  return state
}

function snapshotHasTacticalMetadata(list) {
  return snapshotHasCompleteTacticalMetadata(list)
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
  const response = await fetchAppsScriptWithRetry(url, { redirect: 'follow' })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${action} failed with HTTP ${response.status}: ${text}`)
  }
  return JSON.parse(text)
}

async function postSnapshots(apiUrl, snapshots, credential, options = {}) {
  const body = new URLSearchParams()
  body.set('action', 'refreshArmyIntelligence')
  for (const [key, value] of Object.entries(credential)) {
    body.set(key, value)
  }
  body.set('snapshots', JSON.stringify(snapshots))
  if (options.deferReadModelRebuild) body.set('deferReadModelRebuild', 'true')
  if (options.finalizeMigration) body.set('finalizeMigration', 'true')
  if (options.publishPublicSnapshot) body.set('publishPublicSnapshot', 'true')

  const response = await fetchAppsScriptWithRetry(apiUrl, {
    body,
    method: 'POST',
    redirect: 'follow',
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`refreshArmyIntelligence failed with HTTP ${response.status}: ${text}`)
  }
  const payload = JSON.parse(text)
  if (payload.success === false) {
    throw new Error(payload.error || payload.message || 'refreshArmyIntelligence failed.')
  }
}

async function fetchAppsScriptWithRetry(url, options) {
  let lastResponse
  for (let attempt = 1; attempt <= APPS_SCRIPT_FETCH_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, options)
    if (response.ok) return response

    const text = await response.text()
    lastResponse = new Response(text, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    })
    const transientGoogleResponse = response.status === 404 && /unable to open the file|Page Not Found/i.test(text)
    if (!transientGoogleResponse || attempt === APPS_SCRIPT_FETCH_ATTEMPTS) return lastResponse
    await new Promise((resolve) => setTimeout(resolve, attempt * 500))
  }
  return lastResponse
}
