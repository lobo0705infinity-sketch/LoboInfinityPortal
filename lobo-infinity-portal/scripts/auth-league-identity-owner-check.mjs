import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const identityService = read('backend/IdentityService.gs')
const authApi = read('backend/AuthApi.gs')

const checks = [
  {
    label: 'League identity resolution exposes one public authentication entry point',
    pass:
      count(identityService, 'function getAuthCanonicalPlayerIdentityByEmail(') === 1 &&
      !identityService.includes('function getAuthLeagueIdentityByEmail('),
  },
  {
    label: 'Every AuthApi League identity lookup uses the canonical public entry point',
    pass:
      count(authApi, 'getAuthCanonicalPlayerIdentityByEmail(') === 3 &&
      !authApi.includes('getAuthLeagueIdentityByEmail('),
  },
  {
    label: 'Canonical public League identity delegation is unchanged',
    pass: functionHash(identityService, 'getAuthCanonicalPlayerIdentityByEmail') ===
      '33dbcdddcb7ce4e015f277cd3a2c5ec6b9f20c964902bdf24a4549926d2cb99e',
  },
  {
    label: 'Canonical player identity orchestration is unchanged',
    pass: functionHash(identityService, 'resolveCanonicalPlayerIdentityByEmail') ===
      'e508c96cabaf3112c1ae0142e5e0f3acc7ac3700cd494887dd61fb3a7027a751',
  },
  {
    label: 'Players-sheet identity matching is unchanged',
    pass: functionHash(identityService, 'resolveCanonicalPlayerIdentityFromPlayersSheet') ===
      '8c1d1e9fe348316782dbe2858119168153af1af4aa199a9244ee0586b57db79b',
  },
  {
    label: 'Event Participant recovery is unchanged',
    pass:
      functionHash(identityService, 'resolveCanonicalPlayerIdentityFromEventParticipants') ===
        '65ec5010fc6e98f0ec6b1ee33428ef4415738a64b0aa6e5adb786eec32c77785' &&
      functionHash(identityService, 'isIdentityServiceInactiveStatus') ===
        '6ea4cfc7c98349980e887b7c3ab745dd0d1719acf56668ebf144fb77083e1ca4',
  },
  {
    label: 'Role assignment remains structurally identical',
    pass:
      authApi.includes('bootstrap || configuredCommissioner') &&
      authApi.includes('? USER_ROLES.COMMISSIONER') &&
      authApi.includes('? USER_ROLES.MEMBER') &&
      authApi.includes(': USER_ROLES.GUEST;'),
  },
  {
    label: 'Permission calculation is unchanged',
    pass:
      functionHash(authApi, 'getRolePermissions') ===
        'fdf30a1759d20fa73ab639dd8fbd7d66099cc57de758997040c67c86a343247e' &&
      functionHash(authApi, 'userHasPermission') ===
        '2464da26f541d14c7a87367d717ad43aa9e6393e2879bbf868e620df8754b82a' &&
      functionHash(authApi, 'getRoleRank') ===
        'd0452fbe084cbf6c39faf66771e456ed031184114d2ab21118e0740100b193a6' &&
      functionHash(authApi, 'normalizeUserRole') ===
        '008c23835cf43b84742f2a11d55b96206b6eedec03e9a8d87acfa60f2a5b92c0',
  },
]

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

if (checks.some((check) => !check.pass)) {
  process.exitCode = 1
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')
}

function count(source, value) {
  return source.split(value).length - 1
}

function functionHash(source, name) {
  return createHash('sha256').update(extractFunction(source, name)).digest('hex')
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)

  if (start === -1) {
    return ''
  }

  const braceStart = source.indexOf('{', start)
  let depth = 0

  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1
    }

    if (source[index] === '}') {
      depth -= 1
    }

    if (depth === 0) {
      return source.slice(start, index + 1)
    }
  }

  return ''
}
