import type { ReactNode } from 'react'

type RuleSection = {
  id: string
  title: string
  kicker?: string
  body: ReactNode
}

const sections: RuleSection[] = [
  {
    id: 'league-structure',
    title: '1. League Structure',
    body: (
      <p>
        The league is divided into two competitive tiers designed to create
        constant pressure, movement, and rivalry.
      </p>
    ),
  },
  {
    id: 'main-man',
    title: '2. The Main Man Division',
    kicker: '"The Galaxy\'s Elite Operators"',
    body: (
      <p>
        The Main Man Division contains the 10 strongest and highest-performing
        players in the league.
      </p>
    ),
  },
  {
    id: 'proving-grounds',
    title: '3. The Proving Grounds',
    kicker: '"Earn Your Seat at the Table"',
    body: (
      <>
        <p>There will be multiple Proving Grounds divisions as needed:</p>
        <ul>
          <li>Proving Grounds A</li>
          <li>Proving Grounds B</li>
          <li>Proving Grounds C</li>
        </ul>
        <p>Each division contains up to 10 players.</p>
      </>
    ),
  },
  {
    id: 'season-structure',
    title: '4. Season Structure',
    body: (
      <>
        <p>The league operates with:</p>
        <ul>
          <li>2 Seasons Per Year</li>
          <li>20 Weeks Per Season</li>
        </ul>
        <p>
          Every player must complete 9 games by the end of the season, one game
          against each of their division rivals.
        </p>
        <p>
          Players must complete 5 games by the halfway point of the season and
          the remaining 4 games by the end of the season.
        </p>
        <p>
          Players are not limited to one game per week. If you and your
          opponents can make it work, you may play multiple games in a week,
          provided you complete 5 games by mid-season and all 9 games by the end
          of the season.
        </p>
      </>
    ),
  },
  {
    id: 'event-format',
    title: '5. Event Format',
    body: (
      <>
        <p>
          Each official event uses the standard Infinity Tournament System (ITS)
          structure.
        </p>
        <p>Standings are determined using:</p>
        <ul>
          <li>Tournament Points</li>
          <li>Objective Points</li>
          <li>Victory Points</li>
        </ul>
      </>
    ),
  },
  {
    id: 'list-submission',
    title: '6. List Submission Rules',
    body: (
      <>
        <p>Players are not locked to any one specific list.</p>
        <p>
          Lists may be changed between games, allowing players to adapt,
          experiment, and prepare for different opponents and missions.
        </p>
      </>
    ),
  },
  {
    id: 'mission-selection',
    title: '7. Mission Selection',
    body: (
      <>
        <p>The 20-week season is broken down into ten 2-week periods.</p>
        <p>Each 2-week period will have:</p>
        <ul>
          <li>Two eligible missions</li>
          <li>Two eligible maps</li>
        </ul>
        <p>Once you and your opponent sit down to play:</p>
        <ol>
          <li>Both players roll a die.</li>
          <li>
            The player with the higher roll chooses which eligible mission will
            be played.
          </li>
          <li>
            The player with the lower roll chooses which eligible map will be
            used.
          </li>
          <li>
            Both players put two copies of their miniatures on the table in
            Tabletop Simulator in their respective bags/boxes.
          </li>
          <li>
            One copy of each player's army is put off to the side. Then both
            players announce which army they are playing.
          </li>
          <li>
            At the end of the game, opponents may check the bag on the side if
            they have any questions about the list.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'league-philosophy',
    title: '8. League Philosophy',
    body: (
      <>
        <p>The league is designed to create:</p>
        <ul>
          <li>Constant competitive pressure</li>
          <li>Meaningful rankings</li>
          <li>High-stakes matches</li>
          <li>Seasonal storylines</li>
          <li>Rivalries and redemption arcs</li>
        </ul>
      </>
    ),
  },
  {
    id: 'promotion-relegation',
    title: '9. Promotion & Relegation',
    body: (
      <>
        <p>
          At the conclusion of every official league season, players move
          between divisions based on their final standings.
        </p>

        <RuleSubsection title="Main Man Division">
          <ul>
            <li>
              The bottom two (2) players are automatically relegated to Proving
              Grounds A.
            </li>
          </ul>
        </RuleSubsection>

        <RuleSubsection title="Proving Grounds A">
          <ul>
            <li>
              The top two (2) players are automatically promoted to the Main Man
              Division.
            </li>
            <li>
              The bottom two (2) players are automatically relegated to Proving
              Grounds B.
            </li>
          </ul>
        </RuleSubsection>

        <RuleSubsection title="Proving Grounds B">
          <ul>
            <li>
              The top two (2) players are automatically promoted to Proving
              Grounds A.
            </li>
          </ul>
        </RuleSubsection>

        <RuleSubsection title="Additional Proving Grounds Divisions">
          <p>
            If additional Proving Grounds divisions are created, promotion and
            relegation continue between adjacent divisions.
          </p>
          <p>For example:</p>
          <ul>
            <li>
              Top two from Proving Grounds C are promoted to Proving Grounds B.
            </li>
            <li>
              Bottom two from Proving Grounds B are relegated to Proving Grounds
              C.
            </li>
          </ul>
          <p>
            This structure continues for any future divisions created by the
            League Organizer.
          </p>
        </RuleSubsection>

        <RuleSubsection title="General Rules">
          <ul>
            <li>Promotion and relegation are automatic.</li>
            <li>No promotion playoffs or challenge matches are used.</li>
            <li>
              Final standings are determined using official Infinity ITS
              tiebreakers.
            </li>
            <li>
              If a player withdraws from the league or a vacancy occurs, the
              League Organizer may adjust promotions to preserve balanced
              divisions.
            </li>
          </ul>
        </RuleSubsection>

        <p>
          Every season offers players the opportunity to climb the league ladder
          or risk falling down it. Every game matters.
        </p>
      </>
    ),
  },
]

function Rules() {
  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="rules-title">
        <p className="eyebrow">League Reference</p>
        <h1 id="rules-title">The Lobo Infinity League</h1>
        <p>July 2026 Season official rules reference</p>
      </section>

      <section className="rules-layout" aria-label="League rules reference">
        <nav className="panel rules-toc" aria-label="Rules table of contents">
          <p className="eyebrow">Contents</p>
          <h2>Table of Contents</h2>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="rules-document">
          {sections.map((section) => (
            <RuleCard key={section.id} section={section} />
          ))}
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
        <div className="rules-card-body">{section.body}</div>
      </details>
    </article>
  )
}

function RuleSubsection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="rules-subsection">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export default Rules
