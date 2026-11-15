# Aurora VII — balance amendment for review

Prepared 15 November 2026. Status: draft; no live campaign activation and no retrospective scoring changes.

This package addresses concentration of results, passive scoring, territorial ties, doctrine access, objective workload, calendar discretion, starting positions and battlefield asymmetry. It preserves faction identities and the separate territorial and Narrative contests. It does not promise equal outcomes between players of different skill.

## Adoption and authority

Choose the first affected Turn, announce the amendment to all factions before its decisions or games, and record `2026-11-balance` in that Turn's public briefing. The portal snapshots the revision when operations are prepared. Previously prepared Turns retain their original rules, including completed awards. Existing PDFs and faction briefs need an amendment notice naming that effective Turn; the amendment takes precedence only on the subjects it changes.

Do not change an active Turn's rules in response to its results. Publication rejects same-Turn activation, and operations rejects a different revision or priority between preparation and opening games. The selected revision and faction tie priority remain fixed after adoption. No messages are sent by this change.

The scoring and participation provisions below are implemented in the draft portal code. Calendar publication, objective difficulty review and the separate next-campaign provisions are commissioner procedures: they are not automatic calculations or a claim that existing games have been rebalanced.

## 1. Count five faction results, at most two per player

For each faction, each Campaign Turn and each location, count the best five eligible player results, subject to a maximum of two from one registered player. Each Vulnerable Territory is a location; the Narrative Mission is a separate location with the same cap. Eligibility still requires confirmation or commissioner approval, including the existing late/duplicate checks.

Order results by TP descending, OP descending, earlier original submission timestamp, then report ID. Greedily take results in that order while respecting both limits. Recalculate until resolution: a stronger later result can replace an earlier result. The two players in one report are evaluated independently. Correcting or rejecting a report recalculates selection. Freeze the selected results with the committed Turn outcome.

Counted TP and the OP from those same results feed Influence, support conversions, Infiltration comparisons, Narrative scoring and all campaign TP/OP tie-break totals. Apply separately earned support or Narrative bonuses afterwards; they do not occupy a result slot, create OP, or satisfy a requirement to play. For a campaign-end TP/OP tie-break, add each Turn's official counted totals under that Turn's own revision; do not retrospectively cap older Turns.

All legitimate games remain in battle history and personal performance statistics. Opponents remain free to replay one another; the caps still apply. Only counted results can supply game-based Secret Objective evidence under the amendment. An employer still cannot claim hired players' victories as its own.

### Worked example

| Player | Raw TP results at one location | Results counted | Counted TP |
|---|---|---|---:|
| A | 5, 5, 5, 5, 5 | Best two | 10 |
| B | 4, 4 | Both | 8 |
| C | 4 | One | 4 |
| **Faction** | **8 results / 37 raw TP** | **5 results** | **22** |

A alone cannot fill all five slots. Twenty perfect wins from A still contribute 10 TP at this location. Three active players can fill five slots; a faction with two active players can fill four. This reduces the effect of unlimited activity but does not eliminate differences in skill, roster size or opponent availability. A player can still contribute at several locations, and extra attempts can improve which results make the best five. The cap bounds counted impact rather than eliminating every benefit of additional play. Before a new campaign, aim for at least three realistically active players per faction; registration totals alone do not establish that. A full five-result allocation contains at most two results from one player; that is not a guarantee that their share of TP is at most 40%.

## 2. Require participation for rewards

- **Tohaa:** the declared outcome must occur and Tohaa must earn at least five counted territorial TP at its selected target. Hired support cannot meet this personal faction threshold. Its existing conversion from own TP to support is unchanged.
- **Combined Army:** at least one of its own counted target games is required before an Infiltration can succeed. The existing comparison and complete-tie failure rules remain.
- **Narrative winner:** at least one of the faction's own counted Narrative games is required. Bonus-only factions are ineligible; determine the winner among eligible factions.
- **Successful defence:** the controller must earn at least one of its own counted TP at that territory. Another faction's activity does not make a passive hold an active defence.
- **Secret Objective:** a faction must play at least one of its own counted games that Turn. Where the requirement concerns a specific territory, its own relevant target participation must be verified as part of objective evidence.

These gates distinguish a successful operation from an outcome that happened without that faction participating. They do not require Tohaa to prove its support was the decisive point: that would punish useful cooperation whenever the beneficiary won comfortably.

## 3. Resolve territorial ties among the actual leaders

