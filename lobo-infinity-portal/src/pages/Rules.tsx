import CompactArtwork from '../components/CompactArtwork'
import leagueRulesArtwork from '../assets/current-league-rules-hero.png'
import teamRulesArtwork from '../assets/team-tournament-rules-hero.png'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import EventSectionTabs from '../components/EventSectionTabs'
import {
  currentEventNavigation,
  getEventNavigationConfig,
} from '../config/eventNavigation'
import {
  loadRulebook,
  resolveRulebookIdForEvent,
  type RulebookId,
} from '../content/rulebooks'
import type {
  RuleContent,
  RuleSection,
  Rulebook,
} from '../content/rulebooks/types'

function Rules() {
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') ?? currentEventNavigation.id
  const eventConfig = getEventNavigationConfig(eventId) ?? currentEventNavigation
  const rulebookId = resolveRulebookIdForEvent(eventConfig)
  const [loadedRulebook, setLoadedRulebook] = useState<{
    id: RulebookId
    rulebook: Rulebook
  } | null>(null)

  useEffect(() => {
    let ignore = false

    loadRulebook(rulebookId).then((module) => {
      if (!ignore) {
        setLoadedRulebook({ id: rulebookId, rulebook: module.default })
      }
    })

    return () => {
      ignore = true
    }
  }, [rulebookId])

  const rulebook =
    loadedRulebook?.id === rulebookId ? loadedRulebook.rulebook : null
  const sections = useMemo(() => rulebook?.sections ?? [], [rulebook])
  const pageClassName = eventId === 'event-current-league'
    ? ' current-league-rules-page'
    : rulebookId === 'teamTournament'
      ? ' team-tournament-rules-page'
      : ''

  return (
    <main className={`portal-shell${pageClassName}`}>
      <CompactArtwork title={rulebook?.title ?? eventConfig.label} eyebrow={rulebook?.eventType ?? "Rules Reference"} src={rulebookId === "teamTournament" ? teamRulesArtwork : leagueRulesArtwork}/>

      <EventSectionTabs eventId={eventId}
        teamTournament={rulebookId === 'teamTournament'}
        items={rulebookId === 'teamTournament' ? ['overview', 'standings', 'results', 'rules'] : ['overview', 'registration', 'standings', 'schedule', 'rules']} />

      <section className="rules-layout" aria-label="Event rules reference">
        <nav className="panel rules-toc" aria-label="Rules table of contents">
          <p className="eyebrow">Contents</p>
          <h2>Table of Contents</h2>
          <ul className="rules-toc-list">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="rules-document">
          {rulebook ? (
            sections.map((section) => (
              <RuleCard key={section.id} section={section} />
            ))
          ) : (
            <article className="panel rules-card" aria-busy="true">
              <div className="skeleton-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </article>
          )}
        </div>
      </section>
    </main>
  )
}

function RuleCard({ section }: { section: RuleSection }) {
  return (
    <article className="panel rules-card" id={section.id}>
      <details open>
        <summary>
          <span className="eyebrow">Official Rule</span>
          <h2>{section.title}</h2>
          {section.kicker ? <p>{section.kicker}</p> : null}
        </summary>
        <div className="rules-card-body">
          {section.body.map((content, index) => (
            <RuleContentBlock content={content} key={`${section.id}-${index}`} />
          ))}
        </div>
      </details>
    </article>
  )
}

function RuleContentBlock({ content }: { content: RuleContent }) {
  switch (content.type) {
    case 'paragraph':
      return <p>{content.text}</p>
    case 'ordered':
      return (
        <ol>
          {content.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      )
    case 'unordered':
      return (
        <ul>
          {content.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    case 'subsection':
      return (
        <section className="rules-subsection">
          <h3>{content.title}</h3>
          {content.children.map((child, index) => (
            <RuleContentBlock content={child} key={`${content.title}-${index}`} />
          ))}
        </section>
      )
  }
}

export default Rules
