import { Link } from 'react-router-dom'
import DiscordCommunityLink from '../components/DiscordCommunityLink'
import PortalIcon from '../components/PortalIcon'
import './LittleHelper.css'

const moreCommands = [
  { command: '/list build', description: 'Choose a faction and mission for three guided list options. Add must-include models, then use Analyse This List or Create ID Sheet.' },
  { command: '/list random', description: 'Choose a faction, points, and SWC target. Get a random legal list and 2D TTS export; open roster, classifieds, and TTS notes privately.' },
  { command: '/list identify', description: 'Paste an Army code to make a printable model identification sheet.' },
  { command: '/rules', description: 'Ask an Infinity rules question and get cited sources.' },
  { command: '/mission', description: 'Choose a scenario to look up its mission details.' },
  { command: '/help', description: 'Open the private command guide. Pick Army Lists, Combat, Game Reference, or Find a Game.' },
] as const

const playCommands = [
  { command: '/play availability set', description: 'Save recurring availability for a day, weekdays, or weekends. Supply start, end, and time zone; optionally choose format, points, and game type.' },
  { command: '/play availability show', description: 'Check your saved availability.' },
  { command: '/play availability clear', description: 'Remove one day or all saved days.' },
  { command: '/play find now', description: 'Post a one-off game request with a date, start, end, and time zone. Optionally choose format, game size, and game type.' },
  { command: '/play find close', description: 'Close your latest open game request.' },
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
            <Link className="helper-button helper-button-secondary" to="/portal-guide?chapter=little-helper">Watch the bot walkthrough <span aria-hidden="true">▶</span></Link>
            <a className="helper-button helper-button-secondary" href="#helper-commands">See the commands <span aria-hidden="true">↓</span></a>
          </div>
          <p className="helper-hero-note">Start in the Lobo Infinity League Discord · Type /help for the private command guide</p>
        </div>
        <div className="helper-hero-display" aria-label="Three featured bot commands">
          <div className="helper-display-top"><span>LOBO&apos;S LITTLE HELPER</span><span>ONLINE IN DISCORD <i /></span></div>
          <div className="helper-display-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
          <div className="helper-display-content">
            <span className="helper-display-index">COMMAND INDEX / 001—003</span>
            <a href="#list-analyse"><strong>01</strong><span>/list analyse<small>Army list intelligence</small></span><b>↗</b></a>
            <a href="#combat-matchup"><strong>02</strong><span>/combat matchup<small>Two profiles. Both directions.</small></span><b>↗</b></a>
            <a href="#combat-counters"><strong>03</strong><span>/combat counters<small>Find a reactive answer.</small></span><b>↗</b></a>
          </div>
          <div className="helper-display-bottom"><span>INFINITY N5</span><span>READY FOR YOUR NEXT GAME</span></div>
        </div>
      </section>

      <section className="helper-section-intro" id="helper-commands" aria-labelledby="helper-commands-title">
        <div><p className="helper-section-label">The field kit / 03 featured commands</p><h2 id="helper-commands-title">See what comes back.</h2></div>
        <p>Type /list, /combat, or /play and choose a subcommand in Discord. Start with the short result, then use its buttons for private details and connected tools.</p>
      </section>

      <section className="helper-showcases" aria-label="Featured bot commands">
        <article className="helper-showcase" id="list-analyse">
          <div className="helper-showcase-copy">
            <span className="helper-number">01 / LIST INTELLIGENCE</span>
            <h3><code>/list analyse</code></h3>
            <p>Paste an Infinity Army code. The channel reply shows legality, a short summary, a readable roster, and a 2D Tabletop Simulator JSON export. Open the detail buttons for more.</p>
            <div className="helper-input"><span>YOU PROVIDE</span><strong>An Infinity Army code</strong></div>
            <ul><li>Tactical Brief, Ratings, Classifieds, and TTS Notes open privately</li><li>Create ID Sheet makes a printable model reference</li><li>Open in Infinity Army returns to the original list</li></ul>
            <p className="helper-example"><code>/list analyse army-code:&lt;your Army code&gt;</code></p>
          </div>
          <div className="helper-output helper-output-list" aria-label="List analyse response preview">
            <div className="helper-output-header"><span>BOT RESPONSE / LIST READOUT</span><span className="helper-output-dots" aria-hidden="true">● ● ●</span></div>
            <div className="helper-output-body">
              <div className="helper-output-status"><span className="helper-status-icon">✓</span><div><small>ARMY LIST VALIDATION</small><strong>Points · SWC · Troopers</strong></div></div>
              <div className="helper-output-split"><div><small>CHANNEL ATTACHMENT</small><strong>Readable Army List</strong><span>Profiles, weapons, and combat groups</span></div><div><small>CHANNEL ATTACHMENT</small><strong>2D TTS Export</strong><span>Download the JSON for Tabletop Simulator</span></div></div>
              <div className="helper-classified"><span>PRIVATE DETAIL BUTTONS</span><strong>Tactical Brief · Ratings · Classifieds · TTS Notes</strong><small>Classifieds shows ITS 18 cards and qualifying models. Create ID Sheet opens the connected identification tool.</small></div>
              <div className="helper-output-foot">OPEN IN INFINITY ARMY <span aria-hidden="true">↗</span></div>
            </div>
          </div>
        </article>

        <article className="helper-showcase helper-showcase-reverse" id="combat-matchup">
          <div className="helper-showcase-copy">
            <span className="helper-number">02 / FACE-TO-FACE</span>
            <h3><code>/combat matchup</code></h3>
            <p>Select two exact profiles. The bot compares each attacker against the other&apos;s best defensive response, then turns the fight around.</p>
            <div className="helper-input"><span>YOU PROVIDE</span><strong>Two profiles from autocomplete</strong></div>
            <ul><li>Both attack directions, across range bands</li><li>Weapons, dice, and applied modifiers</li><li>Linked and unlinked cases when available</li></ul>
            <p className="helper-example"><code>/combat matchup model-1:&lt;profile&gt; model-2:&lt;profile&gt;</code></p>
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

        <article className="helper-showcase" id="combat-counters">
          <div className="helper-showcase-copy">
            <span className="helper-number">03 / REACTIVE RESPONSE</span>
            <h3><code>/combat counters</code></h3>
            <p>Choose the profile that worries you. See the strongest reactive responses, with an optional army or range filter to narrow the field.</p>
            <div className="helper-input"><span>YOU PROVIDE</span><strong>A target profile · optional army and range</strong></div>
            <ul><li>Top reactive profiles across useful range bands</li><li>Target and ARO weapons side by side</li><li>Face-to-face win, meaningful effect, and survival</li></ul>
            <p className="helper-example"><code>/combat counters target:&lt;profile&gt;</code></p>
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

      <section className="helper-more" aria-labelledby="helper-play-title">
        <div className="helper-more-heading"><p className="helper-section-label">Find a game</p><h2 id="helper-play-title">Make time to play.</h2><p>Use your local time and time zone for recurring availability or a one-off request.</p></div>
        <div className="helper-more-grid">{playCommands.map(({ command, description }) => <div key={command}><code>{command}</code><p>{description}</p></div>)}</div>
      </section>
      <section className="helper-more" aria-labelledby="helper-feedback-title">
        <div className="helper-more-heading"><p className="helper-section-label">Feedback &amp; server tools</p><h2 id="helper-feedback-title">Keep answers useful.</h2><p>Workshop monitoring runs automatically.</p></div>
        <div className="helper-more-grid">
          <div><strong>Report incorrect answer</strong><p>Use this button on supported responses to explain the issue and provide a source. Reports help review; they do not automatically change answers.</p></div>
          <div><code>/admin reports</code><p>Server managers can privately download the latest 25 incorrect-answer reports for their server. Requires Manage Server.</p></div>
          <div><code>/admin bots</code><p>Server managers can privately inspect bot accounts, webhook publishers, permissions, and recent activity. Use refresh:True to rescan. Requires Manage Server.</p></div>
        </div>
      </section>
      <section className="helper-final" aria-labelledby="helper-final-title">
        <span className="helper-final-icon"><PortalIcon name="discord" /></span>
        <div><p className="helper-section-label">Ready when you are</p><h2 id="helper-final-title">Take the bot into your next game.</h2><p>Join the Discord and type /help, or choose a tool under /list, /combat, or /play. Use /rules and /mission for game reference.</p></div>
        <div className="helper-final-actions"><DiscordCommunityLink className="helper-button helper-button-primary" icon>Join Discord <span aria-hidden="true">↗</span></DiscordCommunityLink><Link to="/army-intelligence">Explore Army Intelligence <span aria-hidden="true">→</span></Link></div>
      </section>
    </main>
  )
}

export default LittleHelper
