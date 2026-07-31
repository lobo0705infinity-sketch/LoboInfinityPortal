import type { ReactNode } from 'react'
import { getDiscordCommunityLink } from '../config/communityLinks'
import { useSettings } from '../contexts/SettingsContext'
import PortalIcon from './PortalIcon'

type DiscordCommunityLinkProps = {
  children?: ReactNode
  className?: string
  icon?: boolean
}

function DiscordCommunityLink({
  children = 'Join Discord',
  className,
  icon = false,
}: DiscordCommunityLinkProps) {
  const { settings } = useSettings()
  const discord = getDiscordCommunityLink(settings)

  if (!discord) {
    return null
  }

  return (
    <a
      aria-label={`Join ${discord.serverName}`}
      className={className}
      href={discord.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {icon ? <PortalIcon name="discord" /> : null}
      {children}
    </a>
  )
}

export default DiscordCommunityLink
