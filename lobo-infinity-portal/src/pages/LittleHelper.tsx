import { Link } from 'react-router-dom'
import DiscordCommunityLink from '../components/DiscordCommunityLink'
import PortalIcon from '../components/PortalIcon'
import './LittleHelper.css'

const moreCommands = [
  { command: '/build-list', description: 'Build one mission-guided army list with must-include models.' },
  { command: '/random-list', description: 'Generate a faction list with your points and SWC target.' },
  { command: '/mission', description: 'Look up a scenario and its mission details.' },
  { command: '/rules', description: 'Ask an Infinity rules question and get cited sources.' },
  { command: '/inf-id', description: 'Make a printable identification sheet for an army list.' },
  { command: '/availability', description: 'Set or check times to arrange a game.' },
] as const

function LittleHelper() {
  return (
    <main className="portal-shell helper-page">
      <section className="helper-hero" aria-labelledby="helper-title">
        <div className="helper-hero-copy">
          <p className="helper-kicker"><span className="helper-signal" /> Lobo Infinity Portal / Discord tools</p>
          <h1 id="helper-title">Meet Lobo&apos;s<br /><em>Little Helper.</em></h1>
          <p className="helper-hero-lede">
            Your Infinity Army code, a tricky face-to-face matchup, or an ARO problem:
            bring it to the bot and get a readable answer you can use at the table.
          </p>
          <div className="helper-actions">
            <DiscordCommunityLink className="helper-button helper-button-primary" icon>Join Discord to try it <span aria-hidden="true">↗</span></DiscordCommunityLink>
            <a className="helper-button helper-button-secondary" href="#helper-commands">See the commands <span aria-hidden="true">↓</span></a>
          </div>
          <p className="helper-hero-note">Free to use in the Lobo Infinity League Discord · Start with a slash command</p>
        </div>
        <div className="helper-hero-display" aria-label="Three featured bot commands">
          <div className="helper-display-top"><span>LOBO&apos;S LITTLE HELPER</span><span>ONLINE IN DISCORD <i /></span></div>
          <div className="helper-display-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
          <div className="helper-display-content">
            <span className="helper-display-index">COMMAND INDEX / 001—003</span>
            <a href="#inf-list"><strong>01</strong><span>/inf-list<small>Army list intelligence</small></span><b>↗</b></a>
            <a href="#matchup"><strong>02</strong><span>/matchup<small>Two profiles. Both directions.</small></span><b>↗</b></a>
            <a href="#aro-counter"><strong>03</strong><span>/aro-counter<small>Find a reactive answer.</small></span><b>↗</b></a>
          </div>
          <div className="helper-display-bottom"><span>INFINITY N5</span><span>READY FOR YOUR NEXT GAME</span></div>
        </div>
      </section>

      <section className="helper-section-intro" id="helper-commands" aria-labelledby="helper-commands-title">
        <div><p className="helper-section-label">The field kit / 03 featured commands</p><h2 id="helper-commands-title">See what comes back.</h2></div>
        <p>These previews show the fields the bot returns. Your own list and profile choices fill in the actual results in Discord.</p>
      </section>

      <section className="helper-showcases" aria-label="Featured bot commands">
        <article className="helper-showcase" id="inf-list">
          <div className="helper-showcase-copy">
            <span className="helper-number">01 / LIST INTELLIGENCE</span>
            <h3><code>/inf-list</code></h3>
            <p>Paste an Infinity Army code. Get a readable list image, legality check, tactical brief, and the list&apos;s coverage of the current ITS 18 classified deck.</p>
            <div className="helper-input"><span>YOU PROVIDE</span><strong>An Infinity Army code</strong></div>
            <ul><li>Points, SWC, and trooper legality</li><li>Gunfighters, ARO pieces, specialists, and control tools</li><li>Classified capability and a link back to Infinity Army</li></ul>
          </div>
          <div className="helper-output helper-output-list" aria-label="Inf-list response preview">
            <div className="helper-output-header"><span>BOT RESPONSE / LIST READOUT</span><span className="helper-output-dots" aria-hidden="true">● ● ●</span></div>
            <div className="helper-output-body">
              <div className="helper-output-status"><span className="helper-status-icon">✓</span><div><small>ARMY LIST VALIDATION</small><strong>Points · SWC · Troopers</strong></div></div>
              <div className="helper-output-split"><div><small>ATTACHMENT 01</small><strong>Readable Army List</strong><span>Profiles, weapons, groups, and fireteams</span></div><div><small>ATTACHMENT 02</small><strong>Tactical Brief</strong><span>Ratings and battlefield roles</span></div></div>
              <div className="helper-classified"><span>ITS 18 / CLASSIFIED COVERAGE</span><strong>All 20 cards checked</strong><small>Eligible profiles shown for each card</small></div>
              <div className="helper-output-foot">OPEN IN INFINITY ARMY <span aria-hidden="true">↗</span></div>
            </div>
          </div>
        </article>

        <article className="helper-showcase helper-showcase-reverse" id="matchup">
          <div className="helper-showcase-copy">
            <span className="helper-number">02 / FACE-TO-FACE</span>
            <h3><code>/matchup</code></h3>
            <p>Select two exact profiles. The bot compares each attacker against the other&apos;s best defensive response, then turns the fight around.</p>
            <div className="helper-input"><span>YOU PROVIDE</span><strong>Two profiles from autocomplete</strong></div>
            <ul><li>Both attack directions, across range bands</li><li>Weapons, dice, and applied modifiers</li><li>Linked and unlinked cases when available</li></ul>
          </div>
          <div className="helper-output helper-output-matchup" aria-label="Matchup response preview">
            <div className="helper-output-header"><span>BOT RESPONSE / MATCHUP</span><span className="helper-output-dots" aria-hidden="true">● ● ●</span></div>
            <div className="helper-output-body">
              <div className="helper-output-headline"><small>MODEL 1 ATTACKS</small><strong>Attacker <span>→</span> Defender</strong><span>Then: model 2 attacks</span></div>
              <div className="helper-state-pills"><span>UNLINKED</span><span>LINKED +1SD WHEN LEGAL</span></div>
              <div className="helper-table" role="presentation"><div><b>RANGE</b><b>WEAPONS &amp; MODIFIERS</b><b>RESULT</b></div><div><span>0–8″</span><span>Active weapon / best ARO</span><span>F2F WIN</span></div><div><span>16–24″</span><span>Dice pools and modifiers</span><span>EFFECTS</span></div><div><span>32–48″</span><span>Cover and special rules</span><span>SURVIVE</span></div></div>
              <div className="helper-output-foot">BOTH DIRECTIONS · EVERY RANGE BAND</div>
            </div>
          </div>
        </article>

        <article className="helper-showcase" id="aro-counter">
          <div className="helper-showcase-copy">
            <span className="helper-number">03 / REACTIVE RESPONSE</span>
            <h3><code>/aro-counter</code></h3>
            <p>Choose the profile that worries you. See the strongest reactive responses, with an optional army or range filter to narrow the field.</p>
            <div className="helper-input"><span>YOU PROVIDE</span><strong>A target profile · optional army and range</strong></div>
            <ul><li>Top reactive profiles across useful range bands</li><li>Target and ARO weapons side by side</li><li>Face-to-face win, meaningful effect, and survival</li></ul>
          </div>
          <div className="helper-output helper-output-aro" aria-label="ARO counter response preview">
            <div className="helper-output-header"><span>BOT RESPONSE / ARO COUNTER</span><span className="helper-output-dots" aria-hidden="true">● ● ●</span></div>
            <div className="helper-output-body">
              <div className="helper-output-headline"><small>TOP 10 REACTIVE RESPONSES</small><strong>Counters to your target</strong><span>Both troopers in cover where eligible</span></div>
              <div className="helper-aro-card"><strong><span>01</span> BEST REACTIVE PROFILE</strong><small>Weapon · fireteam status</small><div><span>RANGE</span><span>F2F WIN</span><span>EFFECT</span><span>SURVIVE</span></div></div>
              <div className="helper-aro-card helper-aro-card-muted"><strong><span>02</span> NEXT RESPONSE</strong><small>Different range, different answer</small></div>
              <div className="helper-output-foot">DIRECT TEMPLATE WEAPONS EXCLUDED</div>
            </div>
          </div>
        </article>
      </section>

      <section className="helper-more" aria-labelledby="helper-more-title">
        <div className="helper-more-heading"><p className="helper-section-label">More in the kit</p><h2 id="helper-more-title">One server. More answers.</h2><p>These commands are available in the same Discord.</p></div>
        <div className="helper-more-grid">{moreCommands.map(({ command, description }) => <div key={command}><code>{command}</code><p>{description}</p></div>)}</div>
      </section>
      <section className="helper-final" aria-labelledby="helper-final-title">
        <span className="helper-final-icon"><PortalIcon name="discord" /></span>
        <div><p className="helper-section-label">Ready when you are</p><h2 id="helper-final-title">Take the bot into your next game.</h2><p>Join the Discord, type a command, and pick your profiles or paste an Army code.</p></div>
        <div className="helper-final-actions"><DiscordCommunityLink className="helper-button helper-button-primary" icon>Join Discord <span aria-hidden="true">↗</span></DiscordCommunityLink><Link to="/army-intelligence">Explore Army Intelligence <span aria-hidden="true">→</span></Link></div>
      </section>
    </main>
  )
}

export default LittleHelper
