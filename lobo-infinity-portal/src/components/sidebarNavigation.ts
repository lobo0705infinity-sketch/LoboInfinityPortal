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
]

export const leagueItems: NavigationItem[] = [
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
    icon: 'rules',
    label: 'Rules',
    to: '/rules',
  },
]

export const communityItems: NavigationItem[] = [
  {
    icon: 'submit',
    label: 'Submit Game',
    to: '/submit-game?gameType=casual',
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
    icon: 'submit',
    label: 'Operations',
    to: '/commissioner',
  },
  {
    icon: 'standings',
    label: 'Event Manager',
    to: '/commissioner/event-manager',
  },
  {
    icon: 'bell',
    label: 'Automation',
    to: '/automation',
  },
  {
    icon: 'analytics',
    label: 'Integrity',
    to: '/integrity',
  },
  {
    icon: 'analytics',
    label: 'Diagnostics',
    to: '/diagnostics',
  },
]
