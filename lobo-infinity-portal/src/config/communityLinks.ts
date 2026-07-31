import type { PortalSettings } from '../services/api'

export type CommunityLinkKey =
  | 'discord'
  | 'facebook'
  | 'instagram'
  | 'twitch'
  | 'website'
  | 'youtube'

export type CommunityLinkConfig = {
  key: CommunityLinkKey
  label: string
  serverName: string
  url: string
}

export type CommunityLinksConfig = Partial<Record<CommunityLinkKey, CommunityLinkConfig>>

export function getCommunityLinks(
  settings: PortalSettings | null | undefined,
): CommunityLinksConfig {
  const discordUrl = settings?.discordInvite.trim() ?? ''
  const discordServerName =
    settings?.discordServerName.trim() || 'Lobo Infinity League Discord'

  return {
    discord: {
      key: 'discord',
      label: 'Discord',
      serverName: discordServerName,
      url: discordUrl,
    },
  }
}

export function getDiscordCommunityLink(
  settings: PortalSettings | null | undefined,
): CommunityLinkConfig | null {
  const discord = getCommunityLinks(settings).discord

  return discord?.url ? discord : null
}
