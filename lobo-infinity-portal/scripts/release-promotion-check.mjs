import { fail, pass, readManifest } from './release-utils.mjs'

const manifest = readManifest()
const stagingUrl = process.env.STAGING_URL || ''
const productionUrl = process.env.PRODUCTION_URL || `https://${manifest.productionAlias}`

if (!stagingUrl) {
  fail('STAGING_URL is required for promotion validation')
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`)
  }
  return response.json()
}

async function fetchBundle(baseUrl) {
  const htmlResponse = await fetch(baseUrl)
  if (!htmlResponse.ok) {
    throw new Error(`${baseUrl} returned HTTP ${htmlResponse.status}`)
  }
  const html = await htmlResponse.text()
  const bundlePath = html.match(/\/assets\/index-[^"']+\.js/)?.[0]
  if (!bundlePath) {
    throw new Error(`${baseUrl} has no index bundle`)
  }
  const bundleResponse = await fetch(new URL(bundlePath, baseUrl).toString())
  if (!bundleResponse.ok) {
    throw new Error(`${bundlePath} returned HTTP ${bundleResponse.status}`)
  }
  return {
    bundle: await bundleResponse.text(),
    bundlePath,
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
