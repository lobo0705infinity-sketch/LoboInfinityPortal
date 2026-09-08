import { Link } from 'react-router-dom'
import top40Rulebook from '../content/rulebooks/top40'
import type { RuleContent } from '../content/rulebooks/types'
import {
  buildCapabilityNavigation,
  getEventNavigationConfig,
} from '../config/eventNavigation'
import './Top40RulesPage.css'

const TOP_40_EVENT_ID = 'event-lobo-s-american-top-40'

export default function Top40RulesPage() {
  const config = getEventNavigationConfig(TOP_40_EVENT_ID)
  const eventNavigationItems = config
    ? buildCapabilityNavigation(config).map((item) => ({ href: item.to, label: item.label }))
    : []

  return (
    <main
      className="portal-shell event-overview-shell current-league-rules-page top40-rules-page"
      data-event-section="rules"
    >
      <figure className="panel top40-rules-hero" aria-label="Lobo's American Top 40 Rules artwork">
        <img
          alt="Lobo's American Top 40 Rules"
          height="941"
          src="/assets/events/top-40-rules.png?v=e49f616a"
          width="1671"
        />
      </figure>
      <nav className="event-home-nav" aria-label="Event navigation">
        {eventNavigationItems.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>{item.label}</Link>
        ))}
      </nav>
      <section className="panel top40-rules-intro" aria-labelledby="event-rules-page-title">
        <p className="eyebrow">{top40Rulebook.eventType}</p>
        <h1 id="event-rules-page-title">{top40Rulebook.title}</h1>
        <p>{top40Rulebook.description}</p>
      </section>
      <section className="rules-layout" aria-label="American Top 40 rules reference">
        <nav className="panel rules-toc" aria-label="On This Page">
          <p className="eyebrow">Rules</p>
          <h2>On This Page</h2>
          <ul className="rules-toc-list">
            {top40Rulebook.sections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
            ))}
          </ul>
        </nav>
        <div className="rules-document">
          {top40Rulebook.sections.map((section) => (
            <article className="panel rules-card" id={section.id} key={section.id}>
              <details open>
                <summary><span className="eyebrow">Official Rule</span><h2>{section.title}</h2></summary>
                <div className="rules-card-body">
                  {section.body.map((content, index) => (
                    <RuleContentBlock content={content} key={`${section.id}-${index}`} />
                  ))}
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function RuleContentBlock({ content }: { content: RuleContent }) {
  switch (content.type) {
    case 'paragraph':
      return <p>{content.text}</p>
    case 'ordered':
      return <ol>{content.items.map((item) => <li key={item}>{item}</li>)}</ol>
    case 'unordered':
      return <ul>{content.items.map((item) => <li key={item}>{item}</li>)}</ul>
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
