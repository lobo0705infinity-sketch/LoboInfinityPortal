import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fail, pass, repoRoot } from './release-utils.mjs'

const productionUrl = process.env.PRODUCTION_URL || 'https://lobo-infinity-portal.vercel.app'
const expectedDeploymentId = process.env.EXPECTED_DEPLOYMENT_ID || ''
const expectedCommit =
  process.env.EXPECTED_GIT_COMMIT ||
  process.env.VITE_BUILD_GIT_COMMIT ||
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
const scope = process.env.VERCEL_SCOPE || 'lobo0705infinity-5309s-projects'
const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')
const kosmoflotPath = 'public/faction-portraits/kosmoflot.png'
const kosmoflotSha256 = sha256(readFileSync(resolve(repoRoot, kosmoflotPath)))

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function normalizeBaseUrl(value) {
  return String(value).replace(/\/+$/, '')
}

async function fetchBuffer(pathname) {
  const url = new URL(pathname, `${normalizeBaseUrl(productionUrl)}/`).toString()
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
    },
  })
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    response,
    url,
  }
}

function inspectAlias() {
  if (dryRun) {
    return {
      id: expectedDeploymentId || 'dpl_dry_run',
      readyState: 'READY',
    }
  }

  const output = execFileSync(
    'npx.cmd',
    [
      '--yes',
      'vercel',
      'inspect',
      productionUrl,
      '--scope',
      scope,
      '--format=json',
    ],
    {
      cwd: resolve(repoRoot, '..'),
      encoding: 'utf8',
    },
  )
  const jsonText = output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1)
  return JSON.parse(jsonText)
}

if (dryRun) {
  pass('post-deploy verification dry run')
  pass(`production URL ${productionUrl}`)
  pass(`expected deployment ${expectedDeploymentId || 'not-provided'}`)
  pass(`expected commit ${expectedCommit}`)
  pass(`local Kosmoflot portrait sha256 ${kosmoflotSha256}`)
  process.exit(0)
}

const failures = []
const alias = inspectAlias()
if (expectedDeploymentId && alias.id !== expectedDeploymentId) {
  failures.push(`alias points to ${alias.id}; expected ${expectedDeploymentId}`)
}
if (alias.readyState !== 'READY') {
  failures.push(`alias deployment is ${alias.readyState}; expected READY`)
}

const fingerprint = await fetchBuffer('/release-fingerprint.json')
let fingerprintJson = null
try {
  fingerprintJson = JSON.parse(fingerprint.buffer.toString('utf8'))
} catch {
  failures.push('/release-fingerprint.json did not return JSON')
}
if (fingerprint.response.status !== 200) {
  failures.push(`/release-fingerprint.json returned HTTP ${fingerprint.response.status}`)
}
if (!fingerprint.response.headers.get('content-type')?.includes('application/json')) {
  failures.push(`/release-fingerprint.json content-type is ${fingerprint.response.headers.get('content-type')}`)
}
if (fingerprintJson?.frontendCommit !== expectedCommit) {
  failures.push(`fingerprint commit is ${fingerprintJson?.frontendCommit}; expected ${expectedCommit}`)
}

const players = await fetchBuffer('/players')
const playersHtml = players.buffer.toString('utf8')
const bundlePath = playersHtml.match(/\/assets\/index-[^"']+\.js/)?.[0]
if (players.response.status !== 200) {
  failures.push(`/players returned HTTP ${players.response.status}`)
}
if (!players.response.headers.get('content-type')?.includes('text/html')) {
  failures.push(`/players content-type is ${players.response.headers.get('content-type')}`)
}
if (!bundlePath) {
  failures.push('/players did not include a frontend index bundle')
}
if (fingerprintJson?.frontendCommit === 'not-provided') {
  failures.push('/players bundle belongs to an untraceable build')
}

const kosmoflot = await fetchBuffer('/faction-portraits/kosmoflot.png')
const kosmoflotContentType = kosmoflot.response.headers.get('content-type') || ''
const liveKosmoflotSha256 = sha256(kosmoflot.buffer)
if (kosmoflot.response.status !== 200) {
  failures.push(`/faction-portraits/kosmoflot.png returned HTTP ${kosmoflot.response.status}`)
}
if (!kosmoflotContentType.includes('image/png')) {
  failures.push(`/faction-portraits/kosmoflot.png content-type is ${kosmoflotContentType}`)
}
if (liveKosmoflotSha256 !== kosmoflotSha256) {
  failures.push(`Kosmoflot SHA-256 is ${liveKosmoflotSha256}; expected ${kosmoflotSha256}`)
}

const missing = await fetchBuffer('/faction-portraits/__missing-production-verify__.png')
const missingContentType = missing.response.headers.get('content-type') || ''
if (missingContentType.includes('image/png')) {
  failures.push('missing static portrait returned a fake image/png response')
}
if (missing.response.status === 200 && missing.buffer.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
  failures.push('missing static portrait returned PNG bytes')
}

if (failures.length) {
  fail('post-deploy production verification failed', failures)
}

pass(`alias ${productionUrl} points to ${alias.id}`)
pass(`fingerprint commit ${expectedCommit}`)
pass(`/players serves bundle ${bundlePath}`)
pass(`kosmoflot portrait sha256 ${liveKosmoflotSha256}`)
pass('missing static assets do not return fake PNG responses')
