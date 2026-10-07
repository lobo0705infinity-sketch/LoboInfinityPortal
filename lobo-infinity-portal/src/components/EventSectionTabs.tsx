import { useLayoutEffect, useRef } from 'react'
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom'

export default function EventSectionTabs({ eventId, items, teamTournament = false, className = 'snapshot-tabs' }: {
  eventId: string
  items: string[]
  teamTournament?: boolean
  className?: string
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const navRef = useRef<HTMLElement>(null)
  const { pathname, search } = location

  useLayoutEffect(() => {
    const offset = location.state?.eventTabOffset
    if (navigationType === 'POP' || typeof offset !== 'number' || !navRef.current) return
    window.scrollBy({ top: navRef.current.getBoundingClientRect().top - offset, behavior: 'instant' })
  }, [location.key, location.state, navigationType])

  return <nav ref={navRef} aria-label="Event sections" className={className}>
    {items.filter(item => !(teamTournament && (item === 'teams' || item === 'registration'))).map(item => {
      const to = teamTournament && (item === 'standings' || item === 'results')
        ? `/event/${eventId}/tournament/${item}`
        : item === 'rules' && eventId === 'event-lobo-s-american-top-40'
          ? `/event/${eventId}/rules`
          : item === 'rules' ? `/rules?eventId=${encodeURIComponent(eventId)}`
            : `/event/${eventId}${item === 'overview' ? '' : `/${item}`}`
      const active = `${pathname}${search}` === to || pathname === to
        || (item === 'standings' && pathname === '/standings' && search.includes(eventId))
        || (item === 'overview' && pathname === `/event/${eventId}/overview`)
      return <Link key={item} to={to} aria-current={active ? 'page' : undefined} className={active ? 'active' : undefined}
        onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          navigate(to, { state: { eventTabOffset: navRef.current?.getBoundingClientRect().top ?? 0 } })
        }}>
        {item.replace(/(^|[-\s])\w/g, letter => letter.toUpperCase())}
      </Link>
    })}
  </nav>
}
