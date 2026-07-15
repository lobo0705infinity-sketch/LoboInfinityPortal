import type { PortalIconName } from './PortalIcon'

export type NavigationItem = {
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
    label: 'League Operations',
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
    icon: 'analytics',
    label: 'Intelligence',
    to: '/intelligence',
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
    icon: 'news',
    label: 'News',
    to: '/news',
  },
  {
    icon: 'timeline',
    label: 'Timeline',
    to: '/timeline',
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
    icon: 'bell',
    label: 'Alerts',
    to: '/notifications',
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