Compare Influence, then the faction's own counted OP. If all Influence is zero, retain the controller. With a positive tied leading score, retain the incumbent only if it is one of the tied leaders. Otherwise the tied faction appearing first in the public faction priority takes control.

Use the campaign's previously published random priority order if one exists. Otherwise draw all eleven factions once in public before the first amended Turn and publish the order. Do not let the GM choose the order or redraw it after seeing results. The portal requires every faction exactly once and locks the order after adoption.

Example: Ariadna and Yu Jing each have 10 Influence and 16 OP, while incumbent PanOceania has zero. PanOceania cannot retain the territory through this tie. The published priority selects between Ariadna and Yu Jing. If PanOceania also has 10/16, it retains as a tied leader.

Narrative complete ties remain unresolved. Infiltration complete ties still fail.

## 4. Retain faction-specific Doctrines

Keep each faction's existing Doctrine condition and the limits of one Doctrine VP per Turn and three for the campaign. The proposed common eight-TP-and-control alternative has been withdrawn. It is removed from the scoring engine and public rules.

A Doctrine being unavailable in a particular Turn is not automatically a design defect: circumstances are part of its identity. Review whether the vulnerability schedule repeatedly denies a faction any realistic opportunity across the campaign. Address a persistent problem through the calendar or an individually discussed revision to that faction's Doctrine. No replacement wording or guaranteed every-Turn scoring route is introduced by this draft.

## 5. Standardize Secret Objective effort

One active objective per faction; lock it before the Turn opens and before games. At most one completion per Turn, worth two VP, with the existing six-VP campaign maximum. Never assign an objective after seeing results. Older uncompleted objectives that are impossible under the new schedule or cap should be withdrawn with a recorded reason and replaced before play, without a VP penalty.

Use these assignment standards, keeping each faction's actual objective private:

| Objective type | Assignment standard |
|---|---|
| Battle performance | At most two counted wins; a diversity requirement may ask for two different opposing factions, not four |
| Territory operation | One named Vulnerable target, a specified capture/active-defence result, and at least five own counted TP there |
| Specialist operation | One legal declared target, the faction's normal successful-operation requirement and a concrete additional task feasible within two counted games |
| State objective | A reachable end-of-Turn state plus relevant own participation; no award solely for an inherited holding or somebody else's action |

The proposed revision to a four-opposing-faction victory objective is **two counted victories against two different opposing factions in one Turn**, still two VP. Do not revise it after the faction has begun playing that Turn.

Two wins and a territory capture are not statistically identical. Before assignment, the GM must check the actual vulnerable map, available opponents and active roster. Never assign an objective with no legal target. After resolution, record attempts, completions and games required by objective family; use that evidence to adjust the next campaign's pool rather than guessing that equal VP means equal difficulty.

The software enforces activation timing, one active assignment, one completion, participation and the six-VP cap. It still relies on commissioner review for the substantive objective condition.

## 6. Optional discussion: publish a vulnerability calendar

Sections 6–8 are additional design ideas for discussion, not adopted campaign rules or implemented scoring changes.

For the ongoing campaign, publish every remaining Turn's four Vulnerable Territories before the first amended Turn. Alongside it, show each territory's previous and planned exposure count. Give the least-exposed territories priority when filling uncommitted slots. Honor already-earned calendar privileges, record their public effect when exercisable, and explain any resulting exception. If too few Turns remain to equalize exposure, say so; do not claim the past has been repaired.

For a fresh six-Turn campaign, each territory is vulnerable once in Turns 1–3 and once in Turns 4–6. There are exactly 24 slots: twelve territories, twice each. One legal base calendar is:

| Turn | Territory 1 | Territory 2 | Territory 3 | Territory 4 |
|---:|---|---|---|---|
| 1 | Nova Prospect | Echo Shores | Harmony Province | Ember Highlands |
| 2 | Korin Range | Verde Wilds | Sulfur Basin | Northward Expanse |
| 3 | Crystal Frontier | Azure Coast | Frostreach Wastes | Iron Corridor |
| 4 | Nova Prospect | Verde Wilds | Frostreach Wastes | Iron Corridor |
| 5 | Korin Range | Azure Coast | Harmony Province | Northward Expanse |
| 6 | Crystal Frontier | Echo Shores | Ember Highlands | Sulfur Basin |

This is a tested example, not an invented replacement for the ongoing campaign's history or announced targets. Draw or choose the actual calendar before factions choose starting packages. For the next campaign, replace rewards that alter vulnerability with a clearly described narrative/story choice; the normal Narrative VP award remains. This prevents a late story reward from overriding guaranteed exposure. Existing earned rewards are not revoked.

