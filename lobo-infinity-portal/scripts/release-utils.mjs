import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const manifestPath = resolve(repoRoot, 'release', 'production.json')

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function readManifest() {
  return readJson(manifestPath)
}

export function git(args, options = {}) {
  return execFileSync('git', ['-c', `safe.directory=${resolve(repoRoot, '..')}`, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function command(args, options = {}) {
  return execFileSync(args[0], args.slice(1), {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function fail(message, details = []) {
  console.error(`FAIL: ${message}`)
  details.filter(Boolean).forEach((detail) => console.error(`- ${detail}`))
  process.exit(1)
}

export function pass(message) {
  console.log(`PASS: ${message}`)
}

export function normalizeApiUrl(url) {
  return String(url ?? '').trim().replace(/\/+$/, '')
}

export function extractAppsScriptDeploymentId(url) {
  const match = String(url ?? '').match(/\/macros\/s\/([^/]+)\/exec\/?$/)
  return match ? match[1] : ''
}

export function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16)
}

export function currentGitState() {
  const branch = git(['branch', '--show-current'])
  const commit = git(['rev-parse', 'HEAD'])
  const status = git(['status', '--porcelain'])
  const upstream = (() => {
    try {
      return git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
    } catch {
      return ''
    }
  })()
  const behind = (() => {
    if (!upstream) {
      return null
    }
    const counts = git(['rev-list', '--left-right', '--count', `${upstream}...HEAD`])
      .split(/\s+/)
      .map(Number)
    return Number.isFinite(counts[0]) ? counts[0] : null
  })()

  return {
    behind,
    branch,
    commit,
    detached: branch === '',
    status,
    upstream,
  }
}
