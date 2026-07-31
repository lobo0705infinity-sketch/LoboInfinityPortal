import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const files = {
  api: read('src/services/api.ts'),
  app: read('src/App.tsx'),
  backendOperations: read('backend/OperationsApi.gs'),
  backendSettings: read('backend/SettingsApi.gs'),
  communityConfig: read('src/config/communityLinks.ts'),
  discordLink: read('src/components/DiscordCommunityLink.tsx'),
  dashboard: read('src/pages/Dashboard.tsx'),
  eventHome: read('src/pages/EventHome.tsx'),
  footer: read('src/components/GlobalFooter.tsx'),
  mobileNavigation: read('src/components/MobileNavigationDrawer.tsx'),
  navigation: read('src/components/Sidebar.tsx'),
  players: read('src/pages/Players.tsx'),
  teamTournament: read('src/pages/TeamTournament.tsx'),
}

const checkedSource = [
  'src',
  'backend',
  'public',
]
  .flatMap((directory) => listTrackedSource(directory))
  .filter((path) => !path.endsWith('scripts/community-links-check.mjs'))

const hardcodedDiscordInvites = checkedSource.filter((path) =>
  /https?:\/\/(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\S*/i.test(read(path)),
)

const checks = [
  {
    label: 'Community links expose Discord through a single resolver',
    pass:
      files.communityConfig.includes('function getCommunityLinks(') &&
      files.communityConfig.includes("settings?.discordInvite.trim()") &&
      files.communityConfig.includes('function getDiscordCommunityLink('),
  },
  {
    label: 'Public Discord link component uses the canonical resolver',
    pass:
      files.discordLink.includes('getDiscordCommunityLink(settings)') &&
      files.discordLink.includes('if (!discord)') &&
      files.discordLink.includes('return null'),
  },
  {
    label: 'All public Discord links open in a new tab',
    pass:
      files.discordLink.includes('target="_blank"') &&
      files.discordLink.includes('rel="noopener noreferrer"') &&
      files.navigation.includes('target="_blank"') &&
      files.mobileNavigation.includes('target="_blank"'),
  },
  {
    label: 'Navigation hides Discord when no invite URL is configured',
    pass:
      files.navigation.includes('const discordLink = getDiscordCommunityLink(settings)') &&
      files.navigation.includes('? [') &&
      files.mobileNavigation.includes('const discordLink = getDiscordCommunityLink(settings)') &&
      files.mobileNavigation.includes('? ['),
  },
  {
    label: 'Dashboard hides the Discord card when no invite URL is configured',
    pass:
      files.dashboard.includes('const discord = getDiscordCommunityLink(settings)') &&
      files.dashboard.includes('if (!discord)') &&
      files.dashboard.includes('return null'),
  },
  {
    label: 'Dashboard, footer, community, team tournament, and event overview use the shared Discord component',
    pass:
      files.dashboard.includes('<DiscordCommunityLink') &&
      files.footer.includes('<DiscordCommunityLink') &&
      files.players.includes('<DiscordCommunityLink') &&
      files.teamTournament.includes('<DiscordCommunityLink') &&
      files.eventHome.includes('<DiscordCommunityLink'),
  },
  {
    label: 'Commissioner settings can update the public Discord invite',
    pass:
      files.backendOperations.includes('"discordInvite"') &&
      files.backendOperations.includes('"discordServerName"') &&
      files.backendOperations.includes('Discord Invite URL must be a valid http or https URL.') &&
      files.backendSettings.includes('"discordInvite"') &&
      files.backendSettings.includes('"discordServerName"'),
  },
  {
    label: 'Portal settings type includes Discord community fields',
    pass:
      files.api.includes('discordInvite: string') &&
      files.api.includes('discordServerName: string'),
  },
  {
    label: 'No hardcoded Discord invite URLs remain in portal source',
    pass: hardcodedDiscordInvites.length === 0,
    detail: hardcodedDiscordInvites.join(', '),
  },
]

const failures = checks.filter((check) => !check.pass)

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
  if (!check.pass && check.detail) {
    console.log(`  ${check.detail}`)
  }
}

if (failures.length > 0) {
  process.exitCode = 1
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

function listTrackedSource(directory) {
  const start = resolve(root, directory)
  const paths = []
  const stack = [start]

  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of readdirSync(current)) {
      const fullPath = resolve(current, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        stack.push(fullPath)
        continue
      }

      if (/\.(css|gs|html|js|jsx|mjs|ts|tsx)$/.test(entry)) {
        paths.push(fullPath)
      }
    }
  }

  return paths
}