A fixed calendar reduces GM discretion and makes planning easier. It also removes some surprise; current Events and story developments can supply that uncertainty without determining whose holdings can be attacked.

## 7. Optional discussion: starting-package compensation

For the next campaign only, retain the eight thematic starting packages and random choice order. A faction assigned a package worth two printed VP receives one fixed **setup compensation VP at campaign end**. Record the recipient at setup; the point is not attached to the territory and does not transfer with ownership. Three-VP packages receive none. This compensation is excluded from mid-campaign earned-VP comparisons, including JSA's Doctrine.

That equalizes starting nominal value at three without changing territory values, creating extra units or rewriting current scores. It does not claim all packages have identical defendability or battlefield advantages. Do not issue retrospective compensation to the ongoing campaign.

This is a proposed next-campaign rule; the draft engine does not automatically grant setup compensation to existing factions.

## 8. Optional discussion: owner advantages and territory restrictions

Keep the approved Korin eligibility rule: only TAGs with Terrain (Mountain) or Terrain (Total) may enter. The separate Korin map/video work remains authoritative; this amendment does not revert it.

For a separate next-campaign terrain revision, trial these exact changes:

- **Owner advantage:** replace the twelve unequal owner advantages with one common benefit: once per battle, reroll one failed, non-Face-to-Face WIP roll to interact with a mission objective. The new result stands; it cannot be rerolled again. A faction benefits only while it is the Turn-start controller. No transfer through support or a contract.
- **Harmony:** retain +3 Discover; remove the blanket prohibition on entering Camouflaged State. Marker restrictions written in the mission itself still apply.
- **Ember:** remove the blanket suppression of Super-Jump. Use the actual terrain, height and ordinary movement rules to define the battlefield challenge.
- **Other territory effects:** retain their written rules for the first test pass. Test LoF, Hacking, water and toxic effects with armies that rely on the affected mechanics before deciding another revision. A symmetric rule can still have asymmetric army impact.

Do not activate these terrain changes midway through an announced Turn. The owner reroll is simpler and consistent, but can still vary in value with mission and army; the test is practical play, not an assertion of perfect equality. Record side, initiative, faction, terrain traits, owner benefit used and OP margin in paired test games, reversing roles where feasible. Use those results to decide which effects need a further adjustment. This workstream needs a new territory sheet and corresponding video updates; no existing terrain files are changed in this scoring patch.

## 9. Make capped scoring transparent

The existing TP formula is straightforward. This section proposes visibility into which results the new caps select; it is not a finding that the current TP formula is confusing.

The live TP schedule is authoritative: win 4, draw 2, loss 0; add one for at least five OP, and add one to a loser whose OP deficit is at most two. The older 3/1/0 fallback does not apply to this schedule. An 8–6 result is 5–2 TP.

Publish the exact reporting deadline and timezone. Extensions must be announced before the deadline. A later administrative approval may accept a documented timely game/report affected by an outage or correct an existing report; it is not permission to play a new game after close. Record the reason and apply the same standard to every faction. The portal retains explicit commissioner approval for late records; factual eligibility still needs review.

Show the rules revision, raw battle history, each side's counted/excluded reason, counted faction totals, and the resolved public outcome. Keep hidden targets, contracts and objective details private. At Turn end, report active players, retained players from the preceding Turn, faction scoring slots filled and the largest individual's share of counted TP. Label a player with no report as inactive in that period, not permanently lost, and compare equal-length periods.

Do not add an undisclosed handicap for Lobo or any other player. Apply caps and eligibility rules uniformly. Strong play should matter; extra availability should have a bounded campaign effect.

## Validation and rollout

The draft adds automated scenarios for capped selection, replacement after correction/rejection, twenty perfect wins by one player, independent sides of a report, location/Turn separation, late/duplicate gates, the participation checks, territorial ties, preservation of faction-specific Doctrine conditions, objective limits, frozen legacy rules and consistency between live totals and private resolution.

Deployment order is backend first, then frontend. Run the existing Aurora game, operations, registration and publication checks, plus the new balance checks. Verify the amendment in an isolated practice campaign before publishing the effective Turn. Publish the final amendment notice and calendar, reissue affected objective wording before play, and then open the new Turn. The stored briefing source now links to the active revision, and its obsolete NA2 rules are corrected to match the October guide. Existing Discord messages and guide PDFs have not been rewritten or sent by this draft; they need the effective-Turn amendment notice at adoption.
