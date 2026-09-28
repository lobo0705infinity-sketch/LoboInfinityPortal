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
    icon: 'army',
    label: 'Explore',
    to: '/explore',
  },
  {
    icon: 'standings',
    label: 'All Events',
    to: '/events',
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
    icon: 'discord',
    label: "Lobo's Little Helper",
    to: '/little-helper',
  },
  {
    icon: 'army',
    label: 'Army Intelligence',
    to: '/army-intelligence',
  },
  {
    icon: 'rules',
    label: 'Battle Reports',
    to: '/games',
  },
  {
    icon: 'maps',
    label: 'TTS Map Library',
    to: '/maps',
  },
  {
    icon: 'players',
    label: 'Players',
    to: '/players',
  },
  {
    icon: 'compare',
    label: 'Compare Players',
    to: '/compare',
  },
  {
    icon: 'factions',
    label: 'Factions',
    to: '/factions',
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
    label: 'Army Lists',
    to: '/army-lists',
  },
  {
    icon: 'analytics',
    label: 'Statistics',
    to: '/analytics',
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
    label: 'Events',
    to: '/commissioner/events',
  },
  {
    icon: 'standings',
    label: 'Games & Army Lists',
    to: '/commissioner/game-center',
  },
  {
    icon: 'players',
    label: 'Players & Access',
    to: '/commissioner/players',
  },
  {
    icon: 'bell',
    label: 'Community',
    to: '/commissioner/community-manager',
  },
  {
    icon: 'analytics',
    label: 'System & Recovery',
    to: '/commissioner/system',
  },
]
