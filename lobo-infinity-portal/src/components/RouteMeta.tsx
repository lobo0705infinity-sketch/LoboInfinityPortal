import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { describePublicSearchPage, publicDatasetForPath, SITE_ORIGIN } from '../../shared/public-search-content.mjs'
import { getPublicSnapshotDataset } from '../services/publicSnapshot'

const previewImage = `${SITE_ORIGIN}/favicon.svg`
type EmbeddedSearchMeta = { pathname: string; title: string; description: string; canonicalPath: string }

function RouteMeta() {
  const location = useLocation()

  useEffect(() => {
    let active = true
    const embedded = document.getElementById('public-search-meta')
    let initialMeta: EmbeddedSearchMeta | null = null
    if (embedded?.textContent) {
      try {
        initialMeta = JSON.parse(embedded.textContent) as EmbeddedSearchMeta
      } catch {
        initialMeta = null
      }
    }
    const meta = initialMeta?.pathname === location.pathname
      ? initialMeta
      : getRouteMeta(location.pathname)

    applyMeta(meta, location.pathname)

    const dataset = publicDatasetForPath(location.pathname)
    if (dataset && location.pathname !== `/${dataset}` && location.pathname !== '/events') {
      getPublicSnapshotDataset<unknown[]>(dataset).then(items => {
        if (!active) return
        const updated = describePublicSearchPage(location.pathname, { [dataset]: items })
        if (updated) applyMeta(updated, location.pathname)
      }).catch(() => { /* Initial metadata stays available if the snapshot is offline. */ })
    }

    return () => { active = false }
  }, [location.pathname])

  return null
}

function applyMeta(meta: { title: string; description: string; canonicalPath?: string }, pathname: string) {
  document.title = meta.title
  setMetaTag('description', meta.description)
  setMetaTag('og:title', meta.title, 'property')
  setMetaTag('og:description', meta.description, 'property')
  setMetaTag('og:image', previewImage, 'property')
  setCanonical(`${SITE_ORIGIN}${meta.canonicalPath ?? pathname}`)
}

function getRouteMeta(pathname: string) {
  const publicPage = describePublicSearchPage(pathname)
  if (publicPage) return publicPage

  if (pathname.startsWith('/game/')) {
    return {
      title: 'Match Details | Lobo Infinity League',
      description: 'Open a permanent match report deep link.',
    }
  }

  if (pathname.startsWith('/player/') || pathname.startsWith('/players/')) {
    return {
      title: 'Player Profile | Lobo Infinity League',
      description: 'Open a portal player profile and career record.',
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
