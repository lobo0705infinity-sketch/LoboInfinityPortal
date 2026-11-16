import { createFactionBriefingPublisher } from './aurora-faction-briefing-publisher.mjs'

export const AURORA_RULES_NOTICE = "**Full current rules:** https://lobo-infinity-portal.vercel.app/campaign/aurora-vii/rules#balance-amendment"
export const AURORA_CURRENT_PROCEDURES = "**Current campaign procedures**\nNeutral claims count as captures, except requirements naming an enemy controller. Count the best five results per faction/location/Turn, at most two per player; Narrative is separate. Valid cap-excluded games may meet objective conditions. Confirmation verifies a report; it does not guarantee counted TP. Late reports never count.\n\nAssign objectives before the global opening; they expire that Turn and completed objectives never repeat (2 VP each; 6 VP cap). From Turn 3: lowest projected Conquest VP nominates one available territory; a failed objective earns two next-Turn options; owners activate advantages in up to two vulnerable holdings. Rewards take priority; published deadlines/defaults apply. General terrain rules remain active. Use Faction Decisions before play.\n\n"
export const ARIADNA_BRIEFING_MARKER = 'Aurora VII · Ariadna faction briefing · v1'
export const ARIADNA_BRIEFING = `## 🐺 ARIADNA — FACTION BRIEFING
**Aurora VII: Race for the Gate**

Welcome to Ariadna’s campaign headquarters. Use this channel to coordinate games, discuss targets, share lists, and keep our plans within the faction.

${AURORA_CURRENT_PROCEDURES}**Why we’re here**
Our settlers, prospectors, and expedition crews have already made lives on Aurora VII’s frontier. Those communities need supplies, safe routes, and protection as rival powers compete for control.

We fight to ensure the people who helped settle this world have a say in its future.

**How we win**
Ariadna uses territorial **Conquest**:

• Every **counted Tournament Point generates 1 Influence** in the territory where that game was reported.
• Only the Turn’s announced **Vulnerable Territories** can change hands.
• Highest faction Influence controls the territory at Turn end. **Counted Objective Points break ties**; a positive complete tie preserves the controller only if it is among the leaders. Otherwise the published faction priority selects between the leaders. Zero Influence leaves control unchanged.
• Territories held **at the end of Turn 6** award their printed Campaign VP.

**Our Doctrine: Frontier Masters**
Capture or successfully defend a **1 VP territory** to earn **+1 Campaign VP**—once per Turn, up to three times across the campaign.

The 1 VP territories are **Ember Highlands, Sulfur Basin, Frostreach Wastes, Northward Expanse, and Iron Corridor**. They become possible Doctrine targets when announced as Vulnerable.

**Our approach**
Coordinate before spreading our games across the map. Securing a Doctrine target can earn a bonus, but higher-value territories also matter for the final score. Choose priorities together based on each Turn’s announced situation.

Narrative Mission games contribute to a **separate faction total**, not territorial Influence. Decide together how much effort to commit to each contest.

**Keep our plans here**
Discuss targets, match scheduling, and any GM-issued Secret Objective in this channel. Don’t share private objectives or faction briefings outside it.

**Before each game:** confirm the mission, Campaign Location, and current Event rules. Afterwards, report the result accurately.

**Protect our people. Hold the frontier.**

${AURORA_RULES_NOTICE}`

export function createAriadnaBriefingPublisher({ path = '/data/aurora-vii-ariadna-briefing.json' } = {}) {
  return createFactionBriefingPublisher({ path, factionId: 'ariadna', marker: ARIADNA_BRIEFING_MARKER, content: ARIADNA_BRIEFING })
}
