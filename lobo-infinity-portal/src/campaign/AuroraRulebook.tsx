import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './AuroraRulebook.css'

const BASE = '/campaign/aurora-vii'
const RuleSearch = createContext('')
export const useRuleSearch = () => useContext(RuleSearch)
type ChapterProps = { id: string; title: string; description: string; children: ReactNode; searchText?: string }

export function RuleChapter({ children }: ChapterProps) { return <>{children}</> }

function searchableText(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child)
    return isValidElement<{ children?: ReactNode }>(child) ? searchableText(child.props.children) : ''
  }).join(' ')
}

export default function AuroraRulebook({ children }: { children: ReactNode }) {
  const chapters = Children.toArray(children).filter(isValidElement<ChapterProps>).map(child => child.props)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['start-here']))
  const [textIndex, setTextIndex] = useState<Record<string, string>>({})
  const root = useRef<HTMLDivElement>(null)
  const { hash } = useLocation()
  const search = query.trim().toLocaleLowerCase()
  const visible = chapters.filter(chapter => `${chapter.title} ${chapter.description} ${chapter.searchText || ''} ${textIndex[chapter.id] || searchableText(chapter.children)}`.toLocaleLowerCase().includes(search))
  const allOpen = visible.every(chapter => expanded.has(chapter.id))

  useEffect(() => {
    const index: Record<string, string> = {}
    root.current?.querySelectorAll<HTMLDetailsElement>('[data-rule-chapter]').forEach(chapter => { index[chapter.id] = chapter.textContent || '' })
    setTextIndex(index)
  }, [children])

  useEffect(() => {
    if (!hash) return
    let id: string
    try { id = decodeURIComponent(hash.slice(1)) } catch { return }
    const target = document.getElementById(id)
    if (!target || !root.current?.contains(target)) return
    const chapter = target.closest<HTMLDetailsElement>('[data-rule-chapter]')
    if (!chapter) return
    setQuery('')
    setExpanded(current => new Set(current).add(chapter.id))
    const frame = requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [hash])

  function toggle(id: string, open: boolean) {
    if (search) return
    setExpanded(current => {
      if (current.has(id) === open) return current
      const next = new Set(current)
      if (open) next.add(id); else next.delete(id)
      return next
    })
  }

  return <div className="aurora-rulebook" ref={root}>
    <header className="aurora-rulebook-intro">
      <div><p className="aurora-rulebook-kicker">Aurora VII / Field guide</p><h2>The campaign rules.<br/><span>Your next move.</span></h2><p>Learn the essentials, plan with your faction, and find the rule you need before your next battle.</p>
        <div className="aurora-rulebook-actions"><Link className="aurora-primary" to={`${BASE}/guide`}>Watch the player guide <span aria-hidden="true">↗</span></Link><a href="/guides/aurora-vii-player-guide-current.pdf" target="_blank" rel="noopener noreferrer">Player guide PDF ↗</a></div>
      </div>
      <dl className="aurora-rulebook-facts"><div><dt>Campaign length</dt><dd>12 <span>weeks</span></dd></div><div><dt>Two weeks each</dt><dd>6 <span>Turns</span></dd></div><div><dt>Choose your side</dt><dd>11 <span>factions</span></dd></div><div><dt>Shape the frontier</dt><dd>12 <span>territories</span></dd></div></dl>
    </header>
    <label className="aurora-rulebook-mobile-jump">Jump to a section<select value={chapters.some(chapter => `#${chapter.id}` === hash) ? hash.slice(1) : ''} onChange={event => { setQuery(''); setExpanded(current => new Set(current).add(event.target.value)); window.location.hash = event.target.value }}><option value="" disabled>Choose a rule topic</option>{chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
    <div className="aurora-rulebook-layout">
      <aside className="aurora-rulebook-sidebar"><p className="aurora-rulebook-kicker">In this guide</p><nav aria-label="Rules contents">{chapters.map((chapter, index) => <a href={`#${chapter.id}`} key={chapter.id} onClick={() => { setQuery(''); setExpanded(current => new Set(current).add(chapter.id)) }}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{chapter.title}</a>)}</nav><div className="aurora-rulebook-help"><strong>Ready to play?</strong><p>Check the mission briefing and territory rules before building your list.</p><Link to={`${BASE}/missions`}>Mission briefing →</Link><Link to={`${BASE}/map`}>Explore the map →</Link></div></aside>
      <div className="aurora-rulebook-main">
        <div className="aurora-rulebook-toolbar"><label htmlFor="aurora-rule-search">Find a rule<span className="aurora-rulebook-search"><span aria-hidden="true">⌕</span><input id="aurora-rule-search" aria-label="Find a rule" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try scoring, Command Tokens, or Korin…"/>{query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear rule search">×</button> : null}</span></label><div><p role="status">{search ? `${visible.length} ${visible.length === 1 ? 'section' : 'sections'} found` : 'Open a section to read the full rules.'}</p><button type="button" disabled={Boolean(search)} onClick={() => setExpanded(allOpen ? new Set() : new Set(chapters.map(chapter => chapter.id)))}>{allOpen ? 'Collapse all' : 'Expand all'}</button></div></div>
        <RuleSearch.Provider value={search}>{chapters.map((chapter, index) => <details className="aurora-rule-chapter" data-rule-chapter id={chapter.id} key={chapter.id} hidden={!visible.includes(chapter)} open={Boolean(search) || expanded.has(chapter.id)} onToggle={event => toggle(chapter.id, event.currentTarget.open)}>
          <summary><span className="aurora-rule-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span><h3>{chapter.title}</h3><span className="aurora-rule-description">{chapter.description}</span></span><span className="aurora-rule-chevron" aria-hidden="true">+</span></summary>
          <div className="aurora-rule-body">{chapter.children}</div>
        </details>)}</RuleSearch.Provider>
        {!visible.length ? <div className="aurora-rulebook-empty"><h3>No matching rules</h3><p>Try a territory name, faction, or a shorter phrase.</p><button type="button" onClick={() => setQuery('')}>Show all rules</button></div> : null}
        <p className="aurora-rulebook-bottom">Need a ruling? Contact Lobo in your faction channel. <a href="#start-here" onClick={() => { setQuery(''); setExpanded(current => new Set(current).add('start-here')) }}>Back to the essentials ↑</a></p>
      </div>
    </div>
  </div>
}
