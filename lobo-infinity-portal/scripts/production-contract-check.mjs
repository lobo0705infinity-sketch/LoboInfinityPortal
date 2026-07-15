import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fail, pass, readManifest, repoRoot } from './release-utils.mjs'

const manifest = readManifest()
const targetUrl = process.env.CONTRACT_BASE_URL || ''

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function assertIncludes(name, haystack, markers, failures) {
  markers.forEach((marker) => {
    if (!haystack.includes(marker)) {
      failures.push(`${name} is missing required marker: ${marker}`)
    }
  })
}

function assertExcludes(name, haystack, markers, failures) {
  markers.forEach((marker) => {
    if (haystack.includes(marker)) {
      failures.push(`${name} contains forbidden marker: ${marker}`)
    }
  })
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`)
  }
  return response.text()
}

async function readDeployedBundle(baseUrl) {
  const html = await fetchText(baseUrl)
  const bundlePath = html.match(/\/assets\/index-[^"']+\.js/)?.[0]
  if (!bundlePath) {
    throw new Error('Could not find production index bundle in deployed HTML.')
  }
  const bundle = await fetchText(new URL(bundlePath, baseUrl).toString())
  return { bundle, bundlePath, html }
}

const failures = []

const sidebar = read('src/components/sidebarNavigation.ts')
const commissionerSidebar = sidebar.slice(sidebar.indexOf('export const commissionerItems'))
assertIncludes(
  'Commissioner navigation',
  commissionerSidebar,
  manifest.contractMarkers.commissionerNavigation,
  failures,
)
assertIncludes(
  'Commissioner route definitions',
  read('src/App.tsx'),
  manifest.contractMarkers.commissionerRoutes,
  failures,
)
assertExcludes(
  'Commissioner top-level navigation',
  commissionerSidebar,
  manifest.forbiddenActiveMarkers.legacyCommissionerTopLevel,
  failures,
)

const myProfile = read('src/pages/MyProfile.tsx')
assertIncludes('My Profile identity', myProfile, manifest.contractMarkers.myProfileIdentity, failures)
assertIncludes('My Profile 3.0 UX', myProfile, manifest.contractMarkers.myProfileUx, failures)
assertExcludes('My Profile 3.0 UX', myProfile, manifest.forbiddenActiveMarkers.removedMyProfileUx, failures)

const identityService = read('backend/IdentityService.gs')
assertIncludes(
  'Authentication hardening',
  identityService,
  manifest.contractMarkers.authenticationHardening.filter((marker) => marker !== 'VITE_API_URL'),
  failures,
)

const apiCore = read('src/services/apiCore.ts')
assertIncludes('Missing API config handling', apiCore, ['VITE_API_URL'], failures)

if (targetUrl) {
  try {
    const { bundle, bundlePath, html } = await readDeployedBundle(targetUrl)
    assertIncludes('Deployed bundle API endpoint', bundle, [manifest.appsScriptDeploymentId], failures)
    assertExcludes('Deployed bundle untraceable metadata', bundle, manifest.forbiddenActiveMarkers.untraceableBuild, failures)

    if (!html.includes('<div id="root"></div>')) {
      failures.push('Deployed HTML does not contain the React root.')
    }

    if (process.env.STRICT_DEPLOYED_MARKERS === '1') {
      assertIncludes('Deployed bundle commissioner routes', bundle, manifest.contractMarkers.commissionerRoutes, failures)
      assertIncludes('Deployed bundle identity markers', bundle, ['canonicalPlayer'], failures)
      assertIncludes('Deployed bundle My Profile markers', bundle, ['Current Season', 'Promotion Status', 'Recent Results'], failures)
      assertExcludes('Deployed bundle legacy commissioner labels', bundle, manifest.forbiddenActiveMarkers.legacyCommissionerTopLevel, failures)
    }

    pass(`inspected deployed bundle ${bundlePath}`)
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  }
}

if (failures.length) {
  fail('production contract failed', failures)
}

pass('production contract markers are present and forbidden regressions are absent')
