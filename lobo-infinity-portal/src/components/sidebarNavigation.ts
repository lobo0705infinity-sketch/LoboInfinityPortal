import type { PortalIconName } from './PortalIcon'

export type NavigationItem = {
  external?: boolean
  icon: PortalIconName
  label: string
  to: string
}

export const topLevelItems: NavigationItem[] = [
  {
    icon: 'dashboard',
    label: 'Dashboard',
    to: '/',
  },
  {
    icon: 'submit',
    label: 'Submit Game',
    to: '/submit-game',
  },
  {
    icon: 'missions',
    label: 'Mission & Map',
    to: '/league-operations',
  },
]

export const authenticatedTopLevelItems: NavigationItem[] = []

export function getJoinCommunityNavigationItem(
  joinCommunityFormUrl: string,
): NavigationItem | null {
  if (!joinCommunityFormUrl) {
    return null
  }

  return {
    external: true,
    icon: 'players',
    label: 'Join the Lobo Game Network',
    to: joinCommunityFormUrl,
  }
}

export const communityItems: NavigationItem[] = [
  {
    icon: 'players',
    label: 'Players',
    to: '/players',
  },
  {
    icon: 'missions',
    label: 'Missions',
    to: '/missions',
  },
  {
    icon: 'streams',
    label: 'Streams',
    to: '/streams',
  },
  {
    icon: 'army',
    label: 'Army Intelligence',
    to: '/army-intelligence',
  },
]

export const commissionerItems: NavigationItem[] = [
  {
    icon: 'dashboard',
    label: 'Command Center',
    to: '/commissioner',
  },
  {
    icon: 'standings',
    label: 'Game Center',
    to: '/commissioner/game-center',
  },
  {
    icon: 'standings',
    label: 'Events',
    to: '/commissioner/events',
  },
  {
    icon: 'players',
    label: 'Players',
    to: '/commissioner/players',
  },
  {
    icon: 'bell',
    label: 'Automation',
    to: '/commissioner/automation',
  },
  {
    icon: 'analytics',
    label: 'System',
    to: '/commissioner/system',
  },
]
