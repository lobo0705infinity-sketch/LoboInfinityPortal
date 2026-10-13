import { createFactionBriefingPublisher } from './aurora-faction-briefing-publisher.mjs'

export const ARIADNA_BRIEFING_MARKER = 'Aurora VII · Ariadna faction briefing · v1'
export const ARIADNA_BRIEFING = `## 🐺 ARIADNA — FACTION BRIEFING
**Aurora VII: Race for the Gate**

Welcome to Ariadna’s campaign headquarters. Use this channel to coordinate games, discuss targets, share lists, and keep our plans within the faction.

**Why we’re here**
Our settlers, prospectors, and expedition crews have already made lives on Aurora VII’s frontier. Those communities need supplies, safe routes, and protection as rival powers compete for control.

We fight to ensure the people who helped settle this world have a say in its future.

**How we win**
Ariadna uses territorial **Conquest**:

• Every **Tournament Point generates 1 Influence** in the territory where that game was reported.
• Only the Turn’s announced **Vulnerable Territories** can change hands.
• Highest faction Influence controls the territory at Turn end. **Objective Points break ties**; a complete tie preserves the current controller.
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

**Protect our people. Hold the frontier.**`

export function createAriadnaBriefingPublisher({ path = '/data/aurora-vii-ariadna-briefing.json' } = {}) {
  return createFactionBriefingPublisher({ path, factionId: 'ariadna', marker: ARIADNA_BRIEFING_MARKER, content: ARIADNA_BRIEFING })
}
