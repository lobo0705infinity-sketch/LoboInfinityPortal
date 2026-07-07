import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const baseUrl = 'https://lobo-infinity-portal.vercel.app'
const previewImage = `${baseUrl}/favicon.svg`

function RouteMeta() {
  const location = useLocation()

  useEffect(() => {
    const meta = getRouteMeta(location.pathname)

    document.title = meta.title
    setMetaTag('description', meta.description)
    setMetaTag('og:title', meta.title, 'property')
    setMetaTag('og:description', meta.description, 'property')
    setMetaTag('og:image', previewImage, 'property')
    setCanonical(`${baseUrl}${location.pathname}`)
  }, [location.pathname])

  return null
}

function getRouteMeta(pathname: string) {
  if (pathname.startsWith('/game/')) {
    return {
      title: 'Match Details | Lobo Infinity League',
      description: 'Open a permanent match report deep link.',
    }
  }

  if (pathname.startsWith('/player/') || pathname.startsWith('/players/')) {
    return {
      title: 'Player Profile | Lobo Infinity League',
      description: 'Open a league player profile and career record.',
    }
  }

  if (pathname.startsWith('/career/')) {
    return {
      title: 'Player Career | Lobo Infinity League',
      description: 'Open a permanent player career deep link.',
    }
  }

  if (pathname.startsWith('/achievement/')) {
    return {
      title: 'Achievement | Lobo Infinity League',
      description: 'Open a league achievement deep link.',
    }
  }

  if (pathname.startsWith('/faction/') || pathname.startsWith('/factions/')) {
    return {
      title: 'Faction Profile | Lobo Infinity League',
      description: 'Open a faction performance profile.',
    }
  }

  if (pathname.startsWith('/mission/') || pathname.startsWith('/missions/')) {
    return {
      title: 'Mission Profile | Lobo Infinity League',
      description: 'Open a mission performance profile.',
    }
  }

  if (pathname === '/weekly-report') {
    return {
      title: 'Weekly League Report | Lobo Infinity League',
      description: 'Open current standings and weekly league signals.',
    }
  }

  if (pathname.startsWith('/hall-of-fame')) {
    return {
      title: 'Hall of Fame | Lobo Infinity League',
      description: 'Open the permanent league history and record book.',
    }
  }

  if (pathname.startsWith('/rivalries')) {
    return {
      title: 'Rivalry Room | Lobo Infinity League',
      description: 'Open league head-to-head stories built from submitted games.',
    }
  }

  return {
    title: 'Lobo Infinity League Portal',
    description: 'The Lobo Infinity League Operating System.',
  }
}

function setMetaTag(name: string, content: string, attribute = 'name') {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${name}"]`,
  )

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }

  element.content = content
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.appendChild(element)
  }

  element.href = href
}

export default RouteMeta
