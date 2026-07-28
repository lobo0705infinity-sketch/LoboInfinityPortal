import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fail, pass, repoRoot } from './release-utils.mjs'

const manifest = JSON.parse(
  readFileSync(resolve(repoRoot, 'release/production.json'), 'utf8'),
)

const apiUrl = String(
  process.env.APPS_SCRIPT_URL ||
    process.env.VITE_API_URL ||
    manifest.appsScriptUrl ||
    '',
).trim()

if (!apiUrl) {
  fail('Army Code validation smoke failed', [
    'No Apps Script URL configured. Set APPS_SCRIPT_URL, VITE_API_URL, or release.production appsScriptUrl.',
  ])
}

const url = new URL(apiUrl)
url.searchParams.set('action', 'validateArmyCode')
url.searchParams.set('armyCode', 'bad')

const response = await fetch(url, {
  cache: 'no-store',
  headers: {
    'cache-control': 'no-cache',
  },
})

const body = await response.text()
let json = null

try {
  json = JSON.parse(body)
} catch {
  fail('Army Code validation smoke failed', [
    `validateArmyCode returned non-JSON HTTP ${response.status}.`,
    body.slice(0, 500),
  ])
}

if (response.status !== 200) {
  fail('Army Code validation smoke failed', [
    `validateArmyCode returned HTTP ${response.status}.`,
    JSON.stringify(json).slice(0, 500),
  ])
}

const validation = json.validation || {}
if (json.success !== true) {
  fail('Army Code validation smoke failed', [
    `validateArmyCode success was ${json.success}; expected true.`,
    JSON.stringify(json).slice(0, 500),
  ])
}

if (validation.severity !== 'Error' || validation.status !== 'error') {
  fail('Army Code validation smoke failed', [
    `Invalid Army Code classified as ${validation.severity}/${validation.status}; expected Error/error.`,
  ])
}

if (!Array.isArray(validation.issues) || validation.issues.length === 0) {
  fail('Army Code validation smoke failed', [
    'Invalid Army Code returned no validation issues.',
  ])
}

if (!validation.timestamp) {
  fail('Army Code validation smoke failed', [
    'Validation response did not include a timestamp.',
  ])
}

pass(`validateArmyCode deployed smoke passed at ${url.origin}`)
