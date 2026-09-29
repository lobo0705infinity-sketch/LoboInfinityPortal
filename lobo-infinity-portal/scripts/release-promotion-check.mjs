import { fail, pass, readManifest } from './release-utils.mjs'

const manifest = readManifest()
const stagingUrl = process.env.STAGING_URL || ''
const productionUrl = process.env.PRODUCTION_URL || `https://${manifest.productionAlias}`
const bypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '').trim()
const fetchOptions = bypass
  ? { headers: { 'x-vercel-protection-bypass': bypass } }
  : undefined

if (!stagingUrl) {
  fail('STAGING_URL is required for promotion validation')
}

async function fetchJson(url) {
  const response = await fetch(url, fetchOptions)
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`)
  }
  return response.json()
}

async function fetchBundle(baseUrl) {
  const htmlResponse = await fetch(baseUrl, fetchOptions)
  if (!htmlResponse.ok) {
    throw new Error(`${baseUrl} returned HTTP ${htmlResponse.status}`)
  }
  const html = await htmlResponse.text()
  const bundlePaths = [...new Set(
    [...html.matchAll(/(?:src|href)=["']([^"']+\.js)["']/g)].map((match) => match[1]),
  )]
  if (!bundlePaths.length) {
    throw new Error(`${baseUrl} has no JavaScript assets`)
  }
  const bundles = await Promise.all(bundlePaths.map(async (bundlePath) => {
    const response = await fetch(new URL(bundlePath, baseUrl).toString(), fetchOptions)
    if (!response.ok) {
      throw new Error(`${bundlePath} returned HTTP ${response.status}`)
    }
    return response.text()
  }))
  return {
    bundle: bundles.join('\n'),
    bundlePath: bundlePaths.join(', '),
  }
}

const failures = []

try {
  const stagingFingerprint = await fetchJson(new URL('/release-fingerprint.json', stagingUrl).toString())
  const { bundle, bundlePath } = await fetchBundle(stagingUrl)

  if (stagingFingerprint.appsScriptDeploymentId !== manifest.appsScriptDeploymentId) {
    failures.push(`Staging Apps Script deployment mismatch. expected=${manifest.appsScriptDeploymentId} actual=${stagingFingerprint.appsScriptDeploymentId}`)
  }
  if (stagingFingerprint.appsScriptVersion !== manifest.appsScriptVersion) {
    failures.push(`Staging Apps Script version mismatch. expected=${manifest.appsScriptVersion} actual=${stagingFingerprint.appsScriptVersion}`)
  }
  if (!stagingFingerprint.frontendCommit || stagingFingerprint.frontendCommit === 'not-provided') {
    failures.push('Staging fingerprint is missing frontendCommit.')
  }
  if (!stagingFingerprint.vercelDeploymentId || stagingFingerprint.vercelDeploymentId === 'not-provided') {
    failures.push('Staging fingerprint is missing vercelDeploymentId.')
  }
  if (!bundle.includes(manifest.appsScriptDeploymentId)) {
    failures.push(`Staging bundle ${bundlePath} does not embed the approved Apps Script deployment.`)
  }

  pass(`staging fingerprint ${stagingFingerprint.frontendCommit} ${stagingFingerprint.vercelDeploymentId}`)
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
}

if (process.env.COMPARE_PRODUCTION === '1') {
  try {
    const stagingFingerprint = await fetchJson(new URL('/release-fingerprint.json', stagingUrl).toString())
    const productionFingerprint = await fetchJson(new URL('/release-fingerprint.json', productionUrl).toString())
    if (stagingFingerprint.frontendCommit !== productionFingerprint.frontendCommit) {
      failures.push('Staging and production fingerprints differ after promotion.')
    }
    if (stagingFingerprint.appsScriptDeploymentId !== productionFingerprint.appsScriptDeploymentId) {
      failures.push('Staging and production backend deployment IDs differ after promotion.')
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  }
}

if (failures.length) {
  fail('promotion validation failed', failures)
}

pass(`staging deployment is eligible for alias promotion to ${manifest.productionAlias}`)
