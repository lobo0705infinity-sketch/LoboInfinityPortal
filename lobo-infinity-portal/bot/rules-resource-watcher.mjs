import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const DEFAULT_RESOURCES_URL = 'http://51.255.44.29/infinity/api/ressources'
export const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
export const DEFAULT_STATE_PATH = resolve(import.meta.dirname, '..', '.tmp', 'rules-resource-watcher.json')

const markdownLinkPattern = /\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g
export function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

export function parseResourceLinks(markdown = '') {
  const links = []
  for (const match of String(markdown).matchAll(markdownLinkPattern)) {
    const [, label, rawUrl] = match
    let url
    try { url = new URL(rawUrl) } catch { continue }
    url.hash = ''
    links.push({ label: label.trim(), url: url.toString() })
  }
  return [...new Map(links.map((link) => [link.url, link])).values()]
    .sort((a, b) => a.url.localeCompare(b.url))
}

export function diffResourceLinks(previous = [], current = []) {
  const before = new Map(previous.map((item) => [item.url, item]))
  const after = new Map(current.map((item) => [item.url, item]))
  return {
    added: current.filter((item) => !before.has(item.url)),
    removed: previous.filter((item) => !after.has(item.url)),
    renamed: current.filter((item) => before.has(item.url) && before.get(item.url).label !== item.label)
      .map((item) => ({ ...item, previousLabel: before.get(item.url).label })),
  }
}

async function readState(path) {
  try { return JSON.parse(await readFile(path, 'utf8')) } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function writeState(path, state) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`)
  await rename(temporary, path)
}

export async function checkRulesResources({
  url = process.env.INFINITY_RESOURCES_API_URL || DEFAULT_RESOURCES_URL,
  statePath = process.env.INFINITY_RESOURCES_STATE_PATH || DEFAULT_STATE_PATH,
  fetchImpl = globalThis.fetch,
  onChange,
  logger = console,
} = {}) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Resources endpoint returned HTTP ${response.status}`)
  const payload = await response.json()
  if (typeof payload?.body_md !== 'string' || !Number.isFinite(Number(payload?.updated_at))) {
    throw new Error('Resources endpoint returned an invalid payload')
  }

  const links = parseResourceLinks(payload.body_md)
  const snapshot = {
    endpointUpdatedAt: Number(payload.updated_at),
    bodySha256: sha256(payload.body_md),
    checkedAt: new Date().toISOString(),
    links,
  }
  const previous = await readState(statePath)
  if (!previous) {
    await writeState(statePath, snapshot)
    logger.info?.(`Infinity resources baseline saved: links=${links.length} updated_at=${snapshot.endpointUpdatedAt}`)
    return { status: 'BASELINED', snapshot, changes: { added: [], removed: [], renamed: [] } }
  }
  if (previous.bodySha256 === snapshot.bodySha256) {
    await writeState(statePath, { ...previous, checkedAt: snapshot.checkedAt, endpointUpdatedAt: snapshot.endpointUpdatedAt })
    return { status: 'UNCHANGED', snapshot, changes: { added: [], removed: [], renamed: [] } }
  }

  const changes = diffResourceLinks(previous.links || [], links)
  if (changes.added.length && onChange) await onChange({ previous, snapshot, changes })
  await writeState(statePath, snapshot)
  logger.info?.(`Infinity resources changed: added=${changes.added.length} removed=${changes.removed.length} renamed=${changes.renamed.length}`)
  return { status: 'CHANGED', snapshot, changes }
}

export function startRulesResourceWatcher(options = {}) {
  if (String(process.env.INFINITY_RESOURCES_ANNOUNCER_ENABLED || 'true').toLowerCase() === 'false') {
    return { stop() {}, runNow: async () => ({ status: 'DISABLED' }) }
  }
  const intervalMs = Math.max(60_000, Number(process.env.INFINITY_RESOURCES_CHECK_INTERVAL_MS) || DEFAULT_CHECK_INTERVAL_MS)
  let stopped = false
  let running = null
  const runNow = async () => {
    if (running) return running
    running = checkRulesResources(options)
      .catch((error) => {
        options.logger?.error?.(`Infinity resources check failed: ${error instanceof Error ? error.message : String(error)}`)
        return { status: 'ERROR', error }
      })
      .finally(() => { running = null })
    return running
  }
  const timer = setInterval(() => { if (!stopped) void runNow() }, intervalMs)
  timer.unref?.()
  void runNow()
  return { stop() { stopped = true; clearInterval(timer) }, runNow }
}
