import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const authApi = read('backend/AuthApi.gs')
const armyListApi = read('backend/ArmyListApi.gs')
const eventRegistrationApi = read('backend/EventRegistrationApi.gs')
const resultSubmissionApi = read('backend/ResultSubmissionApi.gs')
const schedulingApi = read('backend/SchedulingApi.gs')
const backendSources = readBackendSources()
const permissionRuntime = buildPermissionRuntime(authApi)

const checks = [
  {
    label: 'requireApiPermission accepts an already-resolved authentication context',
    pass:
      authApi.includes('function requireApiPermission(e, permission, handler, resolvedAuth)') &&
      authApi.includes('resolvedAuth || getRequestUser(e);'),
  },
  {
    label: 'No production module outside AuthApi calls userHasPermission directly',
    pass: backendSources
      .filter((entry) => entry.path !== 'backend/AuthApi.gs')
      .every((entry) => !entry.source.includes('userHasPermission(')),
  },
  {
    label: 'Army List override authorization delegates to requireApiPermission',
    pass:
      functionBody(armyListApi, 'submitArmyList').includes('requireApiPermission(') &&
      functionBody(armyListApi, 'submitArmyList').includes('"viewOperations"'),
  },
  {
    label: 'Event registration detail authorization delegates to requireApiPermission',
    pass:
      functionBody(eventRegistrationApi, 'canViewEventRegistrationDetails')
        .includes('requireApiPermission(') &&
      functionBody(eventRegistrationApi, 'canViewEventRegistrationDetails')
        .includes('"runSeasonControl"'),
  },
  {
    label: 'Commissioner submission authorization delegates to requireApiPermission',
    pass:
      functionBody(resultSubmissionApi, 'getResultSubmissionCommissionerContext')
        .includes('requireApiPermission(') &&
      functionBody(resultSubmissionApi, 'getResultSubmissionCommissionerContext')
        .includes('"runSeasonControl"'),
  },
  {
    label: 'Scheduling manager authorization delegates to requireApiPermission',
    pass:
      functionBody(schedulingApi, 'updateSchedulingRequestStatus')
        .includes('requireApiPermission(') &&
      functionBody(schedulingApi, 'updateSchedulingRequestStatus')
        .includes('"viewOperations"'),
  },
  {
    label: 'Canonical permission decisions match every reachable legacy inline decision',
    pass: verifyInlineDecisionEquivalence(permissionRuntime),
  },
  {
    label: 'Existing protected endpoint authorization behavior is unchanged',
    pass: verifyProtectedEndpointBehavior(permissionRuntime),
  },
  {
    label: 'Authentication behavior is unchanged',
    pass:
      functionHash(authApi, 'getRequestUser') ===
      'e0f6356607fe6c8b9cf642729b4db363e96684e8cb3c494f8dfff13cd2c9b452',
  },
  {
    label: 'Permission definitions and calculations are unchanged',
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
  {
    label: 'Domain-specific Army List validation remains in place',
    pass:
      functionBody(armyListApi, 'submitArmyList')
        .includes('validation.suspicious && !(overrideRequested && canOverride)'),
  },
  {
    label: 'Domain-specific commissioner mode and override rules remain in place',
    pass:
      functionBody(resultSubmissionApi, 'getResultSubmissionCommissionerContext')
        .includes('if (!enabled)') &&
      functionBody(resultSubmissionApi, 'getResultSubmissionCommissionerContext')
        .includes('enabled && getResultSubmissionBoolean(params.commissionerOverride)'),
  },
  {
    label: 'Domain-specific scheduling participant rule remains in place',
    pass:
      functionBody(schedulingApi, 'updateSchedulingRequestStatus')
        .includes('if (!isParticipant && !canManage)'),
  },
]

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

console.log('REMAINING AuthApi::requireApiPermission - canonical permission enforcement owner')
console.log('REMAINING AuthApi::userHasPermission - permission calculation used by the owner')
console.log('REMAINING AuthApi::getRolePermissions - permission-map calculation, not enforcement')
console.log('REMAINING AuthApi::logAuthorizationDiagnostic - decision reporting, not enforcement')
console.log('REMAINING SchedulingApi::isParticipant - domain ownership rule for request participants')
console.log('REMAINING ArmyListApi::validation.suspicious - domain Army Code validation rule')
console.log('REMAINING ResultSubmissionApi::commissionerMode - domain submission-mode rule')

if (checks.some((check) => !check.pass)) {
  process.exitCode = 1
}

function verifyInlineDecisionEquivalence(runtime) {
  const authCases = [
    unauthenticated(),
    authenticated('Guest'),
    authenticated('League Member'),
    authenticated('Assistant Commissioner'),
    authenticated('Commissioner'),
  ]

  return ['viewOperations', 'runSeasonControl'].every((permission) =>
    authCases.every((auth) => {
      const legacy = Boolean(
        auth &&
        auth.authenticated &&
        auth.user &&
        runtime.userHasPermission(auth.user.role, permission),
      )
      const canonical = runtime.requireWithResolvedAuth(auth, permission) === true
      return legacy === canonical
    }),
  )
}

function verifyProtectedEndpointBehavior(runtime) {
  const cases = [
    { auth: unauthenticated(), permission: 'viewOperations', code: 'AUTH_REQUIRED' },
    { auth: authenticated('League Member'), permission: 'viewOperations', code: 'PERMISSION_DENIED' },
    { auth: authenticated('Assistant Commissioner'), permission: 'viewOperations', code: 'HANDLER' },
    { auth: authenticated('Commissioner'), permission: 'runSeasonControl', code: 'HANDLER' },
  ]

  return cases.every((fixture) =>
    runtime.requireFromRequest(fixture.auth, fixture.permission) === fixture.code,
  )
}

function buildPermissionRuntime(source) {
  const declarations = [
    extractConst(source, 'USER_ROLES'),
    extractConst(source, 'USER_ROLE_ORDER'),
    extractConst(source, 'PERMISSION_MIN_ROLE'),
    extractFunction(source, 'getRolePermissions'),
    extractFunction(source, 'userHasPermission'),
    extractFunction(source, 'getRoleRank'),
    extractFunction(source, 'normalizeUserRole'),
    extractFunction(source, 'requireApiPermission'),
  ].join('\n')

  return Function(`
    "use strict";
    ${declarations}
    function getAuthString(value) { return value === null || value === undefined ? "" : String(value).trim(); }
    function logAuthorizationDiagnostic() {}
    function jsonOutput(value) { return value; }
    return {
      userHasPermission,
      requireWithResolvedAuth(auth, permission) {
        return requireApiPermission(
          null,
          permission,
          function() { return true; },
          auth
        );
      },
      requireFromRequest(auth, permission) {
        globalThis.__permissionOwnerAuth = auth;
        globalThis.getRequestUser = function() { return globalThis.__permissionOwnerAuth; };
        const result = requireApiPermission(
          {},
          permission,
          function() { return { code: "HANDLER" }; }
        );
        delete globalThis.__permissionOwnerAuth;
        delete globalThis.getRequestUser;
        return result.code;
      }
    };
  `)()
}

function authenticated(role) {
  return {
    authenticated: true,
    code: 'AUTH_OK',
    diagnostics: {},
    error: '',
    stage: 'sessionValidation',
    user: { enabled: true, role },
  }
}

function unauthenticated() {
  return {
    authenticated: false,
    code: 'AUTH_GOOGLE_TOKEN_MISSING',
    diagnostics: {},
    error: 'Authentication is required.',
    stage: 'frontendCredential',
    user: { enabled: false, role: 'Guest' },
  }
}

function readBackendSources() {
  return walk(resolve(root, 'backend'))
    .filter((path) => path.endsWith('.gs'))
    .map((path) => ({
      path: path.slice(root.length + 1).replaceAll('\\', '/'),
      source: read(path.slice(root.length + 1)),
    }))
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')
}

function functionBody(source, name) {
  const fn = extractFunction(source, name)
  const brace = fn.indexOf('{')
  return brace === -1 ? '' : fn.slice(brace + 1, -1)
}

function functionHash(source, name) {
  return createHash('sha256').update(extractFunction(source, name)).digest('hex')
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)
  return start === -1 ? '' : extractBlock(source, start)
}

function extractConst(source, name) {
  const start = source.indexOf(`const ${name} =`)
  return start === -1 ? '' : `${extractBlock(source, start)};`
}

function extractBlock(source, start) {
  const braceStart = source.indexOf('{', start)
  const bracketStart = source.indexOf('[', start)
  const blockStart = bracketStart !== -1 && bracketStart < braceStart ? bracketStart : braceStart
  const opening = source[blockStart]
  const closing = opening === '[' ? ']' : '}'
  let depth = 0

  for (let index = blockStart; index < source.length; index += 1) {
    if (source[index] === opening) {
      depth += 1
    }

    if (source[index] === closing) {
      depth -= 1
    }

    if (depth === 0) {
      return source.slice(start, index + 1)
    }
  }

  return ''
}
