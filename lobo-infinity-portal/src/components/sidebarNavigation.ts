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
]

export const authenticatedTopLevelItems: NavigationItem[] = [
  {
    icon: 'players',
    label: 'My Profile',
    to: '/profile',
  },
  {
    icon: 'missions',
    label: 'Mission & Map',
    to: '/league-operations',
  },
]

export const communityItems: NavigationItem[] = [
  {
    icon: 'players',
    label: 'Players',
    to: '/players',
  },
  {
    icon: 'hall',
    label: 'Hall of Fame',
    to: '/hall-of-fame',
  },
  {
    icon: 'compare',
    label: 'Compare',
    to: '/compare',
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
