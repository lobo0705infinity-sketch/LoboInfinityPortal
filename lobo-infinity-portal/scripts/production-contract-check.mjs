import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  extractAppsScriptDeploymentId,
  fail,
  fingerprint,
  normalizeApiUrl,
  pass,
  readManifest,
  repoRoot,
} from './release-utils.mjs'

const manifest = readManifest()
const targetUrl = process.env.CONTRACT_BASE_URL || ''

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8').replace(/\r\n/g, '\n')
}

function readJsonIfExists(relativePath) {
  const path = resolve(repoRoot, relativePath)
  if (!existsSync(path)) {
    return null
  }
  return JSON.parse(readFileSync(path, 'utf8'))
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

function extractCommissionerItems(source) {
  const start = source.indexOf('export const commissionerItems')
  const end = source.indexOf(']\n', start)
  if (start === -1 || end === -1) {
    return []
  }

  const block = source.slice(start, end)
  return [...block.matchAll(/label:\s*'([^']+)'[\s\S]*?to:\s*'([^']+)'/g)].map((match) => ({
    label: match[1],
    route: match[2],
  }))
}

function assertExactCommissionerNavigation(source, failures) {
  const expected = [
    ['Command Center', '/commissioner'],
    ['Events', '/commissioner/events'],
    ['Players', '/commissioner/players'],
    ['Automation', '/commissioner/automation'],
    ['System', '/commissioner/system'],
  ]
  const actual = extractCommissionerItems(source)

  if (actual.length !== expected.length) {
    failures.push(`Commissioner navigation has ${actual.length} top-level items; expected ${expected.length}.`)
    return
  }

  expected.forEach(([label, route], index) => {
    const item = actual[index]
    if (item.label !== label || item.route !== route) {
      failures.push(`Commissioner navigation item ${index + 1} is ${item.label} -> ${item.route}; expected ${label} -> ${route}.`)
    }
  })
}

function assertRouteElement(name, appSource, route, element, failures) {
  const routePattern = new RegExp(`path="${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]{0,240}<${element}\\s*/>`)
  if (!routePattern.test(appSource)) {
    failures.push(`${name} route ${route} does not render ${element}.`)
  }
}

function assertManifestContract(manifest, failures) {
  const expectedDeploymentId = extractAppsScriptDeploymentId(manifest.appsScriptUrl)
  if (!manifest.productionBranch || manifest.productionBranch !== 'main') {
    failures.push('release/production.json productionBranch must be main.')
  }
  if (!manifest.appsScriptUrl || !manifest.appsScriptDeploymentId) {
    failures.push('release/production.json must include Apps Script URL and deployment id.')
  }
  if (expectedDeploymentId !== manifest.appsScriptDeploymentId) {
    failures.push('release/production.json Apps Script URL does not match appsScriptDeploymentId.')
  }
  if (!Number.isInteger(manifest.appsScriptVersion) || manifest.appsScriptVersion <= 0) {
    failures.push('release/production.json appsScriptVersion must be a positive integer.')
  }
  if (!manifest.vercelProject) {
    failures.push('release/production.json must name the Vercel project.')
  }
  if (!manifest.contractMarkers || !manifest.forbiddenActiveMarkers) {
    failures.push('release/production.json must include contract and forbidden marker groups.')
  }
}

function assertBuildFingerprint(manifest, failures) {
  const releaseFingerprint = readJsonIfExists('public/release-fingerprint.json')
  if (!releaseFingerprint) {
    failures.push('public/release-fingerprint.json is missing; run release:fingerprint before release:contract.')
    return
  }

  const expectedApiUrl = normalizeApiUrl(manifest.appsScriptUrl)
  const expectedApiFingerprint = fingerprint(expectedApiUrl)
  if (releaseFingerprint.appsScriptDeploymentId !== manifest.appsScriptDeploymentId) {
    failures.push('release fingerprint Apps Script deployment id does not match release/production.json.')
  }
  if (releaseFingerprint.appsScriptVersion !== manifest.appsScriptVersion) {
    failures.push('release fingerprint Apps Script version does not match release/production.json.')
  }
  if (releaseFingerprint.apiUrlFingerprint !== expectedApiFingerprint) {
    failures.push('release fingerprint API URL fingerprint does not match release/production.json.')
  }
  if (!releaseFingerprint.frontendCommit || releaseFingerprint.frontendCommit === 'not-provided') {
    failures.push('release fingerprint frontendCommit is missing.')
  }
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
assertManifestContract(manifest, failures)
assertBuildFingerprint(manifest, failures)

const sidebar = read('src/components/sidebarNavigation.ts')
const commissionerSidebar = sidebar.slice(sidebar.indexOf('export const commissionerItems'))
assertExactCommissionerNavigation(sidebar, failures)
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
const app = read('src/App.tsx')
assertRouteElement('Commissioner Events', app, '/commissioner/events', 'CommissionerEvents', failures)
assertRouteElement('Commissioner Players', app, '/commissioner/players', 'CommissionerPlayers', failures)
assertRouteElement('Commissioner Automation', app, '/commissioner/automation', 'AutomationCenter', failures)
assertRouteElement('Commissioner System', app, '/commissioner/system', 'CommissionerSystem', failures)
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
