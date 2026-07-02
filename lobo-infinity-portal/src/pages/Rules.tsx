import type { ReactNode } from 'react'

function Rules() {
  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="rules-title">
        <p className="eyebrow">League Reference</p>
        <h1 id="rules-title">Rules</h1>
        <p>How to read the portal, standings, records, and league movement</p>
      </section>

      <section className="rules-grid" aria-label="League rules reference">
        <ReferenceCard title="League Structure">
          <p>
            The portal tracks Main Man, Proving Grounds A, and Proving Grounds B
            as separate live divisions. Standings, profiles, records, and league
            intelligence are calculated from reported match data.
          </p>
        </ReferenceCard>

        <ReferenceCard title="Standings">
          <p>
            Players are ranked by tournament performance using the live standings
            sheets. Player profiles show division, rank, record, TP, OP, and VP
            from the same source.
          </p>
        </ReferenceCard>

        <ReferenceCard title="Main Man Movement">
          <p>
            Main Man ranks 1 through 8 are marked safe. Ranks 9 and 10 are marked
            for relegation pressure.
          </p>
        </ReferenceCard>

        <ReferenceCard title="Scoring Terms">
          <dl className="rules-definition-list">
            <div>
              <dt>TP</dt>
              <dd>Tournament Points</dd>
            </div>
            <div>
              <dt>OP</dt>
              <dd>Objective Points</dd>
            </div>
            <div>
              <dt>VP</dt>
              <dd>Victory Points</dd>
            </div>
          </dl>
        </ReferenceCard>

        <ReferenceCard title="Battle Reports">
          <p>
            Recent Games and Match Reports use submitted game analytics,
            including mission, factions, scoreline, first turn, and Best Moment
            when one was submitted.
          </p>
        </ReferenceCard>

        <ReferenceCard title="League Intelligence">
          <p>
            Intelligence cards, records, news, notifications, and timeline items
            are generated from live league data. If data is missing, the portal
            says so directly instead of inventing a result.
          </p>
        </ReferenceCard>
      </section>
    </main>
  )
}

function ReferenceCard({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <article className="panel rules-card">
      <div className="panel-heading">
        <p className="eyebrow">Reference</p>
        <h2>{title}</h2>
      </div>
      <div className="rules-card-body">{children}</div>
    </article>
  )
}

export default Rules
