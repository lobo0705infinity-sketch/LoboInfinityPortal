import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const files = {
  authApi: read('backend/AuthApi.gs'),
  myProfile: read('src/pages/MyProfile.tsx'),
  api: read('src/services/api.ts'),
  authContext: read('src/auth/AuthContext.tsx'),
  playersApi: read('backend/PlayersApi.gs'),
}

const syncUserIdentityBody = extractFunction(files.authApi, 'syncUserIdentity')

const checks = [
  {
    label: 'Profile edits are available to every authenticated Portal user',
    pass:
      files.authApi.includes('updateProfile: USER_ROLES.GUEST') &&
      files.authApi.includes('requireApiPermission(\n    e,\n    "updateProfile"'),
  },
  {
    label: 'Display names are validated server-side',
    pass:
      files.authApi.includes('validatePortalDisplayName') &&
      files.authApi.includes('PORTAL_DISPLAY_NAME_RESERVED') &&
      files.authApi.includes('That display name is already in use.'),
  },
  {
    label: 'Google login no longer overwrites existing portal display names',
    pass:
      syncUserIdentityBody !== '' &&
      !syncUserIdentityBody.includes('columns.displayName') &&
      !syncUserIdentityBody.includes('verified.displayName'),
  },
  {
    label: 'Existing league users migrate from Google name to league identity',
    pass:
      files.authApi.includes('function migratePortalDisplayName') &&
      files.authApi.includes('leagueDisplayName') &&
      files.authApi.includes('currentDisplayName.toLowerCase() !== googleDisplayName.toLowerCase()'),
  },
  {
    label: 'Display name changes sync public player references',
    pass:
      files.authApi.includes('setLeaguePlayerDisplayName') &&
      files.authApi.includes('syncEventParticipantDisplayName'),
  },
  {
    label: 'Profile saves invalidate only identity-facing cache groups',
    pass:
      files.authApi.includes('invalidatePortalIdentityCaches') &&
      files.authApi.includes('invalidatePortalCacheGroup("players")') &&
      files.authApi.includes('invalidatePortalCacheGroup("search")'),
  },
  {
    label: 'Community registry prefers Portal display names',
    pass:
      files.playersApi.includes('if (input.portalUser)') &&
      files.playersApi.includes('record.displayName ='),
  },
  {
    label: 'Frontend profile model includes identity fields',
    pass:
      files.api.includes('discordName: string') &&
      files.api.includes('profileVisibility: string') &&
      files.authContext.includes("profileVisibility: 'Public'"),
  },
  {
    label: 'Authenticated profiles include sanitized event registrations',
    pass:
      files.authApi.includes('function getProfileEventRegistrations') &&
      files.authApi.includes('getEventParticipantKey(event, user)') &&
      files.authApi.includes('eventRegistrations:\n          getProfileEventRegistrations(user)') &&
      files.api.includes('eventRegistrations: getArray(record, \'eventRegistrations\') as EventParticipant[]'),
  },
  {
    label: 'Profile tournament status resolves from Event Participants source',
    pass:
      files.authApi.includes('CONFIG.SHEETS.EVENT_PARTICIPANTS') &&
      files.myProfile.includes("return (\n    tournament.eventName") &&
      files.playersApi.includes('function getRegisteredEventsForPlayer'),
  },
  {
    label: 'Favorite army profile display uses canonical army names',
    pass:
      files.playersApi.includes('canonicalizeArmyName(row[CONFIG.ENGINE.FACTION])') &&
      files.myProfile.includes('normalizeProfileArmyMetric') &&
      files.myProfile.includes('normalizeArmyForDisplay') &&
      files.myProfile.includes('list.sectorial || list.faction'),
  },
  {
    label: 'My Profile exposes an Edit Profile workflow',
    pass:
      files.myProfile.includes('function ProfileEditor') &&
      files.myProfile.includes('Save Profile') &&
      files.myProfile.includes('auth.refreshSession()'),
  },
]

const failures = checks.filter((check) => !check.pass)

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

if (failures.length > 0) {
  process.exitCode = 1
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)

  if (start === -1) {
    return ''
  }

  const braceStart = source.indexOf('{', start)
  let depth = 0

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index]

    if (char === '{') {
      depth += 1
    }

    if (char === '}') {
      depth -= 1
    }

    if (depth === 0) {
      return source.slice(braceStart, index + 1)
    }
  }

  return ''
}
