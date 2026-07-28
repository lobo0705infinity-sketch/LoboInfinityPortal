import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
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

export function loadViteEnv(mode = 'production') {
  const files = [
    '.env',
    '.env.local',
    `.env.${mode}`,
    `.env.${mode}.local`,
  ]
  const values = {}
  const sources = {}

  files.forEach((file) => {
    const path = resolve(repoRoot, file)
    if (!existsSync(path)) return

    parseEnvFile(readFileSync(path, 'utf8')).forEach(([key, value]) => {
      values[key] = value
      sources[key] = file
    })
  })

  Object.keys(process.env).forEach((key) => {
    if (!key.startsWith('VITE_') && !key.startsWith('RELEASE_') && !key.startsWith('VERCEL_')) {
      return
    }

    values[key] = process.env[key]
    sources[key] = 'process.env'
  })

  return {
    get(name) {
      return values[name] ?? ''
    },
    source(name) {
      return sources[name] ?? ''
    },
    values,
  }
}

export function parseEnvFile(source) {
  return String(source)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      if (index === -1) return null

      const key = line.slice(0, index).trim()
      const value = stripEnvQuotes(line.slice(index + 1).trim())
      return key ? [key, value] : null
    })
    .filter(Boolean)
}

export function validateReleaseManifest({ env, manifest, state }) {
  const expectedUrl = normalizeApiUrl(manifest.appsScriptUrl)
  const actualUrl = normalizeApiUrl(env.get('VITE_API_URL'))
  const actualDeploymentId = extractAppsScriptDeploymentId(actualUrl)
  const failures = []
  const diagnostics = [
    `VITE_API_URL source=${env.source('VITE_API_URL') || '(not found)'}`,
    `manifest=${manifestPath}`,
    `expectedAppsScriptDeploymentId=${manifest.appsScriptDeploymentId}`,
    `actualAppsScriptDeploymentId=${actualDeploymentId || '(none)'}`,
  ]

  if (!expectedUrl) {
    failures.push('release/production.json appsScriptUrl is missing or empty.')
  }

  if (!actualUrl) {
    failures.push(
      'VITE_API_URL is missing or empty. Define it in process.env, .env.local, .env.production, or .env.production.local.',
    )
  }

  if (actualUrl && actualUrl !== expectedUrl) {
    failures.push(
      `VITE_API_URL does not match release/production.json. expected=${expectedUrl} actual=${actualUrl}`,
    )
  }

  if (actualDeploymentId !== manifest.appsScriptDeploymentId) {
    failures.push(
      `Apps Script deployment mismatch. expected=${manifest.appsScriptDeploymentId} actual=${actualDeploymentId || '(none)'}`,
    )
  }

  if (!Number.isInteger(manifest.appsScriptVersion) || manifest.appsScriptVersion <= 0) {
    failures.push('appsScriptVersion must be a positive versioned deployment number.')
  }

  const commitMetadata =
    env.get('VITE_BUILD_GIT_COMMIT') ||
    env.get('VERCEL_GIT_COMMIT_SHA') ||
    state.commit

  if (!commitMetadata || commitMetadata === 'not-provided') {
    failures.push('Git commit metadata is missing.')
  }

  const deploymentMetadata =
    env.get('VITE_BUILD_DEPLOYMENT_ID') ||
    env.get('VERCEL_DEPLOYMENT_ID') ||
    env.get('VERCEL_DEPLOYMENT_URL') ||
    ''

  if (env.get('RELEASE_REQUIRE_DEPLOYMENT_ID') === '1' && (!deploymentMetadata || deploymentMetadata === 'not-provided')) {
    failures.push('Deployment metadata is missing.')
  }

  return {
    actualDeploymentId,
    actualUrl,
    diagnostics,
    failures,
  }
}

export function validateReleaseSourceState({ expectedBranch, state, mode = 'production' }) {
  const productionMode = mode !== 'candidate'
  const failures = []
  const warnings = []

  if (state.detached) {
    failures.push('Current checkout is detached.')
  }

  addPolicyResult({
    condition: state.branch === expectedBranch,
    failure: `Current branch is "${state.branch || '(detached)'}"; expected "${expectedBranch}".`,
    failures,
    productionMode,
    warning: `Candidate source is on "${state.branch || '(detached)'}"; production branch is "${expectedBranch}".`,
    warnings,
  })

  addPolicyResult({
    condition: !state.status,
    failure: 'Worktree is dirty. git status --porcelain must be empty.',
    failures,
    productionMode,
    warning: 'Candidate source has uncommitted changes; production release still requires a clean worktree.',
    warnings,
  })

  addPolicyResult({
    condition: Boolean(state.upstream),
    failure: 'Current branch has no upstream; cannot prove it is current with remote production branch.',
    failures,
    productionMode,
    warning: 'Candidate source has no upstream; production release still requires an upstream.',
    warnings,
  })

  if (state.behind !== null && state.behind > 0) {
    failures.push(`Current branch is behind ${state.upstream} by ${state.behind} commit(s).`)
  }

  return {
    failures,
    mode,
    warnings,
  }
}

function addPolicyResult({ condition, failure, failures, productionMode, warning, warnings }) {
  if (condition) return

  if (productionMode) {
    failures.push(failure)
    return
  }

  warnings.push(warning)
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}
